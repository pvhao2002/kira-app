import {randomUUID, timingSafeEqual} from 'node:crypto';
import express, {type NextFunction, type Request, type Response} from 'express';
import {ToolError} from './errors.ts';
import {MAX_ATTEMPTS, type Job, type JobService} from './jobs.ts';
import type {FileStore} from './file-store.ts';
import {RateLimiter} from './rate-limiter.ts';

export const CONTEXT_PATH = '/tool-service';
export const OWNER_COOKIE = 'tool_owner';
export const CSRF_COOKIE = 'TOOL-XSRF-TOKEN';
export const CSRF_HEADER = 'x-tool-xsrf-token';
const OWNER_MAX_AGE_MS = 30 * 86_400_000;
const MAX_BODY_BYTES = 4096;
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// java.util.UUID.fromString is lenient (case, short groups); ids are normalized to the canonical form.
const LENIENT_UUID = /^([0-9a-f]{1,8})-([0-9a-f]{1,4})-([0-9a-f]{1,4})-([0-9a-f]{1,4})-([0-9a-f]{1,12})$/i;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'TRACE', 'OPTIONS']);
const JSON_TYPE = /^application\/(?:[\w.-]+\+)?json\s*(?:;|$)/i;

interface Deps {
  jobs: JobService;
  files: FileStore;
  cookieSecure: boolean;
  forwardHeaders: 'native' | 'none';
}

/**
 * Public, no login. Same-origin only: no CORS. Anonymous owner id in an HttpOnly cookie, CSRF via double-submit
 * cookie (SPA mode). Middleware order mirrors the Java filter chain: headers, CSRF, owner cookie, body size.
 */
export function createApp({jobs, files, cookieSecure, forwardHeaders}: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  // Real client IP behind nginx (per-IP rate limits): X-Forwarded-For is honoured only from loopback/private proxies,
  // like Tomcat's RemoteIpValve. nginx must overwrite it: proxy_set_header X-Forwarded-For $remote_addr;
  app.set('trust proxy', forwardHeaders === 'native' ? 'loopback, linklocal, uniquelocal' : false);

  // 10 submits/min per client address, not per owner cookie: anyone can drop cookies on a public tool.
  // ponytail: the per-owner active-job cap is cookie-based too; the bounded queue (QUEUE_FULL) is the global
  // backstop. Store the client address on the job and cap active jobs per address if one client hogs the queue.
  const submitLimiter = new RateLimiter(10, 60_000);

  const api = express.Router();
  api.use(securityHeaders);
  api.use(csrf(cookieSecure));
  api.use(ownerCookie(cookieSecure));
  api.use(bodySize);

  const owner = (res: Response): string => res.locals.owner;
  const jobView = (job: Job) => view(job, job.status === 'FAILED' && files.screenshot(job.id) !== null);

  api.route('/api/v1/jobs')
    .get((_req, res) => {
      res.json(jobs.list(owner(res)).map(jobView));
    })
    .post(express.text({type: () => true, limit: MAX_BODY_BYTES}), (req, res) => {
      const url = submitUrl(req);
      // Behind nginx the real client address comes from 'trust proxy' (trusted proxies only).
      if (!submitLimiter.tryAcquire(req.ip ?? '')) throw new ToolError('RATE_LIMITED');
      const r = jobs.submit(owner(res), url);
      res.status(r.created ? 202 : 200).json(jobView(r.job));
    })
    .all(methodNotAllowed('GET, POST'));

  api.route('/api/v1/jobs/:id')
    .get((req, res) => {
      res.json(jobView(jobs.get(owner(res), jobId(req))));
    })
    .delete((req, res) => {
      jobs.remove(owner(res), jobId(req));
      res.status(204).end();
    })
    .all(methodNotAllowed('GET, DELETE'));

  api.route('/api/v1/jobs/:id/file')
    .get((req, res, next) => {
      const id = jobId(req);
      const job = jobs.get(owner(res), id);
      if (job.status === 'EXPIRED') throw new ToolError('FILE_EXPIRED');
      if (job.status !== 'SUCCEEDED') throw new ToolError('JOB_NOT_FOUND');
      const path = files.find(id);
      if (!path) throw new ToolError('FILE_EXPIRED');
      res.removeHeader('Pragma');
      res.removeHeader('Expires');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${rfc5987(safeName(job.displayName) + '.pdf')}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      res.sendFile(path, {etag: false, lastModified: false, cacheControl: false}, (err) => {
        if (err && !res.headersSent) next(new ToolError('FILE_EXPIRED'));
      });
    })
    .all(methodNotAllowed('GET'));

  api.route('/api/v1/jobs/:id/retry')
    .post((req, res) => {
      res.status(202).json(jobView(jobs.retry(owner(res), jobId(req))));
    })
    .all(methodNotAllowed('POST'));

  api.route('/api/v1/jobs/:id/screenshot')
    .get((req, res) => {
      const id = jobId(req);
      if (jobs.get(owner(res), id).status !== 'FAILED') throw new ToolError('JOB_NOT_FOUND');
      const image = files.screenshot(id);
      if (!image) throw new ToolError('JOB_NOT_FOUND');
      res.type('image/jpeg').send(image);
    })
    .all(methodNotAllowed('GET'));

  api.use((req, _res, next) => next(new ToolError('INVALID_REQUEST', 404)));
  api.use(errorHandler);

  app.use(CONTEXT_PATH, api);
  app.use((_req, res) => {
    res.status(404).end();
  });
  return app;
}

