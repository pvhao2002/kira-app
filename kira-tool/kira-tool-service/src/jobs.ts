import {createHash, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {ToolError, type ErrorCode} from './errors.ts';
import {parseProviderUrl, type Provider} from './provider.ts';
import type {FileStore} from './file-store.ts';

export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

/** Single source of truth for the lifecycle. RUNNING -> QUEUED is startup recovery only. */
const NEXT: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'QUEUED'],
  FAILED: ['QUEUED'],
  SUCCEEDED: ['EXPIRED'],
  CANCELLED: [],
  EXPIRED: [],
};

export const canTransitionTo = (from: JobStatus, to: JobStatus): boolean => NEXT[from].includes(to);

export interface Job {
  id: string;
  owner: string;
  provider: Provider;
  sourceId: string;
  canonicalUrl: string;
  currentUrl?: string | null;
  dedupeKey: string;
  status: JobStatus;
  stage: string | null;
  progress: number;
  errorCode: ErrorCode | null;
  attempts: number;
  displayName: string | null;
  fileSize: number | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
  expiresAt: Date | null;
}

export function transition(j: Job, to: JobStatus, now: Date): Job {
  if (!canTransitionTo(j.status, to)) throw new Error(`${j.status} -> ${to}`);
  const finishedAt = to === 'EXPIRED' ? j.finishedAt : to === 'QUEUED' || to === 'RUNNING' ? null : now;
  return {...j, status: to, stage: to, updatedAt: now, finishedAt};
}

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const columns = db.prepare('PRAGMA table_info(tool_job)').all() as {name: string}[];
  if (!columns.some((column) => column.name === 'current_url')) {
    db.exec('ALTER TABLE tool_job ADD COLUMN current_url TEXT');
  }
  return db;
}

type Row = Record<string, string | number | null>;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const date = (v: unknown) => (v == null ? null : new Date(String(v)));

