import http from 'node:http';
import crypto from 'node:crypto';
import { BusinessException, sleep as realSleep } from './util.js';
import { isLockError } from './db.js';
import { isEmptyOddsResponse } from './crawl/event.js';
import { log } from './log.js';

export const MAX_BODY_BYTES = 5 * 1024 * 1024;
const LOCK_ATTEMPTS = 3;
const DATE = /^\d{8}$/;
const EXTERNAL_ID = /^[A-Za-z0-9_-]{1,64}$/;
// Flat char class + length check: a repeated group overflows V8's regex backtrack stack on ~4-5 MB bodies.
const BASE64_CHARS = /^[A-Za-z0-9+/]*={0,2}$/;
const REASONS = { 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 405: 'Method Not Allowed', 413: 'Payload Too Large', 422: 'Unprocessable Entity', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };

const SQL_CANDIDATES = `
  select e.external_id
  from events e
  where e.link is not null
    and e.has_odds
    and e.status_id in (1, 2, 3, 4)
    and e.event_date >= :from
    and e.event_date < :to
  order by e.event_date, e.event_id
`;

// ---- ExtensionTokenFilter -----------------------------------------------------------------------
function parseHash(hex) {
  if (!hex || hex.trim() === '') return null;
  const h = hex.trim();
  return /^[0-9a-fA-F]{64}$/.test(h) ? Buffer.from(h, 'hex') : null;
}

/** Static bearer-token guard for /ext/*: SHA-256(token) vs KIRA_EXTENSION_TOKEN_SHA256. Fails closed. */
export function createTokenGuard(expectedSha256Hex) {
  const expected = parseHash(expectedSha256Hex);
  return function authorized(header) {
    if (expected === null || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
    const actual = crypto.createHash('sha256').update(header.substring(7).trim(), 'utf8').digest();
    return crypto.timingSafeEqual(actual, expected); // both 32 bytes
  };
}

// ---- helpers --------------------------------------------------------------------------------------
const bad = (code, status = 400) => new BusinessException(code, status);

function parseDate(date) {
  if (typeof date !== 'string' || !DATE.test(date)) throw bad('AISCORE_INVALID_DATE');
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) throw bad('AISCORE_INVALID_DATE');
  return date;
}

function decodeBase64(b64) {
  if (typeof b64 !== 'string' || b64 === '' || b64.length % 4 !== 0 || !BASE64_CHARS.test(b64)) throw bad('AISCORE_INVALID_BASE64');
  return Buffer.from(b64, 'base64');
}

/** Malformed %-escape is a client error (Tomcat answers 400), not a 500. */
function decodeParam(s, code) {
  try {
    return decodeURIComponent(s);
  } catch {
    throw bad(code);
  }
}

