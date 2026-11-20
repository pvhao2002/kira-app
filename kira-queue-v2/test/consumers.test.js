import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHandlers, consumeQueue, setupTopology, startConsumers, QUEUES, EXCHANGE } from '../src/rabbit.js';
import { EventEmitter } from 'node:events';
import { loadConfig } from '../src/config.js';

function fakeConn(events = []) {
  const channels = [];
  return {
    channels,
    async createChannel() {
      const ch = Object.assign(new EventEmitter(), {
        queues: [], bindings: [], exchanges: [], consumers: new Map(), prefetchCount: null, closed: false,
        async assertExchange(...a) { ch.exchanges.push(a); },
        async assertQueue(...a) { ch.queues.push(a); },
        async bindQueue(...a) { ch.bindings.push(a); },
        async prefetch(n) { ch.prefetchCount = n; },
        async consume(queue, cb, opts) { ch.consumers.set(queue, cb); ch.opts = opts; return { consumerTag: `tag-${queue}` }; },
        ack(msg) { events.push(['ack', msg.n]); },
        nack(msg) { events.push(['nack', msg.n]); },
        async cancel() { events.push(['cancel']); },
        async close() { ch.closed = true; ch.emit('close'); },
        deliver(queue, text, n = 0) { ch.consumers.get(queue)({ content: Buffer.from(text), n }); },
      });
      channels.push(ch);
      return ch;
    },
  };
}
const tick = () => new Promise((r) => setImmediate(r));

test('broker-closed channel: error is logged (no throw) and onUnexpectedClose fires; stop() close does not', async () => {
  const closed = [];
  const conn = fakeConn();
  const c = await startConsumers(conn, loadConfig({ KIRA_QUEUE_CONSUMER_EVENT_ENABLED: 'true', KIRA_QUEUE_CONSUMER_SETTLE_ENABLED: 'true' }),
    { event() {}, settle() {} }, { onUnexpectedClose: (q) => closed.push(q) });
  const [, eventCh] = conn.channels;
  eventCh.emit('error', new Error('PRECONDITION_FAILED - delivery acknowledgement timed out')); // must not throw
  eventCh.emit('close');
  assert.deepEqual(closed, ['event']);
  await c.stop();
  assert.deepEqual(closed, ['event']); // closes from stop() are expected
});

test('prediction parallelism = concurrency even when prefetch is smaller (v1 ran `concurrency` threads)', async () => {
  const conn = fakeConn();
  await startConsumers(conn, loadConfig({
    KIRA_QUEUE_CONSUMER_PREDICT_ENABLED: 'true', KIRA_QUEUE_PREDICT_CONCURRENCY: '4', KIRA_QUEUE_PREDICT_PREFETCH: '1',
  }), { prediction() {} });
  assert.equal(conn.channels.find((ch) => ch.consumers.has('prediction')).prefetchCount, 4);
});

test('topology: durable direct exchange, 4 durable queues with no extra args, same routing keys as v1', async () => {
  const conn = fakeConn();
  const ch = await conn.createChannel();
  await setupTopology(ch);
  assert.deepEqual(ch.exchanges, [['crawl_exchange', 'direct', { durable: true }]]);
  assert.deepEqual(ch.queues, [['crawlByDate', { durable: true }], ['event', { durable: true }], ['prediction', { durable: true }], ['prediction-settle', { durable: true }]]);
  assert.deepEqual(ch.bindings, [
    ['crawlByDate', EXCHANGE, 'crawl.crawlByDate'], ['event', EXCHANGE, 'crawl.event'],
    ['prediction', EXCHANGE, 'crawl.prediction'], ['prediction-settle', EXCHANGE, 'crawl.prediction-settle'],
  ]);
  assert.equal(QUEUES.settle.queue, 'prediction-settle');
});

test('ack happens only after the handler settles, and the receive callback does not block', async () => {
  const events = [];
  const conn = fakeConn(events);
  let release;
  const gate = new Promise((r) => { release = r; });
  await consumeQueue(conn, { queue: 'q', handler: async () => { events.push(['start']); await gate; events.push(['done']); } });
  const ch = conn.channels[0];
  ch.deliver('q', 'x', 1);
  assert.deepEqual(events, [['start']]); // callback returned while the handler is still pending
  await tick();
  assert.deepEqual(events, [['start']]); // no ack yet
  release();
  await tick(); await tick();
  assert.deepEqual(events, [['start'], ['done'], ['ack', 1]]);
  assert.equal(ch.prefetchCount, 1);
  assert.deepEqual(ch.opts, { noAck: false });
});

test('a failing handler is still acked (v1 swallowed listener exceptions)', async () => {
  const events = [];
  const conn = fakeConn(events);
  await consumeQueue(conn, { queue: 'q', handler: async () => { throw new Error('boom'); } });
  conn.channels[0].deliver('q', 'x', 7);
  await tick(); await tick();
  assert.deepEqual(events, [['ack', 7]]);
});

test('date consumer waits 2000 ms before acking', async () => {
  const events = [];
  const conn = fakeConn(events);
  const handlers = { date: async () => { events.push(['handled']); } };
  const sleeps = [];
  const consumers = await startConsumers(conn, loadConfig({ KIRA_QUEUE_CONSUMER_DATE_ENABLED: 'true' }), handlers, {
    sleep: async (ms) => { sleeps.push(ms); events.push(['sleep', ms]); },
  });
  const ch = conn.channels.at(-1);
  ch.deliver('crawlByDate', '20260101', 3);
  await tick(); await tick();
  assert.deepEqual(events, [['handled'], ['sleep', 2000], ['ack', 3]]);
  assert.equal(ch.prefetchCount, 1);
  await consumers.stop();
});

