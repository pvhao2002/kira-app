import {HttpErrorResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, DestroyRef, Injector, afterNextRender, computed, inject, signal
} from '@angular/core';
import {Subscription} from 'rxjs';
import {Job, JobStatus, JobsApi, ProblemDetail, isActive} from '../../core/api/jobs.api';
import {errorMessage} from './error-messages';
import {ProviderName, detectProvider} from './url-detect';

const POLL_MS = 3000;

const STATUS_LABEL: Record<JobStatus, string> = {
  QUEUED: 'Queued', RUNNING: 'Running', SUCCEEDED: 'Ready', FAILED: 'Failed', CANCELLED: 'Cancelled', EXPIRED: 'Expired'
};
const STAGE_LABEL: Record<string, string> = {
  QUEUED: 'Waiting in queue', STARTING: 'Starting', OPENING: 'Opening document', SCROLLING: 'Loading pages',
  EXTRACTING: 'Collecting pages', RENDERING: 'Building PDF'
};

// Manual fallback snippets, mirroring the service extractors. Drive enforces Trusted Types, so the Drive snippet
// builds the print tab with DOM calls only (no innerHTML / document.write).
const DRIVE_SNIPPET = `(() => {
  const imgs = [...document.querySelectorAll('img[src^="blob:https://drive.google.com/"]')];
  if (!imgs.length) return alert('No pages found. Scroll to the last page first.');
  const w = window.open('', '_blank');
  if (!w) return alert('Allow pop-ups for drive.google.com and run again.');
  const d = w.document;
  const style = d.createElement('style');
  style.textContent = '@page{margin:0}body{margin:0}img{display:block;width:100%;break-after:page}';
  d.head.append(style);
  for (const img of imgs) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const page = d.createElement('img');
    page.src = c.toDataURL('image/jpeg', 0.92);
    d.body.append(page);
  }
  setTimeout(() => w.print(), 1500);
})();`;

const SCRIBD_SNIPPET = `document.querySelectorAll('.document_scroller').forEach(el => el.className = '');
document.querySelectorAll('.toolbar_drop, .mobile_overlay').forEach(el => el.remove());`;

const RELATIVE = new Intl.RelativeTimeFormat('en', {numeric: 'auto'});
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000], ['second', 1000]
];

