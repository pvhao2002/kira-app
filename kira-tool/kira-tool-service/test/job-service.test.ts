import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canTransitionTo, JobRepository, JobService, openDb, transition} from '../src/jobs.ts';
import {FileStore} from '../src/file-store.ts';
import {ToolError, type ErrorCode} from '../src/errors.ts';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

test('opening an old database adds current URL without losing jobs and is repeatable', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'tool-migration-'));
  const path = join(dir, 'tool.db');
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const legacy = new DatabaseSync(path);
  legacy.exec(readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8'));
  legacy.exec(`INSERT INTO tool_job (id,owner,provider,source_id,canonical_url,idempotency_key,status,created_at,updated_at)
    VALUES ('old','alice','DRIVE','document','https://drive.google.com/','key','FAILED','2026-01-01','2026-01-01')`);
  legacy.close();
  for (let i = 0; i < 2; i++) {
    const db = openDb(path);
    const repo = new JobRepository(db);
    assert.equal(repo.find('old')?.owner, 'alice');
    assert.equal(repo.find('old')?.currentUrl, null);
    db.close();
  }
});

const D1 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS1/view';
const D2 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS2/view';
const D3 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS3/view';
const D4 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS4/view';
const DAY = 86_400_000;

function setup(t: {after: (fn: () => void) => void}) {
  const dir = mkdtempSync(join(tmpdir(), 'tool-svc-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const s = {
    enqueued: [] as string[],
    queueFull: false,
    now: new Date('2026-01-01T00:00:00Z'),
    files: new FileStore(dir, 1000),
    repo: new JobRepository(openDb(':memory:')),
  } as {enqueued: string[]; queueFull: boolean; now: Date; files: FileStore; repo: JobRepository; svc: JobService};
  s.svc = new JobService(s.repo, {
    enqueue: (id) => {
      if (s.queueFull) throw new ToolError('QUEUE_FULL');
      s.enqueued.push(id);
    },
  }, s.files, () => s.now, 7);
  return s;
}

const assertCode = (fn: () => unknown, code: ErrorCode) =>
  assert.throws(fn, (e: unknown) => e instanceof ToolError && e.code === code);

test('illegal transitions throw', (t) => {
  const {svc, now} = setup(t);
  assert.equal(canTransitionTo('SUCCEEDED', 'RUNNING'), false);
  assert.equal(canTransitionTo('QUEUED', 'SUCCEEDED'), false);
  assert.equal(canTransitionTo('CANCELLED', 'QUEUED'), false);
  assert.equal(canTransitionTo('FAILED', 'QUEUED'), true);
  const job = svc.submit('alice', D1).job;
  assert.throws(() => transition(job, 'SUCCEEDED', now), /QUEUED -> SUCCEEDED/);
});

test('submit creates queued and enqueues', (t) => {
  const {svc, enqueued} = setup(t);
  const r = svc.submit('alice', D1);
  assert.equal(r.created, true);
  assert.equal(r.job.status, 'QUEUED');
  assert.deepEqual(enqueued, [r.job.id]);
});

test('duplicate submit returns same job without enqueueing again', (t) => {
  const {svc, enqueued} = setup(t);
  const a = svc.submit('alice', D1);
  const b = svc.submit('alice', D1 + '?usp=sharing');
  assert.equal(b.created, false);
  assert.equal(b.job.id, a.job.id);
  assert.equal(enqueued.length, 1);
  assert.notEqual(svc.submit('bob', D1).job.id, a.job.id);
});

test('resubmit after failure creates new job', (t) => {
  const {svc} = setup(t);
  const a = svc.submit('alice', D1).job;
  svc.markRunning(a.id);
  svc.fail(a.id, 'PROVIDER_TIMEOUT');
  assert.notEqual(svc.submit('alice', D1).job.id, a.id);
});

test('active job cap enforced', (t) => {
  const {svc} = setup(t);
  svc.submit('alice', D1);
  svc.submit('alice', D2);
  svc.submit('alice', D3);
  assertCode(() => svc.submit('alice', D4), 'TOO_MANY_ACTIVE_JOBS');
  assert.equal(svc.submit('bob', D4).created, true);
});

test('queue full removes job and rethrows', (t) => {
  const s = setup(t);
  s.queueFull = true;
  assertCode(() => s.svc.submit('alice', D1), 'QUEUE_FULL');
  assert.deepEqual(s.svc.list('alice'), []);
});

test('retry only from failed and capped at three attempts', (t) => {
  const {svc} = setup(t);
  const id = svc.submit('alice', D1).job.id;
  assertCode(() => svc.retry('alice', id), 'JOB_NOT_RETRYABLE');
  for (let i = 0; i < 3; i++) {
    svc.markRunning(id);
    svc.fail(id, 'PROVIDER_EXTRACTION_FAILED');
    if (i < 2) assert.equal(svc.retry('alice', id).status, 'QUEUED');
  }
  assert.equal(svc.get('alice', id).attempts, 3);
  assertCode(() => svc.retry('alice', id), 'JOB_NOT_RETRYABLE');
});

test('retry queue full rolls back to failed', (t) => {
  const s = setup(t);
  const id = s.svc.submit('alice', D1).job.id;
  s.svc.markRunning(id);
  s.svc.fail(id, 'PROVIDER_TIMEOUT');
  s.queueFull = true;
  assertCode(() => s.svc.retry('alice', id), 'QUEUE_FULL');
  const job = s.svc.get('alice', id);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.attempts, 1);
  assert.equal(job.errorCode, 'PROVIDER_TIMEOUT');
});