/** Owner-scoped projection: the browser's current URL is visible only to the job's owner. */
function view(j: Job, hasScreenshot: boolean) {
  return {
    id: j.id, provider: j.provider, status: j.status, stage: j.stage, progress: j.progress, errorCode: j.errorCode,
    attempts: j.attempts, retryable: j.status === 'FAILED' && j.attempts < MAX_ATTEMPTS, displayName: j.displayName,
    fileSize: j.fileSize, createdAt: j.createdAt.toISOString(), updatedAt: j.updatedAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null, expiresAt: j.expiresAt?.toISOString() ?? null,
    hasScreenshot,
    currentUrl: j.currentUrl ?? null,
  };
}

function jobId(req: Request): string {
  const m = LENIENT_UUID.exec(String(req.params.id));
  if (!m) throw new ToolError('INVALID_REQUEST');
  const widths = [8, 4, 4, 4, 12];
  return m.slice(1).map((g, i) => g.toLowerCase().padStart(widths[i], '0')).join('-');
}

/** URL checks (null, blank, length, allowlist) live in parseProviderUrl so every bad URL is INVALID_URL. */
function submitUrl(req: Request): string | null {
  if (!JSON_TYPE.test(req.get('content-type') ?? '')) throw new ToolError('INVALID_REQUEST', 415);
  let body: unknown;
  try {
    body = JSON.parse(typeof req.body === 'string' ? req.body : '');
  } catch {
    throw new ToolError('INVALID_REQUEST');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new ToolError('INVALID_REQUEST');
  const url = (body as {url?: unknown}).url;
  if (url == null) return null;
  if (typeof url === 'object') throw new ToolError('INVALID_REQUEST');
  return String(url); // like Jackson: scalar numbers/booleans coerce to text
}

function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.set({
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000 ; includeSubDomains');
  next();
}

/** Double-submit cookie: the cookie is issued if absent; unsafe methods must echo it in the header. */
function csrf(secure: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let token = cookie(req, CSRF_COOKIE);
    if (!token) {
      token = randomUUID();
      res.cookie(CSRF_COOKIE, token, {path: '/', secure, sameSite: 'strict'});
    }
    if (!SAFE_METHODS.has(req.method) && !sameToken(token, req.get(CSRF_HEADER))) {
      next(new ToolError('INVALID_REQUEST', 403));
      return;
    }
    next();
  };
}

function sameToken(expected: string, actual: string | undefined): boolean {
  if (actual === undefined) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Public tool, no login: each browser gets a random, unguessable owner id in an HttpOnly cookie and only sees its
 * own jobs. Losing the cookie means losing the job list (files still expire on the normal TTL).
 * Only a canonical UUID is accepted, so a client cannot pick a short or guessable owner id.
 */
function ownerCookie(secure: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let owner = cookies(req).find(([n, v]) => n === OWNER_COOKIE && CANONICAL_UUID.test(v))?.[1];
    if (!owner) {
      owner = randomUUID();
      res.cookie(OWNER_COOKIE, owner, {httpOnly: true, secure, sameSite: 'strict', path: CONTEXT_PATH, maxAge: OWNER_MAX_AGE_MS});
    }
    res.locals.owner = owner;
    next();
  };
}

/**
 * Rejects bodies over 4KB by Content-Length, and bodies of unknown length (chunked) with 411,
 * so no endpoint ever reads an unbounded body.
 */
function bodySize(req: Request, res: Response, next: NextFunction): void {
  const raw = req.get('content-length');
  const length = raw === undefined ? -1 : Number(raw);
  if (length > MAX_BODY_BYTES) return reject(res, 413);
  if (length < 0 && req.get('transfer-encoding') !== undefined) return reject(res, 411);
  next();
}

function reject(res: Response, status: number): void {
  res.status(status).type('application/problem+json')
    .send(JSON.stringify({status, title: 'INVALID_REQUEST', code: 'INVALID_REQUEST'}));
}

function methodNotAllowed(allow: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.set('Allow', allow);
    next(new ToolError('INVALID_REQUEST', 405));
  };
}

/** RFC 9457 responses with a stable "code". Never exposes exception messages, stack traces, URLs or paths. */
function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    // e.g. client aborted a streamed PDF download: nothing can be written any more
    req.socket.destroy();
    return;
  }
  let status = 500;
  let code = 'INTERNAL_ERROR';
  if (err instanceof ToolError) {
    status = err.status;
    code = err.code;
  } else {
    // Framework-level errors (bad body, wrong charset...) keep their status but get a stable code and no detail.
    const s = (err as {status?: unknown} | null)?.status;
    if (typeof s === 'number' && s >= 400 && s < 600) {
      status = s;
      code = s < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR';
    } else {
      console.error(`unhandled errorType=${(err as Error | null)?.name ?? typeof err}`);
    }
  }
  res.status(status).type('application/problem+json').send(JSON.stringify({
    type: 'about:blank', title: code, status, instance: req.originalUrl.split('?')[0], code,
  }));
}

function cookies(req: Request): [string, string][] {
  return (req.get('cookie') ?? '').split(';').map((part): [string, string] => {
    const i = part.indexOf('=');
    return i < 0 ? [part.trim(), ''] : [part.slice(0, i).trim(), part.slice(i + 1).trim()];
  });
}

const cookie = (req: Request, name: string) => cookies(req).find(([n, v]) => n === name && v !== '')?.[1];

/** Drops ISO control chars (header injection) and trims; the name is only ever sent RFC 5987-encoded. */
function safeName(raw: string | null): string {
  const s = (raw ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/^ +| +$/g, '');
  return s === '' ? 'document' : s;
}

function rfc5987(s: string): string {
  let out = '';
  for (const b of Buffer.from(s, 'utf8')) {
    const c = String.fromCharCode(b);
    out += /[A-Za-z0-9!#$&+\-.^_`|~]/.test(c) ? c : '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}
