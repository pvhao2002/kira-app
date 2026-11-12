import {ToolError, type ErrorCode} from './errors.ts';
import type {Job, JobQueue, JobService} from './jobs.ts';
import type {FileStore} from './file-store.ts';
import type {Provider} from './provider.ts';

/** displayName is untrusted page text; it is sanitized before storage and never used as a path. */
export interface Extracted {
  pdf: Uint8Array;
  displayName: string | null;
}

export type ProgressSink = (stage: string, percent: number) => void;
export type ScreenshotSink = (image: Uint8Array) => void;
export type NavigationSink = (url: string) => void;

/** Cooperative job deadline: extractor loops call check(); nothing is cancelled from outside. */
export interface Deadline {
  check(): void;
}

export interface Extractor {
  provider: Provider;
  /** Navigates only to job.canonicalUrl (rebuilt from the provider ID) and returns the rendered PDF. */
  extract(job: Job, deadline: Deadline, progress: ProgressSink, screenshot?: ScreenshotSink,
    navigation?: NavigationSink): Promise<Extracted>;
}

export function deadlineIn(ms: number): Deadline {
  const end = performance.now() + ms;
  return {
    check() {
      if (performance.now() > end) throw new ToolError('PROVIDER_TIMEOUT');
    },
  };
}

/** Bounded worker pool (workers running + queueSize waiting). Logs ids/codes only, never URLs. */
export class JobRunner implements JobQueue {
  private readonly jobs: JobService;
  private readonly files: FileStore;
  private readonly extractors: Map<Provider, Extractor>;
  private readonly workers: number;
  private readonly queueSize: number;
  private readonly timeoutMs: number;
  private readonly waiting: string[] = [];
  private active = 0;
  private closed = false;

  constructor(jobs: JobService, files: FileStore, extractors: Extractor[], workers: number, queueSize: number,
              timeoutMs: number) {
    this.jobs = jobs;
    this.files = files;
    this.extractors = new Map(extractors.map((e) => [e.provider, e]));
    this.workers = workers;
    this.queueSize = queueSize;
    this.timeoutMs = timeoutMs;
  }

  enqueue(jobId: string): void {
    if (this.closed) throw new ToolError('QUEUE_FULL');
    if (this.active < this.workers) this.start(jobId);
    else if (this.waiting.length < this.queueSize) this.waiting.push(jobId);
    else throw new ToolError('QUEUE_FULL');
  }

  private start(jobId: string): void {
    this.active++;
    // Deferred so the caller (a request handler) finishes before the job starts, like handing off to a thread.
    setImmediate(() => {
      this.run(jobId)
        .catch(() => console.error(`job id=${jobId} runner bookkeeping failed`))
        .finally(() => {
          this.active--;
          const next = this.closed ? undefined : this.waiting.shift();
          if (next) this.start(next);
        });
    });
  }

  async run(id: string): Promise<void> {
    const started = performance.now();
    const job = this.jobs.markRunning(id);
    if (!job) return;
    let failure: ErrorCode | null = null;
    let screenshot: Uint8Array | undefined;
    try {
      const extractor = this.extractors.get(job.provider);
      if (!extractor) throw new Error('no extractor');
      const out = await extractor.extract(job, deadlineIn(this.timeoutMs), (stage, pct) => this.jobs.progress(id, stage, pct),
        (image) => { screenshot = image; }, (url) => this.jobs.navigation(id, url));
      const size = await this.files.write(id, out.pdf);
      this.jobs.succeed(id, sanitize(out.displayName), size);
    } catch (e) {
      failure = failureCode(e);
    }
    if (failure) {
      this.files.delete(id);
      if (screenshot) this.files.rememberScreenshot(id, screenshot);
      this.jobs.fail(id, failure);
    }
    console.info(`job id=${id} provider=${job.provider} status=${failure ? 'FAILED' : 'SUCCEEDED'} errorCode=${failure}`
      + ` durationMs=${Math.round(performance.now() - started)}`);
  }

  shutdown(): void {
    // No cancellation: running browsers finish or die with the process. Their rows stay RUNNING and dropped waiting
    // rows stay QUEUED, and JobService.recover() requeues both on next start.
    this.closed = true;
    this.waiting.length = 0;
  }
}

function failureCode(e: unknown): ErrorCode {
  if (e instanceof ToolError) return e.code;
  const name = (e as Error | null)?.name;
  if (name === 'TimeoutError') return 'PROVIDER_TIMEOUT'; // patchright errors.TimeoutError
  if (name === 'AbortError') return 'INTERRUPTED';
  // Stack overflow (the JS analogue of a JVM Error) must not leave the job RUNNING until restart.
  if (e instanceof RangeError && /call stack/i.test(e.message)) return 'INTERNAL_ERROR';
  return 'PROVIDER_EXTRACTION_FAILED';
}

/** Page title is untrusted: drop path/shell-special and control chars, collapse spaces, cap length. */
export function sanitize(raw: string | null | undefined): string {
  let s = (raw ?? '').replace(/[\u0000-\u001f\u007f-\u009f\\/:*?"<>|]/g, '');
  s = s.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[ \t\n\u000b\f\r]+/g, ' ');
  const cps = [...s];
  if (cps.length > 100) s = cps.slice(0, 100).join('').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  return s === '' ? 'document' : s;
}
