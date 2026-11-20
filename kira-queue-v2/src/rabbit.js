import amqp from 'amqplib';
import { hasText, sleep as realSleep } from './util.js';
import { log } from './log.js';
import { parseSettleEventId } from './service/predict.js';

// Names and routing keys must stay identical to kira-queue (and kira-producer): queues are declared
// durable with NO extra arguments, otherwise an existing queue fails with PRECONDITION_FAILED.
export const EXCHANGE = 'crawl_exchange';
export const QUEUES = Object.freeze({
  date: { queue: 'crawlByDate', routingKey: 'crawl.crawlByDate' },
  event: { queue: 'event', routingKey: 'crawl.event' },
  prediction: { queue: 'prediction', routingKey: 'crawl.prediction' },
  settle: { queue: 'prediction-settle', routingKey: 'crawl.prediction-settle' },
});
const DATE_DELAY_MS = 2000; // pause after each date message so the crawl is not hammered

export async function setupTopology(ch) {
  await ch.assertExchange(EXCHANGE, 'direct', { durable: true });
  for (const { queue, routingKey } of Object.values(QUEUES)) {
    await ch.assertQueue(queue, { durable: true });
    await ch.bindQueue(queue, EXCHANGE, routingKey);
  }
}

/** Payload handlers; each swallows its own failures (v1 listeners never rethrow, so every message is acked). */
export function buildHandlers({ crawlDateService, crawlEventService, predictService, settleService }) {
  return {
    async date(payload) {
      if (!hasText(payload)) return;
      const dates = payload.split(',').map((d) => d.trim()).filter((d) => d !== '');
      if (dates.length === 0) return;
      try {
        await crawlDateService.crawlDate(dates);
      } catch (e) {
        log.error(`handleDate failed: ${e?.message}`);
      }
    },

    async event(payload) {
      if (!hasText(payload)) return;
      for (const raw of payload.split(',')) {
        const id = raw.trim();
        if (id === '') continue;
        if (!/^[+-]?\d+$/.test(id)) {
          log.warn(`handleEvent: invalid event id "${id}"`);
          continue;
        }
        try {
          await crawlEventService.processEvent(Number.parseInt(id, 10));
        } catch (e) {
          log.error(`handleEvent: failed for id ${id}: ${e?.message}`);
        }
      }
    },

    async prediction(payload) {
      try {
        await predictService.predict(payload);
      } catch (e) {
        log.error(`Prediction job failed: ${e?.message}`);
      }
    },

    async settle(payload) {
      try {
        const eventId = parseSettleEventId(payload);
        if (eventId === null) {
          log.warn('Settle job missing eventId');
          return;
        }
        await settleService.settleEvent(eventId);
      } catch (e) {
        log.error(`Settle job failed: ${e?.message}`);
      }
    },
  };
}

/**
 * Consumes one queue on its own channel. The receive callback only schedules work: the handler runs
 * asynchronously (never blocking the AMQP frame loop) and the message is acked after it settles.
 * `parallel` messages may be in flight (= channel prefetch), 1 keeps strict order.
 * A channel closed by the broker (e.g. consumer_timeout) calls `onUnexpectedClose`; without an 'error'
 * listener amqplib's emit would throw and crash the process.
 */
export async function consumeQueue(conn, { queue, handler, parallel = 1, delayMs = 0, sleep = realSleep, onUnexpectedClose = () => {} }) {
  const ch = await conn.createChannel();
  const inflight = new Set();
  let stopped = false;
  ch.on('error', (e) => log.error(`consumer ${queue} channel error: ${e?.message}`));
  ch.on('close', () => {
    if (!stopped) onUnexpectedClose(queue);
  });
  await ch.prefetch(parallel);

  const { consumerTag } = await ch.consume(queue, (msg) => {
    if (msg === null) return; // consumer cancelled by the broker
    if (stopped) {
      try {
        ch.nack(msg, false, true);
      } catch {
        /* channel closing */
      }
      return;
    }
    const work = (async () => {
      try {
        await handler(msg.content.toString('utf8'));
      } catch (e) {
        log.error(`consumer ${queue} handler error: ${e?.message}`);
      }
      if (delayMs > 0) await sleep(delayMs);
      try {
        ch.ack(msg);
      } catch (e) {
        log.warn(`consumer ${queue} ack failed: ${e?.message}`);
      }
    })();
    inflight.add(work);
    work.finally(() => inflight.delete(work));
  }, { noAck: false });
  log.info(`Consuming queue ${queue} (parallel=${parallel})`);

  return {
    queue,
    async stop() {
      stopped = true;
      try {
        await ch.cancel(consumerTag);
      } catch {
        /* already closed */
      }
      await Promise.allSettled([...inflight]);
      try {
        await ch.close();
      } catch {
        /* already closed */
      }
    },
  };
}

export async function startConsumers(conn, config, handlers, { sleep = realSleep, onUnexpectedClose } = {}) {
  const c = config.consumer;
  const topology = await conn.createChannel();
  await setupTopology(topology);
  await topology.close();

  const plan = [];
  if (c.dateEnabled) plan.push({ ...QUEUES.date, handler: handlers.date, parallel: 1, delayMs: DATE_DELAY_MS });
  if (c.eventEnabled) plan.push({ ...QUEUES.event, handler: handlers.event, parallel: 1 });
  if (c.predictEnabled) {
    const concurrency = c.predictConcurrency > 0 ? c.predictConcurrency : 8;
    // v1 ran `concurrency` listener threads, so `concurrency` messages ran in parallel. KIRA_QUEUE_PREDICT_PREFETCH
    // only sized v1's per-thread buffer and is ignored here.
    plan.push({ ...QUEUES.prediction, handler: handlers.prediction, parallel: concurrency });
  }
  if (c.settleEnabled) plan.push({ ...QUEUES.settle, handler: handlers.settle, parallel: 1 });

  const started = [];
  for (const p of plan) started.push(await consumeQueue(conn, { ...p, sleep, onUnexpectedClose }));
  return { stop: () => Promise.allSettled(started.map((s) => s.stop())) };
}

export function connectRabbit(cfg) {
  return amqp.connect({
    protocol: 'amqp', hostname: cfg.host, port: cfg.port, username: cfg.username, password: cfg.password,
    vhost: cfg.vhost, heartbeat: cfg.heartbeat, timeout: cfg.connectionTimeoutMs,
  });
}