test("other owner's job is not found", (t) => {
  const {svc} = setup(t);
  const id = svc.submit('alice', D1).job.id;
  assertCode(() => svc.get('bob', id), 'JOB_NOT_FOUND');
  assertCode(() => svc.retry('bob', id), 'JOB_NOT_FOUND');
  assertCode(() => svc.remove('bob', id), 'JOB_NOT_FOUND');
});

test('recovery requeues running under cap else fails', (t) => {
  const {svc, enqueued} = setup(t);
  const a = svc.submit('alice', D1).job.id;
  svc.markRunning(a);
  const b = svc.submit('alice', D2).job.id;
  svc.markRunning(b);
  svc.fail(b, 'INTERNAL_ERROR');
  svc.retry('alice', b);
  svc.markRunning(b);
  svc.fail(b, 'INTERNAL_ERROR');
  svc.retry('alice', b);
  svc.markRunning(b); // attempts == 3, running
  enqueued.length = 0;

  svc.recover();

  assert.equal(svc.get('alice', a).status, 'QUEUED');
  assert.deepEqual(enqueued, [a]);
  const failed = svc.get('alice', b);
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.errorCode, 'INTERRUPTED');
});

test('recovery re-enqueues queued rows', (t) => {
  const {svc, enqueued} = setup(t);
  const q = svc.submit('alice', D1).job.id;
  enqueued.length = 0; // executor queue lost on restart
  svc.recover();
  assert.deepEqual(enqueued, [q]);
  assert.equal(svc.get('alice', q).status, 'QUEUED');
});

test('recovery cancels queued when queue saturated', (t) => {
  const s = setup(t);
  const q = s.svc.submit('alice', D1).job.id;
  const r = s.svc.submit('alice', D2).job.id;
  s.svc.markRunning(r);
  s.queueFull = true;
  s.svc.recover();
  assert.equal(s.svc.get('alice', q).status, 'CANCELLED');
  assert.equal(s.svc.get('alice', r).status, 'CANCELLED');
  s.queueFull = false;
  assert.equal(s.svc.submit('alice', D1).created, true); // not stuck behind dedupe/active cap
});

test('retry respects active cap', (t) => {
  const {svc} = setup(t);
  const id = svc.submit('alice', D1).job.id;
  svc.markRunning(id);
  svc.fail(id, 'PROVIDER_TIMEOUT');
  svc.submit('alice', D2);
  svc.submit('alice', D3);
  svc.submit('alice', D4);
  assertCode(() => svc.retry('alice', id), 'TOO_MANY_ACTIVE_JOBS');
  assert.equal(svc.get('alice', id).status, 'FAILED');
});

test('remove cancels queued, deletes terminal, rejects running', async (t) => {
  const {svc, files} = setup(t);
  const q = svc.submit('alice', D1).job.id;
  svc.remove('alice', q);
  assert.equal(svc.get('alice', q).status, 'CANCELLED');
  svc.remove('alice', q);
  assertCode(() => svc.get('alice', q), 'JOB_NOT_FOUND');

  const r = svc.submit('alice', D2).job.id;
  svc.markRunning(r);
  assertCode(() => svc.remove('alice', r), 'JOB_RUNNING');

  svc.succeed(r, 'doc', await files.write(r, new Uint8Array(5)));
  svc.remove('alice', r);
  assert.equal(files.find(r), null);
});

test('markRunning skips cancelled job', (t) => {
  const {svc} = setup(t);
  const q = svc.submit('alice', D1).job.id;
  svc.remove('alice', q);
  assert.equal(svc.markRunning(q), null);
});

test('expire removes file and marks expired', async (t) => {
  const s = setup(t);
  const id = s.svc.submit('alice', D1).job.id;
  s.svc.markRunning(id);
  s.svc.succeed(id, 'doc', await s.files.write(id, new Uint8Array(5)));
  s.now = new Date(s.now.getTime() + 6 * DAY);
  s.svc.expire();
  assert.equal(s.svc.get('alice', id).status, 'SUCCEEDED');
  s.now = new Date(s.now.getTime() + 2 * DAY);
  s.svc.expire();
  assert.equal(s.svc.get('alice', id).status, 'EXPIRED');
  assert.equal(s.files.find(id), null);
});
