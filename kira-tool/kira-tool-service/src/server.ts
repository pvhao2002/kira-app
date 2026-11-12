import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createApp} from './app.ts';
import {loadConfig} from './config.ts';
import {driveExtractor, scribdExtractor} from './extractors.ts';
import {FileStore} from './file-store.ts';
import {JobRepository, JobService, openDb} from './jobs.ts';
import {JobRunner} from './runner.ts';

const HOUR_MS = 3_600_000;

const cfg = loadConfig(process.env);
mkdirSync(cfg.dataDir, {recursive: true});
const files = new FileStore(cfg.storageDir, cfg.maxFileBytes);
const repo = new JobRepository(openDb(join(cfg.dataDir, 'tool.db')));
// The runner needs the service and the service needs a queue: the late-bound wrapper breaks the cycle.
let runner: JobRunner;
const jobs = new JobService(repo, {enqueue: (id) => runner.enqueue(id)}, files, () => new Date(), cfg.retentionDays);
runner = new JobRunner(jobs, files, [driveExtractor(cfg.headless), scribdExtractor(cfg.headless)], cfg.workers,
  cfg.queueSize, cfg.jobTimeoutMs);

const app = createApp({jobs, files, cookieSecure: cfg.cookieSecure, forwardHeaders: cfg.forwardHeaders});
const server = app.listen(cfg.port, () => {
  console.info(`kira-tool-service listening port=${cfg.port}`);
  jobs.recover();
  // TTL cleanup: first run after 1 minute, then hourly (fixed delay).
  setTimeout(function expire() {
    try {
      jobs.expire();
    } catch (e) {
      console.error(`expire failed errorType=${(e as Error).name}`);
    }
    setTimeout(expire, HOUR_MS).unref();
  }, 60_000).unref();
});

function shutdown(): void {
  // No cancellation of running browsers: their rows stay RUNNING and dropped waiting rows stay QUEUED, and
  // JobService.recover() requeues both on next start. patchright kills its browsers when the process exits.
  runner.shutdown();
  server.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
