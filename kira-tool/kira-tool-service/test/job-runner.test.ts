import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {errors} from 'patchright';
import {JobRepository, JobService, openDb, type JobQueue} from '../src/jobs.ts';
import {JobRunner, sanitize, type Deadline, type Extracted, type Extractor} from '../src/runner.ts';
import {FileStore} from '../src/file-store.ts';
import {ToolError} from '../src/errors.ts';

const D1 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS1/view';
const D2 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS2/view';
const D3 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS3/view';

type Behavior = (d: Deadline) => Promise<Extracted>;

function setup(t: {after: (fn: () => void) => void}) {
  const dir = mkdtempSync(join(tmpdir(), 'tool-run-'));
  const s = {
    queue: {enqueue: () => {}} as JobQueue,
    behavior: (async () => ({pdf: new Uint8Array(1), displayName: 'x'})) as Behavior,
    calls: 0,
    files: new FileStore(dir, 1000),
  } as {queue: JobQueue; behavior: Behavior; calls: number; files: FileStore; svc: JobService; runner: JobRunner;
    make: (extractors: Extractor[], workers: number, queueSize: number, timeoutMs: number) => JobRunner};
  s.svc = new JobService(new JobRepository(openDb(':memory:')), {enqueue: (id) => s.queue.enqueue(id)}, s.files,
    () => new Date(), 7);
  const fake: Extractor = {
    provider: 'DRIVE',
    async extract(_job, d, progress) {
      s.calls++;
      progress('WORKING', 50);
      return s.behavior(d);
    },
  };
  s.make = (extractors, workers, queueSize, timeoutMs) => new JobRunner(s.svc, s.files, extractors, workers, queueSize, timeoutMs);
  s.runner = s.make([fake], 1, 1, 5000);
  t.after(() => {
    s.runner.shutdown();
    rmSync(dir, {recursive: true, force: true});
  });
  return s;
}

const newJob = (svc: JobService, url: string) => svc.submit('alice', url).job.id;

test('navigation URL follows redirects, survives failure and resets on retry', async (t) => {
  const s = setup(t);
  const redirected = 'https://www.scribd.com/document/12345?view=1';
  const runner = s.make([{
    provider: 'DRIVE',
    async extract(_job, _deadline, _progress, _screenshot, navigation) {
      navigation?.(D1);
      assert.equal(s.svc.get('alice', _job.id).currentUrl, D1);
      navigation?.(redirected);
      throw new ToolError('PROVIDER_BLOCKED');
    },
  }], 1, 1, 5000);
  const id = newJob(s.svc, D1);
  assert.equal(s.svc.get('alice', id).currentUrl, null);
  await runner.run(id);
  assert.equal(s.svc.get('alice', id).currentUrl, redirected);
  assert.equal(s.svc.get('alice', id).status, 'FAILED');
  assert.equal(s.svc.retry('alice', id).currentUrl, null);
  runner.shutdown();
});

test('success writes file and succeeds', async (t) => {
  const s = setup(t);
  s.behavior = async () => ({pdf: new Uint8Array([1, 2, 3]), displayName: 'my:doc/name'});
  const id = newJob(s.svc, D1);
  await s.runner.run(id);
  const job = s.svc.get('alice', id);
  assert.equal(job.status, 'SUCCEEDED');
  assert.equal(job.progress, 100);
  assert.equal(job.fileSize, 3);
  assert.equal(job.displayName, 'mydocname');
  assert.deepEqual([...readFileSync(s.files.find(id)!)], [1, 2, 3]);
});

test('unexpected exception becomes extraction failed', async (t) => {
  const s = setup(t);
  s.behavior = async () => { throw new Error('secret https://private/url'); };
  const id = newJob(s.svc, D1);
  await s.runner.run(id);
  const job = s.svc.get('alice', id);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.errorCode, 'PROVIDER_EXTRACTION_FAILED');
  assert.equal(s.files.find(id), null);
});