@Component({
  selector: 'app-jobs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- DOM order keeps the form first (mobile, screen readers); the grid moves the guide to the left on wide screens. -->
    <div class="layout">
    <div class="primary">
    <section class="sheet" aria-labelledby="title"><div class="paper">
      <h1 id="title">Turn a view-only document into a PDF</h1>
      <p class="lead">Paste a Google Drive or Scribd link that anyone can open. Every page is rendered and saved as one PDF.</p>

      <form (submit)="submit($event)" novalidate>
        <label for="url">Document link</label>
        <div class="row">
          <input id="url" name="url" type="url" inputmode="url" autocomplete="off" spellcheck="false"
                 placeholder="https://drive.google.com/file/d/..." enterkeyhint="go"
                 [value]="url()" (input)="onInput($any($event.target).value)"
                 [attr.aria-invalid]="url() && !detection().valid ? 'true' : null" aria-describedby="url-hint">
          <button class="btn primary" type="submit" [disabled]="submitting()" [attr.aria-busy]="submitting()">
            @if (submitting()) { <span class="spinner" aria-hidden="true"></span> Sending... } @else { Export PDF }
          </button>
        </div>
        <div class="below">
          <ul class="providers" aria-label="Supported sources">
            <li [class.on]="detection().provider === 'DRIVE'">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l6 10-4 7H6l-4-7z" /></svg>Google Drive
            </li>
            <li [class.on]="detection().provider === 'SCRIBD'">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6z M14 2v6h6" /></svg>Scribd
            </li>
          </ul>
          <p id="url-hint" class="hint" [class.bad]="url() && !detection().valid">{{ detection().hint }}</p>
        </div>
        @if (submitError(); as msg) {
          <p class="notice error" role="alert">{{ msg }}</p>
        }
        @if (submitted()) {
          <p class="notice ok" role="status">Export started. Follow its progress below.</p>
        }
      </form>
    </div></section>

    <div class="sr-only" aria-live="polite">{{ announcement() }}</div>

    <section class="exports" aria-labelledby="exports">
      <h2 id="exports">Your exports</h2>
      @if (actionError(); as msg) {
        <p class="notice error" role="alert">{{ msg }}</p>
      }
      @if (loading()) {
        <ul class="jobs" aria-hidden="true">
          <li class="job skeleton"></li>
          <li class="job skeleton"></li>
        </ul>
        <p class="sr-only">Loading...</p>
      } @else if (loadError() && jobs().length === 0) {
        <div class="notice error" role="alert">
          <p>Could not load your exports.</p>
          <button type="button" class="btn" (click)="refresh()">Try again</button>
        </div>
      } @else if (jobs().length === 0) {
        <div class="empty">
          <p><strong>No exports yet.</strong> Paste a link above to start one.</p>
          <p class="quiet">Finished PDFs stay for 7 days. This list lives in this browser only.</p>
        </div>
      } @else {
        @if (loadError()) {
          <p class="notice error" role="status">Could not refresh. Showing the last known state.
            <button type="button" class="btn" (click)="refresh()">Try again</button></p>
        }
        <ul class="jobs">
          @for (job of jobs(); track job.id) {
            <li class="job" [attr.data-status]="job.status">
              <div class="top">
                <span class="name">{{ job.displayName || providerName(job) + ' document' }}</span>
                <span class="badge" [attr.data-status]="job.status"><span class="dot" aria-hidden="true"></span>{{ statusLabel(job) }}</span>
              </div>
              <p class="meta">
                <span>{{ providerName(job) }}</span>
                <span>Added {{ relative(job.createdAt) }}</span>
                @if (job.status === 'SUCCEEDED' && job.fileSize !== null) { <span>{{ size(job.fileSize) }}</span> }
                @if (job.status === 'SUCCEEDED' && job.expiresAt) { <span>Deleted {{ relative(job.expiresAt) }}</span> }
              </p>
              @if (job.status === 'RUNNING' || job.status === 'QUEUED') {
                <div class="bar" [class.waiting]="job.status === 'QUEUED'" role="progressbar" aria-valuemin="0"
                     aria-valuemax="100" [attr.aria-valuenow]="job.progress" aria-label="Export progress">
                  <span [style.width.%]="job.progress"></span>
                </div>
                <p class="stage">{{ stageLabel(job) }} ({{ job.progress }}%)</p>
              }
              @if (job.currentUrl) {
                <p class="stage current-url">
                  {{ job.status === 'RUNNING' ? 'Accessing:' : 'Last accessed:' }}
                  <a [href]="job.currentUrl" target="_blank" rel="noopener noreferrer">{{ job.currentUrl }}</a>
                </p>
              }
              @if (job.status === 'FAILED') {
                <p class="error">{{ errorMessage(job.errorCode) }} You can also follow <em>Download manually</em>.</p>
                @if (job.hasScreenshot) {
                  <div class="failure-preview">
                    <button type="button" class="btn" [attr.aria-expanded]="previewing() === job.id"
                            (click)="previewing.set(previewing() === job.id ? null : job.id)">
                      {{ previewing() === job.id ? 'Hide screenshot' : 'Preview screenshot' }}
                    </button>
                    @if (previewing() === job.id) {
                      <img [src]="screenshotUrl(job)" alt="Browser screenshot captured when this export failed">
                    }
                  </div>
                }
              }
              @if (job.status === 'EXPIRED') {
                <p class="stage">{{ errorMessage('FILE_EXPIRED') }}</p>
              }
              @if (confirming() === job.id) {
                <div class="actions confirm" role="group" [attr.aria-label]="confirmText(job)"
                     (keydown.escape)="closeConfirm(job)">
                  <span class="question">{{ confirmText(job) }}</span>
                  <button type="button" class="btn danger-solid" (click)="remove(job)">
                    {{ job.status === 'QUEUED' ? 'Yes, cancel' : 'Yes, delete' }}
                  </button>
                  <button type="button" class="btn" [id]="'keep-' + job.id" (click)="closeConfirm(job)">Keep</button>
                </div>
              } @else {
                <div class="actions">
                  @if (job.status === 'SUCCEEDED') {
                    <a class="btn primary" [href]="fileUrl(job)" download>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16" /></svg>Download
                    </a>
                  }
                  @if (job.status === 'FAILED' && job.retryable) {
                    <button type="button" class="btn" (click)="retry(job)">Retry</button>
                  }
                  @if (job.status !== 'RUNNING') {
                    <button type="button" class="btn ghost-danger" [id]="'rm-' + job.id" (click)="askRemove(job)">
                      {{ job.status === 'QUEUED' ? 'Cancel' : 'Delete' }}
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </section>
    </div>

    <aside class="manual" aria-labelledby="manual">
      <h2 id="manual">Download manually</h2>
      <p class="intro">If an export fails, save the PDF yourself in Chrome or Edge on a computer.
        You need access to the document in that browser. Read a snippet before you run it.</p>
      <div class="switch" role="group" aria-label="Source">
        <button type="button" [attr.aria-pressed]="shownGuide() === 'DRIVE'" (click)="guide.set('DRIVE')">Google Drive</button>
        <button type="button" [attr.aria-pressed]="shownGuide() === 'SCRIBD'" (click)="guide.set('SCRIBD')">Scribd</button>
      </div>
      @if (shownGuide() === 'DRIVE') {
        <ol class="steps">
          <li>Open the Drive link and wait for the preview. Zoom in first for sharper pages.</li>
          <li>Scroll slowly to the last page so every page loads.</li>
          <li>Press <kbd>F12</kbd> and open the <em>Console</em> tab. If Chrome blocks pasting, type <code>allow pasting</code> and press <kbd>Enter</kbd>.</li>
          <li>
            Paste this snippet and press <kbd>Enter</kbd>. Allow pop-ups if asked.
            <div class="code">
              <button type="button" class="copy" (click)="copy('drive', driveSnippet)">{{ copied() === 'drive' ? 'Copied' : 'Copy snippet' }}</button>
              <pre><code>{{ driveSnippet }}</code></pre>
            </div>
          </li>
          <li>A print dialog opens in a new tab. Choose <em>Save as PDF</em>, set margins to <em>None</em>, and save.</li>
        </ol>
      } @else {
        <ol class="steps">
          <li>Open the Scribd link, sign in if the document needs it, and accept cookies.</li>
          <li>Scroll to the last page so every page loads.</li>
          <li>
            Press <kbd>F12</kbd>, open the <em>Console</em> tab, paste this snippet and press <kbd>Enter</kbd>. It removes the toolbars and the scroll box.
            <div class="code">
              <button type="button" class="copy" (click)="copy('scribd', scribdSnippet)">{{ copied() === 'scribd' ? 'Copied' : 'Copy snippet' }}</button>
              <pre><code>{{ scribdSnippet }}</code></pre>
            </div>
          </li>
          <li>Press <kbd>Ctrl</kbd>+<kbd>P</kbd> (<kbd>Cmd</kbd>+<kbd>P</kbd> on Mac), choose <em>Save as PDF</em>, turn on <em>Background graphics</em>, and save.</li>
        </ol>
      }
    </aside>
    </div>
  `,
  styles: `
    .layout { display: grid; gap: 40px; }
    @media (min-width: 960px) {
      .layout { grid-template-columns: minmax(0, 3fr) minmax(0, 7fr); gap: 48px; align-items: start; }
      .manual { grid-column: 1; grid-row: 1; padding-top: 12px; }
      .primary { grid-column: 2; grid-row: 1; }
    }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; flex: none; }

    /* The one bold element: a sheet of paper with a folded corner, a stack of pages behind it. */
    .sheet { filter: drop-shadow(0 1px 0 var(--border)) drop-shadow(7px 7px 0 var(--sheet-2)) drop-shadow(7px 7px 0 var(--sheet-3)); }
    .paper { position: relative; padding: 36px 36px 28px; background: var(--surface);
             clip-path: polygon(0 0, calc(100% - 44px) 0, 100% 44px, 100% 100%, 0 100%); }
    .paper::after { content: ''; position: absolute; top: 0; right: 0; width: 44px; height: 44px;
                    background: linear-gradient(225deg, transparent 50%, var(--fold) 50%); }
    h1 { margin: 0 0 12px; max-width: 18ch; font-size: clamp(1.9rem, 1.3rem + 2.2vw, 2.5rem); line-height: 1.08;
         font-weight: 800; letter-spacing: -0.025em; text-wrap: balance; }
    h2 { margin: 0 0 16px; font-size: 1.25rem; line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; }
    .lead { margin: 0 0 28px; max-width: 52ch; color: var(--muted); font-size: 1.0625rem; }
    label { display: block; margin-bottom: 8px; font-weight: 700; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; }
    input { flex: 1 1 280px; min-height: 52px; padding: 0 16px; border: 2px solid var(--text); border-radius: 6px;
            background: var(--surface); color: var(--text); font-size: 1rem; }
    input::placeholder { color: var(--muted); }
    input[aria-invalid='true'] { border-color: var(--danger); }
    .row .btn { min-height: 52px; padding: 0 24px; }
    .below { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 14px; }
    .providers { list-style: none; display: flex; gap: 6px; padding: 0; margin: 0; }
    .providers li { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 4px;
                    color: var(--muted); font-size: .875rem; transition: background-color .15s, color .15s; }
    .providers li.on { background: var(--marker); color: var(--marker-text); font-weight: 700; }
    .hint { margin: 0; color: var(--muted); font-size: .875rem; }
    .hint.bad, .error { color: var(--danger); }
    .notice { margin: 16px 0 0; padding: 10px 14px; border-radius: 6px; }
    .notice.error { background: var(--danger-soft); }
    .notice.ok { background: var(--ok-soft); color: var(--ok); }
    .notice p { margin: 0 0 8px; }

    .exports { margin-top: 48px; }
    .jobs { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--border); }
    .job { padding: 16px 0; border-bottom: 1px solid var(--border); }
    .skeleton { height: 92px; margin: 8px 0; border-radius: 6px; border: 0;
                background: linear-gradient(90deg, var(--surface), var(--bg), var(--surface)) 0 0 / 200% 100%;
                animation: shimmer 1.4s linear infinite; }
    @keyframes shimmer { to { background-position: -200% 0; } }
    .top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .name { font-weight: 700; overflow-wrap: anywhere; }
    .badge { display: inline-flex; align-items: center; gap: 6px; font-size: .875rem; font-weight: 700; white-space: nowrap; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .badge[data-status='SUCCEEDED'] { color: var(--ok); }
    .badge[data-status='FAILED'] { color: var(--danger); }
    .badge[data-status='RUNNING'], .badge[data-status='QUEUED'] { color: var(--accent); }
    .badge[data-status='RUNNING'] .dot { animation: pulse 1.2s ease-in-out infinite; }
    .badge[data-status='CANCELLED'], .badge[data-status='EXPIRED'] { color: var(--muted); }
    @keyframes pulse { 50% { opacity: .3; } }
    .meta { display: flex; flex-wrap: wrap; gap: 2px 14px; margin: 2px 0 0; color: var(--muted); font-size: .875rem; }
    .bar { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; margin: 12px 0 4px; }
    .bar span { display: block; height: 100%; min-width: 4%; background: var(--accent); transition: width .3s ease-out; }
    .bar.waiting span { width: 30% !important; animation: slide 1.6s ease-in-out infinite; }
    @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(340%); } }
    .stage { margin: 4px 0; color: var(--muted); font-size: .875rem; }
    .error { margin: 8px 0 0; }
    .current-url { overflow-wrap: anywhere; }
    .current-url a { color: var(--accent); }
    .failure-preview { margin-top: 8px; }
    .failure-preview img { display: block; max-width: 100%; height: auto; margin-top: 8px; border: 1px solid var(--border); border-radius: 6px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
    .question { font-weight: 700; margin-right: 4px; }
    a.btn { text-decoration: none; }
    .empty { padding: 20px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .empty p { margin: 0; }
    .empty .quiet { margin-top: 4px; color: var(--muted); font-size: .875rem; }
    .spinner { width: 16px; height: 16px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%;
               display: inline-block; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .intro { margin: 0 0 20px; color: var(--muted); max-width: 60ch; }
    .switch { display: inline-flex; padding: 3px; margin-bottom: 20px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
    .switch button { min-height: 40px; padding: 0 16px; border: 0; border-radius: 6px; background: transparent;
                     color: var(--muted); font-weight: 600; cursor: pointer; transition: background-color .15s, color .15s; }
    .switch button[aria-pressed='true'] { background: var(--text); color: var(--surface); }
    .steps { list-style: none; counter-reset: step; margin: 0; padding: 0; }
    .steps li { counter-increment: step; position: relative; padding: 0 0 18px 44px; }
    .steps li::before { content: counter(step); position: absolute; left: 0; top: -2px; width: 28px; height: 28px;
                        display: grid; place-items: center; border-radius: 50%; border: 2px solid var(--text);
                        font-size: .875rem; font-weight: 800; }
    .steps li:not(:last-child)::after { content: ''; position: absolute; left: 14px; top: 30px; bottom: 2px;
                                        border-left: 2px solid var(--border); }
    .code { margin-top: 10px; border-radius: 6px; background: var(--code-bg); overflow: hidden; }
    .code pre { margin: 0; padding: 4px 14px 14px; max-height: 280px; overflow: auto; color: var(--code-text);
                font-size: .8125rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; user-select: all; }
    .copy { display: block; min-height: 36px; margin: 8px 8px 0 auto; padding: 0 14px; border: 0; border-radius: 4px;
            background: var(--marker); color: var(--marker-text); font-weight: 700; cursor: pointer; }
    .copy:hover { background: var(--marker-hover); }
    kbd { padding: 0 5px; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px;
          background: var(--surface); font: inherit; font-size: .8125em; font-weight: 600; }
    code:not(pre code) { padding: 0 4px; border-radius: 3px; background: var(--accent-soft); font-size: .875em; }

    @media (max-width: 520px) {
      .paper { padding: 28px 18px 22px; }
      .row .btn { flex: 1 1 100%; }
    }
  `
})
export class JobsPage {
  private readonly api = inject(JobsApi);
  private readonly injector = inject(Injector);

  readonly url = signal('');
  readonly jobs = signal<Job[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly confirming = signal<string | null>(null);
  readonly previewing = signal<string | null>(null);
  readonly announcement = signal('');
  readonly detection = computed(() => detectProvider(this.url()));
  private readonly hasActive = computed(() => this.jobs().some(isActive));

  protected readonly errorMessage = errorMessage;
  protected readonly driveSnippet = DRIVE_SNIPPET;
  protected readonly scribdSnippet = SCRIBD_SNIPPET;
  readonly copied = signal<string | null>(null);
  /** Manual guide tab: the user's pick, else the provider of the link being typed, else Drive. */
  readonly guide = signal<ProviderName | null>(null);
  readonly shownGuide = computed(() => this.guide() ?? this.detection().provider ?? 'DRIVE');

  private timer: ReturnType<typeof setTimeout> | undefined;
  private listSub: Subscription | undefined;
  private destroyed = false;
  private readonly onVisibility = () => {
    if (!document.hidden && this.hasActive()) this.refresh();
  };

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibility);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.clearTimer();
      this.listSub?.unsubscribe();
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
    this.refresh();
  }

  onInput(value: string): void {
    this.url.set(value);
    this.submitted.set(false);
    this.submitError.set(null);
  }

  refresh(): void {
    this.clearTimer();
    // Drop any in-flight list so an older snapshot can never overwrite a newer one.
    this.listSub?.unsubscribe();
    this.listSub = this.api.list().subscribe({
      next: list => {
        this.announceChanges(this.jobs(), list);
        this.jobs.set(list);
        this.loading.set(false);
        this.loadError.set(false);
        this.schedule();
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
        this.schedule();
      }
    });
  }

  submit(event: Event): void {
    event.preventDefault();
    const d = this.detection();
    this.submitted.set(false);
    if (!d.valid) {
      this.submitError.set(d.hint || 'Enter a document link.');
      return;
    }
    this.submitError.set(null);
    this.submitting.set(true);
    this.api.submit(this.url().trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
        this.url.set('');
        this.refresh();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.submitError.set(errorMessage(codeOf(err)));
      }
    });
  }

  /** Clipboard needs a secure context; on failure the <pre> stays selectable (user-select: all). */
  copy(key: string, text: string): void {
    navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(key);
      this.announcement.set('Snippet copied.');
      setTimeout(() => { if (this.copied() === key) this.copied.set(null); }, 2000);
    }, () => this.announcement.set('Copy failed. Select the snippet and copy it.'));
  }

  retry(job: Job): void {
    this.actionError.set(null);
    this.api.retry(job.id).subscribe({next: () => this.refresh(), error: (e: unknown) => this.actionFailed(e)});
  }

  /** Two-step inline confirm instead of a blocking window.confirm; focus lands on the safe choice. */
  askRemove(job: Job): void {
    this.confirming.set(job.id);
    this.focusAfterRender(`keep-${job.id}`);
  }

  closeConfirm(job: Job): void {
    this.confirming.set(null);
    this.focusAfterRender(`rm-${job.id}`);
  }

  confirmText(job: Job): string {
    return job.status === 'QUEUED' ? 'Cancel this export?' : 'Delete this export and its file?';
  }

  remove(job: Job): void {
    this.confirming.set(null);
    this.actionError.set(null);
    this.api.remove(job.id).subscribe({next: () => this.refresh(), error: (e: unknown) => this.actionFailed(e)});
  }

  /** The job may have changed state since the last poll (e.g. JOB_RUNNING), so re-sync the list. */
  private actionFailed(err: unknown): void {
    this.actionError.set(errorMessage(codeOf(err)));
    this.refresh();
  }

  providerName(job: Job): string {
    return job.provider === 'DRIVE' ? 'Google Drive' : 'Scribd';
  }

  statusLabel(job: Job): string {
    return STATUS_LABEL[job.status];
  }

  stageLabel(job: Job): string {
    return (job.stage && STAGE_LABEL[job.stage]) || 'Working';
  }

  fileUrl(job: Job): string {
    return this.api.fileUrl(job.id);
  }

  screenshotUrl(job: Job): string {
    return this.api.screenshotUrl(job.id);
  }

  size(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /** "3 minutes ago" / "in 6 days"; refreshed whenever the list re-renders. */
  relative(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    const [unit, ms] = UNITS.find(([, ms]) => Math.abs(diff) >= ms) ?? UNITS[UNITS.length - 1];
    return RELATIVE.format(Math.round(diff / ms), unit);
  }

  private focusAfterRender(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), {injector: this.injector});
  }

  private announceChanges(prev: Job[], next: Job[]): void {
    const before = new Map(prev.map(j => [j.id, j.status]));
    for (const j of next) {
      const old = before.get(j.id);
      if (old && old !== j.status && (j.status === 'SUCCEEDED' || j.status === 'FAILED')) {
        this.announcement.set(`${j.displayName || this.providerName(j)} export ${j.status === 'SUCCEEDED' ? 'is ready' : 'failed'}.`);
      }
    }
  }

  /** Polls only while something is queued or running, and never while the tab is hidden. */
  private schedule(): void {
    this.clearTimer();
    if (this.destroyed || !this.hasActive() || document.hidden) return;
    this.timer = setTimeout(() => this.refresh(), POLL_MS);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

function codeOf(err: unknown): string | undefined {
  return err instanceof HttpErrorResponse ? (err.error as ProblemDetail | null)?.code : undefined;
}
