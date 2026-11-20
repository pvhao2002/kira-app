import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { log } from './log.js';
import { createPool } from './db.js';
import { BrowserManager } from './browser/lane.js';
import { createFetchClient } from './browser/fetch-client.js';
import { createDateCrawler } from './crawl/date.js';
import { createEventCrawler } from './crawl/event.js';
import { MatchStatusLabelCache } from './mapper/match.js';
import { createCrawlDateService } from './service/crawl-date.js';
import { createCrawlEventService } from './service/crawl-event.js';
import { createPredictService } from './service/predict.js';
import { createOnDemandPredictService } from './service/on-demand-predict.js';
import { createOnDemandUrlPredictService } from './service/on-demand-url-predict.js';
import { createPredictionSupport } from './prediction/support.js';
import { createEngineRegistry } from './prediction/engines.js';
import { createActiveVersionCache } from './prediction/active-versions.js';
import { createSettleService } from './prediction/settle.js';
import { createHttpServer } from './http.js';
import { buildHandlers, connectRabbit, startConsumers } from './rabbit.js';

async function main() {
  const config = loadConfig();
  const { pool, db } = createPool(config.db);

  const statusLabels = new MatchStatusLabelCache();
  await statusLabels.load(db);

  const browser = new BrowserManager(config.playwright);
  const fetchClient = createFetchClient(config.playwright);
  const dateCrawler = createDateCrawler({ browser, fetchClient });
  const eventCrawler = createEventCrawler({ browser, fetchClient });
  const crawlDateService = createCrawlDateService({ db, dateCrawler, statusLabels });
  const crawlEventService = createCrawlEventService({ db, eventCrawler });

  const support = createPredictionSupport(db);
  const registry = createEngineRegistry({ db });
  const versionCache = createActiveVersionCache({ db });
  const predictService = createPredictService({ versionCache, registry, support });
  const settleService = createSettleService({ db });
  const onDemandPredict = createOnDemandPredictService({ crawlEventService, registry, support });
  const onDemandUrlPredict = createOnDemandUrlPredictService({ eventCrawler, registry, db });

  const server = createHttpServer({
    config, db, dateCrawler, eventCrawler, crawlDateService, crawlEventService, onDemandPredict, onDemandUrlPredict,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.server.port, resolve);
  });
  log.info(`kira-queue-v2 listening on :${config.server.port}${config.server.contextPath}`);

  // conn/consumers are filled in once RabbitMQ is up; the lifecycle reads them at shutdown time.
  const res = { server, browser, pool, conn: null, consumers: null };
  const life = createLifecycle(res);
  const c = config.consumer;
  if (c.dateEnabled || c.eventEnabled || c.predictEnabled || c.settleEnabled) {
    res.conn = await connectRabbit(config.rabbit);
    // ponytail: no in-process reconnect; exit so the supervisor (docker/systemd) restarts the worker. Add retry loop if needed.
    res.conn.on('error', (e) => log.error(`RabbitMQ connection error: ${e?.message}`));
    res.conn.on('close', () => life.onUnexpectedClose('RabbitMQ connection'));
    res.consumers = await startConsumers(
      res.conn,
      config,
      buildHandlers({ crawlDateService, crawlEventService, predictService, settleService }),
      { onUnexpectedClose: (queue) => life.onUnexpectedClose(`RabbitMQ channel for ${queue}`) },
    );
  }

  process.on('SIGTERM', () => life.shutdown('SIGTERM'));
  process.on('SIGINT', () => life.shutdown('SIGINT'));
}

/**
 * Shutdown order: stop consumers (wait for in-flight work), close the HTTP server (force-close hung
 * requests after `graceMs`), close browser lanes, the RabbitMQ connection, then the pool.
 * `res` = { server, browser, pool, conn?, consumers? }, read at call time.
 */
export function createLifecycle(res, { exit = (code) => process.exit(code), graceMs = 10000 } = {}) {
  let shuttingDown = false;
  return {
    onUnexpectedClose(what) {
      if (shuttingDown) return;
      log.error(`${what} closed unexpectedly; exiting`);
      exit(1);
    },
    async shutdown(signal) {
      if (shuttingDown) return;
      shuttingDown = true;
      log.info(`Received ${signal}; shutting down`);
      try {
        if (res.consumers) await res.consumers.stop(); // stop consuming, wait for in-flight handlers
        await new Promise((r) => {
          // Kept ref'd: shutdown awaits this timer, and it is cleared once the server closes.
          const force = setTimeout(() => res.server.closeAllConnections(), graceMs);
          res.server.close(() => {
            clearTimeout(force);
            r();
          });
          res.server.closeIdleConnections();
        });
        await res.browser.closeAllLanes();
        if (res.conn) await res.conn.close().catch(() => {});
        await res.pool.end();
        exit(0);
      } catch (e) {
        log.error(`Shutdown error: ${e?.message}`);
        exit(1);
      }
    },
  };
}

// Run only as the entry point (node src/main.js), so tests can import createLifecycle.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    log.error(`Startup failed: ${e?.message}`);
    process.exit(1);
  });
}