test('a failed extractor preserves its screenshot and a later attempt without one clears it', async (t) => {
  const s = setup(t);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  let capture = true;
  const runner = s.make([{
    provider: 'DRIVE',
    async extract(_job, _deadline, _progress, screenshot) {
      if (capture) screenshot?.(jpeg);
      throw new ToolError('PROVIDER_BLOCKED');
    },
  }], 1, 1, 5000);
  t.after(() => runner.shutdown());
  const id = newJob(s.svc, D1);
  await runner.run(id);
  assert.equal(s.svc.get('alice', id).errorCode, 'PROVIDER_BLOCKED');
  assert.deepEqual(s.files.screenshot(id), Buffer.from(jpeg));

  capture = false;
  s.svc.retry('alice', id);
  await runner.run(id);
  assert.equal(s.svc.get('alice', id).status, 'FAILED');
  assert.equal(s.files.screenshot(id), null);
});

test('abort becomes interrupted', async (t) => {
  // Node has no thread interrupts; an AbortError is the closest equivalent of InterruptedException.
  const s = setup(t);
  s.behavior = async () => { throw new DOMException('aborted', 'AbortError'); };
  const id = newJob(s.svc, D1);
  await s.runner.run(id);
  const job = s.svc.get('alice', id);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.errorCode, 'INTERRUPTED');
});

test('stack overflow does not leave job running', async (t) => {
  const s = setup(t);
  const recurse = (n: number): number => recurse(n + 1) + 1;
  s.behavior = async () => { recurse(0); throw new Error('unreachable'); };
  const id = newJob(s.svc, D1);
  await s.runner.run(id);
  const job = s.svc.get('alice', id);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.errorCode, 'INTERNAL_ERROR');
});

test('missing extractor becomes extraction failed', async (t) => {
  const s = setup(t);
  const bare = s.make([], 1, 1, 5000);
  try {
    const id = newJob(s.svc, D1);
    await bare.run(id);
    assert.equal(s.svc.get('alice', id).errorCode, 'PROVIDER_EXTRACTION_FAILED');
  } finally {
    bare.shutdown();
  }
});

test('sanitize truncates by code point', () => {
  const s = sanitize('a'.repeat(99) + '😀😀');
  assert.equal([...s].length, 100);
  assert.ok(s.endsWith('😀'));
  assert.equal(sanitize('  a\u0000b \t\n c  '), 'ab c');
  assert.equal(sanitize(null), 'document');
});

test('tool error code is preserved', async (t) => {
  const s = setup(t);
  s.behavior = async () => ({pdf: new Uint8Array(2000), displayName: 'big'});
  const id = newJob(s.svc, D1);
  await s.runner.run(id);
  assert.equal(s.svc.get('alice', id).errorCode, 'FILE_TOO_LARGE');
});

test('cooperative deadline gives provider timeout', async (t) => {
  const s = setup(t);
  s.runner.shutdown();
  s.runner = s.make([{provider: 'DRIVE', extract: (_j, d) => s.behavior(d)}], 1, 1, 30);
  s.behavior = async (d) => {
    for (;;) {
      d.check();
      await sleep(5);
    }
  };
  const id = newJob(s.svc, D1);
  await s.runner.run(id);
  const job = s.svc.get('alice', id);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.errorCode, 'PROVIDER_TIMEOUT');
});

test('playwright timeout gives provider timeout', async (t) => {
  const s = setup(t);
  s.behavior = async () => { throw new errors.TimeoutError('nav'); };
  const id = newJob(s.svc, D1);
  await s.runner.run(id);
  assert.equal(s.svc.get('alice', id).errorCode, 'PROVIDER_TIMEOUT');
});

test('cancelled job is not extracted', async (t) => {
  const s = setup(t);
  const id = newJob(s.svc, D1);
  s.svc.remove('alice', id);
  await s.runner.run(id);
  assert.equal(s.calls, 0);
});

test('full queue rejects with queue full', async (t) => {
  const s = setup(t);
  const release = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  s.behavior = async () => {
    started.resolve();
    await release.promise;
    return {pdf: new Uint8Array(1), displayName: 'x'};
  };
  s.queue = s.runner;
  newJob(s.svc, D1);
  await started.promise;
  newJob(s.svc, D2); // takes the single queue slot
  assert.throws(() => newJob(s.svc, D3), (e: unknown) => e instanceof ToolError && e.code === 'QUEUE_FULL');
  assert.equal(s.svc.list('alice').length, 2);
  release.resolve();
  for (let i = 0; i < 200 && s.svc.list('alice').some((j) => j.status === 'QUEUED' || j.status === 'RUNNING'); i++) {
    await sleep(25); // let workers finish before the temp dir is removed
  }
  assert.ok(s.svc.list('alice').every((j) => j.status === 'SUCCEEDED'));
});