test('only enabled consumers start: one channel each, topology channel closed', async () => {
  const conn = fakeConn();
  const handlers = { date() {}, event() {}, prediction() {}, settle() {} };
  await startConsumers(conn, loadConfig({}), handlers);
  assert.equal(conn.channels.length, 1); // topology only, nothing consumed
  assert.ok(conn.channels[0].closed);
  const conn2 = fakeConn();
  await startConsumers(conn2, loadConfig({ KIRA_QUEUE_CONSUMER_ENABLED: 'true', KIRA_QUEUE_CONSUMER_EVENT_ENABLED: 'false', KIRA_QUEUE_PREDICT_CONCURRENCY: '4' }), handlers);
  const consuming = conn2.channels.slice(1).map((c) => [...c.consumers.keys()][0]);
  assert.deepEqual(consuming, ['crawlByDate', 'prediction', 'prediction-settle']);
  const predict = conn2.channels.find((c) => c.consumers.has('prediction'));
  assert.equal(predict.prefetchCount, 4);
});

test('prediction queue runs messages in parallel up to the prefetch', async () => {
  const events = [];
  const conn = fakeConn(events);
  const gates = [];
  await consumeQueue(conn, { queue: 'prediction', parallel: 3, handler: () => new Promise((r) => { gates.push(r); }) });
  const ch = conn.channels[0];
  ch.deliver('prediction', 'a', 1);
  ch.deliver('prediction', 'b', 2);
  assert.equal(gates.length, 2); // both in flight at once
  gates[1]();
  await tick(); await tick();
  assert.deepEqual(events, [['ack', 2]]); // second finished first, acked first
  gates[0]();
  await tick(); await tick();
  assert.deepEqual(events, [['ack', 2], ['ack', 1]]);
  assert.equal(ch.prefetchCount, 3);
});

test('stop cancels, waits for in-flight handlers, then closes the channel; late messages are requeued', async () => {
  const events = [];
  const conn = fakeConn(events);
  let release;
  const c = await consumeQueue(conn, { queue: 'q', handler: () => new Promise((r) => { release = r; }) });
  const ch = conn.channels[0];
  ch.deliver('q', 'x', 1);
  let stopped = false;
  const stopping = c.stop().then(() => { stopped = true; });
  await tick();
  assert.equal(stopped, false);
  assert.equal(ch.closed, false);
  ch.deliver('q', 'late', 2);
  assert.deepEqual(events, [['cancel'], ['nack', 2]]);
  release();
  await stopping;
  assert.equal(ch.closed, true);
  assert.deepEqual(events.at(-1), ['ack', 1]);
});

// ---- payload parsing per queue ----
function recorders() {
  const calls = [];
  return {
    calls,
    crawlDateService: { crawlDate: async (d) => { calls.push(['dates', d]); } },
    crawlEventService: { processEvent: async (id) => { calls.push(['event', id]); } },
    predictService: { predict: async (p) => { calls.push(['predict', p]); } },
    settleService: { settleEvent: async (id) => { calls.push(['settle', id]); } },
  };
}

test('date payload: comma separated, trimmed, empties dropped, blank ignored', async () => {
  const r = recorders();
  const h = buildHandlers(r);
  await h.date('20260101, 20260102 ,,');
  await h.date('  ');
  await h.date(',');
  assert.deepEqual(r.calls, [['dates', ['20260101', '20260102']]]);
});

test('date handler swallows crawl failures', async () => {
  const r = recorders();
  r.crawlDateService.crawlDate = async () => { throw new Error('x'); };
  await buildHandlers(r).date('20260101');
});

test('event payload: ids processed in order, invalid ids skipped, failures isolated per id', async () => {
  const r = recorders();
  r.crawlEventService.processEvent = async (id) => { r.calls.push(['event', id]); if (id === 2) throw new Error('x'); };
  await buildHandlers(r).event('1, 2,abc,,3');
  assert.deepEqual(r.calls, [['event', 1], ['event', 2], ['event', 3]]);
});

test('prediction payload is passed through raw (service parses {eventId,versionCode} or bare id)', async () => {
  const r = recorders();
  const h = buildHandlers(r);
  await h.prediction('{"eventId":1,"versionCode":"NO_PRICE"}');
  await h.prediction('55');
  assert.deepEqual(r.calls, [['predict', '{"eventId":1,"versionCode":"NO_PRICE"}'], ['predict', '55']]);
  r.predictService.predict = async () => { throw new Error('x'); };
  await h.prediction('1'); // must not throw
});

test('settle payload: {eventId} or bare id; garbage and failures are swallowed', async () => {
  const r = recorders();
  const h = buildHandlers(r);
  await h.settle('{"eventId":9}');
  await h.settle(' 10 ');
  await h.settle('nope');
  await h.settle('');
  assert.deepEqual(r.calls, [['settle', 9], ['settle', 10]]);
  r.settleService.settleEvent = async () => { throw new Error('x'); };
  await h.settle('1');
});
