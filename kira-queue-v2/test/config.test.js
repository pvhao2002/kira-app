import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { loadConfig } from '../src/config.js';
import { batchInsertSafe, createDb } from '../src/db.js';

test('consumer flags default to false', () => {
  const c = loadConfig({});
  assert.deepEqual(
    [c.consumer.dateEnabled, c.consumer.eventEnabled, c.consumer.predictEnabled, c.consumer.settleEnabled],
    [false, false, false, false],
  );
  assert.equal(c.consumer.predictConcurrency, 8);
});

test('specific flag overrides the global KIRA_QUEUE_CONSUMER_ENABLED fallback', () => {
  const c = loadConfig({ KIRA_QUEUE_CONSUMER_ENABLED: 'true', KIRA_QUEUE_CONSUMER_EVENT_ENABLED: 'false' });
  assert.equal(c.consumer.dateEnabled, true);
  assert.equal(c.consumer.eventEnabled, false);
  assert.equal(c.consumer.predictEnabled, true);
  assert.equal(c.consumer.settleEnabled, true);
});

test('profile instance id: PLAYWRIGHT_INSTANCE_ID, then KIRA_CRAWL_INSTANCE_ID, then port2323', () => {
  assert.equal(loadConfig({}).playwright.profileInstanceId, 'port2323');
  assert.equal(loadConfig({ KIRA_CRAWL_INSTANCE_ID: 'k' }).playwright.profileInstanceId, 'k');
  assert.equal(loadConfig({ PLAYWRIGHT_INSTANCE_ID: 'p', KIRA_CRAWL_INSTANCE_ID: 'k' }).playwright.profileInstanceId, 'p');
});

test('defaults match application.yml', () => {
  const c = loadConfig({});
  assert.equal(c.db.port, 3310);
  assert.equal(c.rabbit.vhost, '/');
  assert.equal(c.playwright.verificationTimeoutMs, 120000);
  assert.equal(c.playwright.acceptLanguage, 'en-US,en;q=0.9');
  assert.equal(c.playwright.channel, 'chrome');
  assert.equal(c.extension.tokenSha256, '');
});

test('.env.example names are read by config and its values equal the code defaults', () => {
  const example = parseEnv(readFileSync(new URL('../.env.example', import.meta.url), 'utf8'));
  // Read by log.js / docker-entrypoint.sh, not by loadConfig.
  const notConfig = new Set(['LOG_DIR', 'INSTANCE_ID', 'KIRA_QUEUE_REMOTE_DISPLAY_ENABLED', 'KIRA_QUEUE_NOVNC_PORT',
    'KIRA_QUEUE_VNC_PORT', 'KIRA_QUEUE_VNC_PASSWORD_FILE']);
  const read = new Set();
  const env = new Proxy(example, { get: (t, k) => (read.add(k), t[k]) });
  assert.deepEqual(loadConfig(env), loadConfig({}));
  for (const name of Object.keys(example)) {
    if (!notConfig.has(name)) assert.ok(read.has(name), `${name} in .env.example is not read by loadConfig`);
  }
});

// JdbcBatchUtilsTest port
const lockErr = Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' });
const dupErr = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });

test('outside tx the failed row is retried once, then the rest continue row by row', async () => {
  const calls = [];
  const db = {
    async update(_s, p) {
      calls.push(p.a);
      if (p.a === 1) throw lockErr;
    },
  };
  await batchInsertSafe(db, 'insert', [{ a: 1 }, { a: 2 }], false);
  assert.deepEqual(calls, [1, 1, 2]);
});

test('outside tx a transient failure is written on the retry', async () => {
  const written = [];
  let failed = false;
  const db = {
    async update(_s, p) {
      if (p.a === 2 && !failed) { failed = true; throw lockErr; }
      written.push(p.a);
    },
  };
  await batchInsertSafe(db, 'insert', [{ a: 1 }, { a: 2 }, { a: 3 }], false);
  assert.deepEqual(written, [1, 2, 3]);
});

test('consumer flags enable only on "true" (v1 @ConditionalOnProperty havingValue="true")', () => {
  assert.equal(loadConfig({ KIRA_QUEUE_CONSUMER_ENABLED: '1' }).consumer.dateEnabled, false);
  assert.equal(loadConfig({ KIRA_QUEUE_CONSUMER_DATE_ENABLED: 'yes' }).consumer.dateEnabled, false);
  assert.equal(loadConfig({ KIRA_QUEUE_CONSUMER_DATE_ENABLED: 'TRUE' }).consumer.dateEnabled, true);
});

// ---- createDb.withTx ----
function fakePool() {
  const calls = [];
  const conn = {
    async query() { calls.push('query'); return [[]]; },
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); if (conn.rollbackFails) throw new Error('lost'); },
    release() { calls.push('release'); },
  };
  return { calls, conn, async getConnection() { calls.push('get'); return conn; } };
}

test('withTx commits and releases on success', async () => {
  const pool = fakePool();
  const out = await createDb(pool, false, pool).withTx(async (tx) => { await tx.query('x'); return 7; });
  assert.equal(out, 7);
  assert.deepEqual(pool.calls, ['get', 'begin', 'query', 'commit', 'release']);
});

test('withTx rolls back, releases and rethrows on error', async () => {
  const pool = fakePool();
  await assert.rejects(createDb(pool, false, pool).withTx(async () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(pool.calls, ['get', 'begin', 'rollback', 'release']);
});

test('withTx swallows a rollback failure and rethrows the original error', async () => {
  const pool = fakePool();
  pool.conn.rollbackFails = true;
  await assert.rejects(createDb(pool, false, pool).withTx(async () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(pool.calls, ['get', 'begin', 'rollback', 'release']);
});

test('nested withTx reuses the same connection (no second begin)', async () => {
  const pool = fakePool();
  await createDb(pool, false, pool).withTx((tx) => tx.withTx((inner) => inner.query('x')));
  assert.deepEqual(pool.calls, ['get', 'begin', 'query', 'commit', 'release']);
});

test('inside tx a lock failure propagates', async () => {
  const db = { async update() { throw lockErr; } };
  await assert.rejects(batchInsertSafe(db, 'insert', [{ a: 1 }, { a: 2 }], true), { code: 'ER_LOCK_DEADLOCK' });
});

test('inside tx non-lock failure is skipped, later lock failure propagates', async () => {
  let n = 0;
  const db = {
    async update() {
      n += 1;
      throw n === 1 ? dupErr : lockErr;
    },
  };
  await assert.rejects(batchInsertSafe(db, 'insert', [{ a: 1 }, { a: 2 }], true), { code: 'ER_LOCK_DEADLOCK' });
});

test('empty rows is a no-op', async () => {
  await batchInsertSafe({ update() { throw new Error('x'); } }, 'insert', [], false);
});