const dayStart = (date) => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)} 00:00:00`;
function nextDayStart(date) {
  const t = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)) + 1));
  return `${t.toISOString().slice(0, 10)} 00:00:00`;
}

/** Keep BusinessException (domain code); hide anything else behind a domain code. Only the error class/code is logged. */
async function mapGuarded(code, status, work) {
  try {
    return await work();
  } catch (e) {
    if (e instanceof BusinessException) throw e;
    log.warn(`ext ${code}: ${e?.code ?? e?.name ?? 'Error'}`);
    throw new BusinessException(code, status);
  }
}

/**
 * MySQL picks a deadlock victim and rolls its transaction back; the documented fix is to re-run it.
 * Each attempt opens a fresh transaction (persist* call db.withTx).
 */
async function retryOnLockFailure(persist, { sleep, random }) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await persist();
    } catch (e) {
      if (!isLockError(e) || attempt >= LOCK_ATTEMPTS) throw e;
      log.warn(`ext lock failure, retry ${attempt}/${LOCK_ATTEMPTS - 1}: ${e.code}`);
      await sleep((50 + Math.floor(random() * 100)) * attempt);
    }
  }
}

function parseBool(v) {
  if (v === undefined) return false;
  const s = String(v).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off', ''].includes(s)) return false;
  throw bad('AISCORE_INVALID_BODY');
}

// ---- handlers ---------------------------------------------------------------------------------------
export function createHttpServer({
  config, db, dateCrawler, eventCrawler, crawlDateService, crawlEventService, onDemandPredict, onDemandUrlPredict,
  sleep = realSleep, random = Math.random,
}) {
  const prefix = config.server.contextPath;
  const authorized = createTokenGuard(config.extension.tokenSha256);
  const retryOpts = { sleep, random };

  async function matches(date, body) {
    const day = parseDate(date);
    const bytes = decodeBase64(body?.body);
    const response = await mapGuarded('AISCORE_DECODE_FAILED', 422, () => dateCrawler.mapMatches(day, bytes));
    const events = response.events ?? [];
    await mapGuarded('AISCORE_PERSIST_FAILED', 500, () => retryOnLockFailure(() => crawlDateService.persistDate(day, events), retryOpts));
    return events
      .map((b) => b.event)
      .filter((e) => e && e.externalId !== null && e.externalId !== undefined)
      .map((e) => ({ externalId: e.externalId, eventDate: e.eventDate, statusId: e.statusId, hasOdds: e.hasOdds, hasOddsCorner: e.hasOddsCorner }));
  }

  async function candidates(query) {
    const raw = query.get('date');
    if (raw === null) throw bad('AISCORE_INVALID_BODY');
    const day = parseDate(raw);
    // event_date is stored in Asia/Ho_Chi_Minh local time.
    const rows = await mapGuarded('AISCORE_PERSIST_FAILED', 500, () => db.query(SQL_CANDIDATES, { from: dayStart(day), to: nextDayStart(day) }));
    return rows.map((r) => r.external_id);
  }

  async function odds(externalId, body) {
    if (!EXTERNAL_ID.test(externalId)) throw bad('AISCORE_INVALID_EXTERNAL_ID');
    if (!body || typeof body.details !== 'object' || body.details === null || Array.isArray(body.details)) {
      throw bad('AISCORE_INVALID_BODY: missing odds payload');
    }
    const oddsList = decodeBase64(body.oddsList);
    const details = {};
    for (const [k, v] of Object.entries(body.details)) details[k] = decodeBase64(v);

    const row = await mapGuarded('AISCORE_PERSIST_FAILED', 500, () => crawlEventService.loadEventRowByExternalId(externalId));
    if (!row) throw BusinessException.notFound('AISCORE_EVENT_NOT_FOUND');
    const response = await mapGuarded('AISCORE_DECODE_FAILED', 422, () => eventCrawler.mapOdds(externalId, oddsList, details));
    if (isEmptyOddsResponse(response)) return { status: 'no_bet365' };
    // DB row decides corner (like the Rabbit flow); the extension's cache may be stale.
    // Persisting without corner would wipe the existing corner timeline.
    if (row.hasOddsCorner === true && details.corner === undefined) throw new BusinessException('AISCORE_ODDS_DETAIL_FETCH_FAILED: corner', 422);
    await mapGuarded('AISCORE_PERSIST_FAILED', 500, () => retryOnLockFailure(() => crawlEventService.persistCrawlResult(row.eventId, response), retryOpts));
    return { status: 'ok', oddsRows: response.odds ? response.odds.length : 0 };
  }

  const ROUTES = [
    { method: 'POST', re: /^\/ext\/dates\/([^/]+)\/matches$/, body: true, run: (m, _q, b) => matches(decodeParam(m[1], 'AISCORE_INVALID_DATE'), b) },
    { method: 'GET', re: /^\/ext\/odds\/candidates$/, run: (_m, q) => candidates(q) },
    { method: 'POST', re: /^\/ext\/events\/([^/]+)\/odds$/, body: true, run: (m, _q, b) => odds(decodeParam(m[1], 'AISCORE_INVALID_EXTERNAL_ID'), b) },
    {
      method: 'POST', re: /^\/predict\/events\/([^/]+)$/,
      run: (m, q) => {
        if (!/^[+-]?\d+$/.test(m[1])) throw bad('AISCORE_INVALID_BODY');
        return onDemandPredict.predict(Number.parseInt(m[1], 10), parseBool(q.get('recrawlOdd') ?? undefined));
      },
    },
    { method: 'POST', re: /^\/predict\/url$/, body: true, run: (_m, _q, b) => onDemandUrlPredict.predict(b) },
  ];

  function send(res, status, payload) {
    const text = payload === undefined ? '' : JSON.stringify(payload);
    const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) };
    if (status === 413) {
      headers.connection = 'close';
      res.on('finish', () => res.req.destroy());
    }
    res.writeHead(status, headers);
    res.end(text);
  }
  const sendError = (res, status, message) => send(res, status, { error: REASONS[status] ?? 'Error', message });

  /** Reads the body counting bytes while streaming (chunked bodies are capped too). */
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      let over = false;
      req.on('data', (c) => {
        if (over) return; // discard the rest; the connection is closed once the 413 is sent
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          over = true;
          chunks.length = 0;
          reject(bad('Payload Too Large', 413));
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return sendError(res, 404, 'Not Found');
      const path = url.pathname.slice(prefix.length) || '/';

      let route = null;
      let match = null;
      let pathMatched = false;
      for (const r of ROUTES) {
        const m = r.re.exec(path);
        if (!m) continue;
        pathMatched = true;
        if (r.method === req.method) {
          route = r;
          match = m;
          break;
        }
      }
      if (path.startsWith('/ext/') && !authorized(req.headers.authorization)) return sendError(res, 401, 'Unauthorized');
      if (!route) return sendError(res, pathMatched ? 405 : 404, pathMatched ? 'Method Not Allowed' : 'Not Found');
      if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) return sendError(res, 413, 'Payload Too Large');

      let body;
      if (route.body) {
        const raw = await readBody(req);
        try {
          body = JSON.parse(raw.toString('utf8'));
        } catch {
          return sendError(res, 400, 'AISCORE_INVALID_BODY'); // never echo the payload
        }
      }
      const result = await route.run(match, url.searchParams, body);
      return send(res, 200, result);
    } catch (e) {
      if (e instanceof BusinessException) return sendError(res, e.status, e.message);
      log.error(`Unhandled request error: ${e?.code ?? e?.name ?? 'Error'}`);
      return sendError(res, 500, 'Unexpected error');
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  // ponytail: no request timeout (Tomcat v1 parity). /predict waits on the event-lane mutex behind a Rabbit crawl +
  // Cloudflare clearance and can pass Node's 300 s default; headersTimeout still guards slow headers. Set a cap here if needed.
  server.requestTimeout = 0;
  return server;
}
