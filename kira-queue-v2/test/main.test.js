import test from 'node:test';
import assert from 'node:assert/strict';
import { createLifecycle } from '../src/main.js';

function fakes(calls) {
  return {
    server: {
      close(cb) { calls.push('server.close'); this.cb = cb; },
      closeIdleConnections() { calls.push('server.idle'); this.cb(); },
      closeAllConnections() { calls.push('server.all'); },
    },
    browser: { async closeAllLanes() { calls.push('lanes'); } },
    pool: { async end() { calls.push('pool'); } },
    conn: { async close() { calls.push('conn'); } },
    consumers: { async stop() { calls.push('consumers'); } },
  };
}

test('shutdown order: consumers, server, lanes, connection, pool, then exit(0); second signal ignored', async () => {
  const calls = [];
  const life = createLifecycle(fakes(calls), { exit: (c) => calls.push(`exit ${c}`) });
  await life.shutdown('SIGTERM');
  await life.shutdown('SIGINT');
  assert.deepEqual(calls, ['consumers', 'server.close', 'server.idle', 'lanes', 'conn', 'pool', 'exit 0']);
});

test('hung HTTP request is force-closed after the grace period', async () => {
  const calls = [];
  const res = fakes(calls);
  res.server.closeIdleConnections = () => calls.push('server.idle'); // a request stays open
  res.server.closeAllConnections = () => { calls.push('server.all'); res.server.cb(); };
  await createLifecycle(res, { exit: (c) => calls.push(`exit ${c}`), graceMs: 5 }).shutdown('SIGTERM');
  assert.deepEqual(calls, ['consumers', 'server.close', 'server.idle', 'server.all', 'lanes', 'conn', 'pool', 'exit 0']);
});

test('without rabbit (conn/consumers null) shutdown still closes server, lanes and pool', async () => {
  const calls = [];
  const res = { ...fakes(calls), conn: null, consumers: null };
  await createLifecycle(res, { exit: (c) => calls.push(`exit ${c}`) }).shutdown('SIGTERM');
  assert.deepEqual(calls, ['server.close', 'server.idle', 'lanes', 'pool', 'exit 0']);
});

test('unexpected close exits 1, but not during shutdown', async () => {
  const exits = [];
  const life = createLifecycle(fakes([]), { exit: (c) => exits.push(c) });
  life.onUnexpectedClose('RabbitMQ connection');
  assert.deepEqual(exits, [1]);
  await life.shutdown('SIGTERM');
  life.onUnexpectedClose('RabbitMQ connection');
  assert.deepEqual(exits, [1, 0]);
});

test('a failing shutdown step exits 1', async () => {
  const exits = [];
  const res = fakes([]);
  res.browser.closeAllLanes = async () => { throw new Error('x'); };
  await createLifecycle(res, { exit: (c) => exits.push(c) }).shutdown('SIGTERM');
  assert.deepEqual(exits, [1]);
});