export class JobRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  insert(j: Job): void {
    this.db.prepare(`INSERT INTO tool_job (id, owner, provider, source_id, canonical_url, idempotency_key, status, stage,
        progress, error_code, attempts, display_name, file_size, created_at, updated_at, finished_at, expires_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(j.id, j.owner, j.provider, j.sourceId, j.canonicalUrl, j.dedupeKey, j.status, j.stage, j.progress,
        j.errorCode, j.attempts, j.displayName, j.fileSize, iso(j.createdAt), iso(j.updatedAt), iso(j.finishedAt),
        iso(j.expiresAt));
  }

  /** Compare-and-set: writes the mutable columns only if the row is still in `expected`. */
  cas(j: Job, expected: JobStatus): boolean {
    return this.db.prepare(`UPDATE tool_job SET status=?, stage=?, progress=?, error_code=?, attempts=?,
        display_name=?, file_size=?, updated_at=?, finished_at=?, expires_at=?, current_url=? WHERE id=? AND status=?`)
      .run(j.status, j.stage, j.progress, j.errorCode, j.attempts, j.displayName, j.fileSize, iso(j.updatedAt),
        iso(j.finishedAt), iso(j.expiresAt), j.currentUrl ?? null, j.id, expected).changes === 1;
  }

  find(id: string): Job | null {
    const row = this.db.prepare('SELECT * FROM tool_job WHERE id=?').get(id) as Row | undefined;
    return row ? map(row) : null;
  }

  // rowid breaks ties: millisecond timestamps can collide where the Java service had microseconds.
  latestByOwner(owner: string, limit: number): Job[] {
    return this.all('SELECT * FROM tool_job WHERE owner=? ORDER BY created_at DESC, rowid DESC LIMIT ?', owner, limit);
  }

  findDuplicate(owner: string, key: string): Job | null {
    return this.all(`SELECT * FROM tool_job WHERE owner=? AND idempotency_key=?
        AND status IN ('QUEUED','RUNNING','SUCCEEDED') ORDER BY created_at DESC, rowid DESC LIMIT 1`, owner, key)[0] ?? null;
  }

  countActive(owner: string): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM tool_job WHERE owner=? AND status IN ('QUEUED','RUNNING')")
      .get(owner) as {n: number};
    return row.n;
  }

  findByStatus(s: JobStatus): Job[] {
    return this.all('SELECT * FROM tool_job WHERE status=?', s);
  }

  findExpired(now: Date): Job[] {
    return this.all("SELECT * FROM tool_job WHERE status='SUCCEEDED' AND expires_at < ?", iso(now));
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM tool_job WHERE id=?').run(id);
  }

  private all(sql: string, ...params: (string | number | null)[]): Job[] {
    return (this.db.prepare(sql).all(...params) as Row[]).map(map);
  }
}

function map(r: Row): Job {
  return {
    id: String(r.id), owner: String(r.owner), provider: r.provider as Provider, sourceId: String(r.source_id),
    canonicalUrl: String(r.canonical_url), dedupeKey: String(r.idempotency_key), status: r.status as JobStatus,
    currentUrl: r.current_url as string | null,
    stage: r.stage as string | null, progress: Number(r.progress), errorCode: r.error_code as ErrorCode | null,
    attempts: Number(r.attempts), displayName: r.display_name as string | null,
    fileSize: r.file_size == null ? null : Number(r.file_size), createdAt: date(r.created_at)!,
    updatedAt: date(r.updated_at)!, finishedAt: date(r.finished_at), expiresAt: date(r.expires_at),
  };
}

export interface JobQueue {
  /** Throws ToolError(QUEUE_FULL) when the worker pool is saturated. */
  enqueue(jobId: string): void;
}

export const MAX_ACTIVE_PER_USER = 3;
export const MAX_ATTEMPTS = 3;
const LIST_LIMIT = 50;
const DAY_MS = 86_400_000;

/**
 * Every method is synchronous (node:sqlite is synchronous), so on the single JS thread each call runs to completion
 * without interleaving: the equivalent of the Java service's `synchronized` methods.
 */
export class JobService {
  private readonly repo: JobRepository;
  private readonly queue: JobQueue;
  private readonly files: FileStore;
  private readonly clock: () => Date;
  private readonly retentionDays: number;

  constructor(repo: JobRepository, queue: JobQueue, files: FileStore, clock: () => Date, retentionDays: number) {
    this.repo = repo;
    this.queue = queue;
    this.files = files;
    this.clock = clock;
    this.retentionDays = retentionDays;
  }

  // ponytail: single instance - in-process dedupe is only correct in one process; use a DB lock/unique key when scaling out
  submit(owner: string, rawUrl: unknown): {job: Job; created: boolean} {
    const p = parseProviderUrl(rawUrl);
    const key = createHash('sha256').update(`${p.provider}:${p.sourceId}`, 'utf8').digest('hex');
    const dup = this.repo.findDuplicate(owner, key);
    if (dup) return {job: dup, created: false};
    if (this.repo.countActive(owner) >= MAX_ACTIVE_PER_USER) throw new ToolError('TOO_MANY_ACTIVE_JOBS');
    const now = this.clock();
    const job: Job = {
      id: randomUUID(), owner, provider: p.provider, sourceId: p.sourceId, canonicalUrl: p.canonicalUrl,
      dedupeKey: key, status: 'QUEUED', stage: 'QUEUED', progress: 0, errorCode: null, attempts: 0, currentUrl: null,
      displayName: null, fileSize: null, createdAt: now, updatedAt: now, finishedAt: null, expiresAt: null,
    };
    this.repo.insert(job);
    try {
      this.queue.enqueue(job.id);
    } catch (e) {
      this.repo.delete(job.id);
      throw e;
    }
    return {job, created: true};
  }

  get(owner: string, id: string): Job {
    const job = this.repo.find(id);
    if (!job || job.owner !== owner) throw new ToolError('JOB_NOT_FOUND');
    return job;
  }

  list(owner: string): Job[] {
    return this.repo.latestByOwner(owner, LIST_LIMIT);
  }

  retry(owner: string, id: string): Job {
    const job = this.get(owner, id);
    if (job.status !== 'FAILED' || job.attempts >= MAX_ATTEMPTS) throw new ToolError('JOB_NOT_RETRYABLE');
    if (this.repo.countActive(owner) >= MAX_ACTIVE_PER_USER) throw new ToolError('TOO_MANY_ACTIVE_JOBS');
    const now = this.clock();
    const next: Job = {...transition(job, 'QUEUED', now), stage: 'QUEUED', progress: 0, errorCode: null, currentUrl: null};
    if (!this.repo.cas(next, 'FAILED')) throw new ToolError('JOB_NOT_RETRYABLE');
    try {
      this.queue.enqueue(id);
    } catch (e) {
      this.repo.cas(job, 'QUEUED');
      throw e;
    }
    return next;
  }

  /** Cancels a QUEUED job; deletes a terminal job and its file; RUNNING is refused. */
  remove(owner: string, id: string): void {
    const job = this.get(owner, id);
    if (job.status === 'QUEUED') {
      if (!this.repo.cas(transition(job, 'CANCELLED', this.clock()), 'QUEUED')) throw new ToolError('JOB_RUNNING');
    } else if (job.status === 'RUNNING') {
      throw new ToolError('JOB_RUNNING');
    } else {
      this.files.delete(id);
      this.repo.delete(id);
    }
  }

  // ---- runner-facing lifecycle ----

  /** Null when the job was cancelled/changed before the worker picked it up. */
  markRunning(id: string): Job | null {
    const j = this.repo.find(id);
    if (!j || j.status !== 'QUEUED') return null;
    const now = this.clock();
    const next: Job = {...transition(j, 'RUNNING', now), attempts: j.attempts + 1, stage: 'STARTING', progress: 0, currentUrl: null};
    return this.repo.cas(next, 'QUEUED') ? next : null;
  }

  progress(id: string, stage: string, percent: number): void {
    const j = this.repo.find(id);
    if (j?.status === 'RUNNING') this.repo.cas({...j, stage, progress: percent, updatedAt: this.clock()}, 'RUNNING');
  }

  navigation(id: string, url: string): void {
    // Browser URLs are untrusted; only web links without embedded credentials reach the UI.
    let parsed: URL;
    try { parsed = new URL(url); } catch { return; }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || url.length > 8192) return;
    const j = this.repo.find(id);
    if (j?.status === 'RUNNING' && j.currentUrl !== url) {
      this.repo.cas({...j, currentUrl: url, updatedAt: this.clock()}, 'RUNNING');
    }
  }

  succeed(id: string, displayName: string, fileSize: number): void {
    const j = this.repo.find(id);
    if (j?.status !== 'RUNNING') return;
    const now = this.clock();
    this.repo.cas({
      ...transition(j, 'SUCCEEDED', now), stage: 'DONE', progress: 100, displayName, fileSize,
      expiresAt: new Date(now.getTime() + this.retentionDays * DAY_MS),
    }, 'RUNNING');
  }

  fail(id: string, code: ErrorCode): void {
    const j = this.repo.find(id);
    if (j?.status === 'RUNNING') this.repo.cas({...transition(j, 'FAILED', this.clock()), errorCode: code}, 'RUNNING');
  }

  // ---- maintenance ----

  /** The worker queue is in-memory: RUNNING rows go back to QUEUED, then every QUEUED row is re-enqueued. */
  recover(): void {
    for (const j of this.repo.findByStatus('RUNNING')) {
      if (j.attempts < MAX_ATTEMPTS) {
        this.repo.cas(transition(j, 'QUEUED', this.clock()), 'RUNNING');
      } else {
        this.repo.cas({...transition(j, 'FAILED', this.clock()), errorCode: 'INTERRUPTED'}, 'RUNNING');
      }
    }
    for (const j of this.repo.findByStatus('QUEUED')) {
      try {
        this.queue.enqueue(j.id); // markRunning's CAS makes a double enqueue harmless
      } catch (e) {
        if (!(e instanceof ToolError)) throw e;
        // saturated at startup: cancel instead of leaving a QUEUED row no worker will ever pick up
        this.repo.cas({...transition(j, 'CANCELLED', this.clock()), errorCode: 'QUEUE_FULL'}, 'QUEUED');
      }
    }
  }

  /** Runs hourly (see server.ts). */
  expire(): void {
    const now = this.clock();
    for (const j of this.repo.findExpired(now)) {
      this.files.delete(j.id);
      this.repo.cas(transition(j, 'EXPIRED', this.clock()), 'SUCCEEDED');
    }
    this.files.expireScreenshots(now.getTime());
  }
}
