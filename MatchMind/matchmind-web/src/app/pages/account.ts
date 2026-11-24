import { DecimalPipe, formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChartOptions } from 'chart.js';
import { ApiService } from '../core/api.service';
import { apiErrorText } from '../core/http';
import { AccountLedger, AccountPeriod } from '../core/models';
import { errorMessage, keepPrevious, viewState } from '../core/resource';
import { ChartView, SERIES } from '../shared/chart';
import { CopyFallback, CopyService } from '../shared/copy';
import { APP_LOCALE, fmtDateTime } from '../shared/format';
import { Paginator } from '../shared/kit';
import { StateView } from '../shared/ui';

const ZERO = { deposits: 0, withdrawals: 0, rewards: 0, profit: 0, depositCount: 0, withdrawalCount: 0, cancelledWithdrawalCount: 0, cancelledWithdrawals: 0 };

/** `YYYY-MM-DD` moved by whole days or months; date-only values step exactly in UTC (Vietnam has no DST). */
function shift(day: string, days: number, months = 0): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Oldest-first periods, gaps filled with zero totals, newest `limit` kept. `rows` is the API's newest-first array. */
export function periodSeries(rows: AccountPeriod[], step: 'week' | 'month', limit: number): AccountPeriod[] {
  if (!rows.length) return [];
  const byStart = new Map(rows.map(r => [r.periodStart, r]));
  const out: AccountPeriod[] = [];
  for (let key = rows.at(-1)!.periodStart; key <= rows[0].periodStart; key = step === 'week' ? shift(key, 7) : shift(key, 0, 1)) {
    out.push(byStart.get(key) ?? { periodStart: key, ...ZERO });
  }
  // ponytail: the client caps the window to 26 weeks / 24 months; move the cap into SQL (P3-6) if history gets long.
  return out.slice(-limit);
}

const weekLabel = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' });

@Component({
  selector: 'mm-account',
  imports: [ChartView, CopyFallback, DecimalPipe, Paginator, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:paste)': 'paste($event)' },
  styles: `
    .drop { display: grid; justify-items: center; gap: 4px; padding: 24px 16px; text-align: center; cursor: pointer;
      border: 2px dashed var(--mm-input-line); border-radius: var(--mm-radius); background: var(--mm-surface-2);
      transition: border-color .15s, background-color .15s; }
    .drop:hover, .drop.drag { border-color: var(--mm-accent-ui); background: var(--mm-green-soft); }
    .drop:focus-within { outline: 2px solid var(--mm-green); outline-offset: 2px; }
    .drop.busy { cursor: progress; opacity: .7; }
    .drop .pi-images { font-size: 1.75rem; color: var(--mm-accent-ui); }
    .drop-title { font-weight: 600; color: var(--mm-ink); }
    .drop-title u { color: var(--mm-link); }
    .drop-hint, .muted { color: var(--mm-ink-3); font-size: .875rem; font-weight: 400; }
    kbd { font-family: var(--mm-mono); font-size: .8em; padding: 1px 5px; border: 1px solid var(--mm-line-2); border-radius: 4px; background: var(--mm-card-solid); }
    .drop-count { margin: 0; font-weight: 600; }
    .thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
    .thumb { position: relative; display: grid; place-items: center; aspect-ratio: 3 / 4; overflow: hidden;
      border: 1px solid var(--mm-line-2); border-radius: 10px; background: var(--mm-card-solid); color: var(--mm-ink-3); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .thumb-n { position: absolute; left: 6px; top: 6px; min-width: 20px; padding: 0 5px; border-radius: 10px;
      background: var(--mm-navy); color: #fff; font-size: .75rem; line-height: 20px; text-align: center; }
    .thumb-x { position: absolute; right: 4px; top: 4px; width: 32px; height: 32px; display: grid; place-items: center;
      border: 0; border-radius: 50%; background: rgba(15, 23, 42, .72); color: #fff; cursor: pointer; }
    .thumb-x:hover { background: var(--mm-danger-bg); }
    .thumb-x:focus-visible { outline: 2px solid var(--mm-green); outline-offset: 1px; }
    .steps { margin: 0; padding-left: 1.25rem; display: grid; gap: 6px; }
    @media (prefers-reduced-motion: reduce) { .drop { transition: none; } }
  `,
  template: `
    <div class="stack">
      <section class="panel stack">
        <h2>Import transactions</h2>
        <label class="drop" for="account-image" data-drop [class.drag]="dragging()" [class.busy]="uploading()"
          (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)"
          (drop)="$event.preventDefault(); dragging.set(false); add($event.dataTransfer?.files)">
          <i class="pi pi-images" aria-hidden="true"></i>
          <span class="drop-title">Drop screenshots here, paste with <kbd>Ctrl</kbd>+<kbd>V</kbd>, or <u>browse</u></span>
          <span class="drop-hint">PNG or JPEG · up to 8 MiB each · 1 to 10 per import · overlapping screenshots are fine</span>
          <input #image id="account-image" class="sr-only" type="file" accept="image/png,image/jpeg" multiple [disabled]="uploading()"
            (change)="add(image.files); image.value = ''" />
        </label>
        @if (uploadError()) { <p role="alert" class="alert alert-error">{{ uploadError() }}</p> }
        @if (pending().length) {
          <p role="status" class="drop-count">{{ pending().length }} screenshots ready <span class="muted">· {{ pendingSize() }} · {{ 10 - pending().length }} more allowed</span></p>
          <ul class="thumbs" aria-label="Screenshots to upload">
            @for (file of pending(); track file; let i = $index) {
              <li class="thumb">
                @if (thumbs()[i]; as url) { <img [src]="url" [alt]="'Screenshot ' + (i + 1)" /> } @else { <i class="pi pi-image" aria-hidden="true"></i> }
                <span class="thumb-n" aria-hidden="true">{{ i + 1 }}</span>
                <button type="button" class="thumb-x" [attr.aria-label]="'Remove screenshot ' + (i + 1)" [disabled]="uploading()" (click)="remove(i)">
                  <i class="pi pi-times" aria-hidden="true"></i></button>
              </li>
            }
          </ul>
          <div class="filter-bar">
            <button type="button" class="btn btn-primary" data-action="upload" [disabled]="uploading()" (click)="upload()">
              @if (uploading()) { <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Uploading… } @else { <i class="pi pi-upload" aria-hidden="true"></i> Upload {{ pending().length }} screenshots }
            </button>
            <button type="button" class="btn" data-action="clear" [disabled]="uploading()" (click)="pending.set([]); uploadError.set('')">Remove all</button>
          </div>
        }
        @if (prompt(); as text) {
          <ol class="steps" role="status">
            <li><button type="button" class="btn btn-primary btn-sm" data-action="copy" (click)="copy.copy(text, 'Account import prompt')"><i class="pi pi-copy" aria-hidden="true"></i> Copy prompt</button></li>
            <li>Paste it in your AI chat and attach these {{ imageCount() }} screenshots in one message.</li>
            <li>Refresh transactions after the Sheet syncs.</li>
          </ol>
        }
      </section>
      @if (data(); as ledger) {
        <section class="panel stack">
          <h2>Cash flow</h2>
          <p class="page-note">Profit is successful withdrawals minus successful deposits. Weeks start on Monday. Report periods use GMT+7.</p>
          <div class="filter-bar" role="group" aria-label="Report period">
            @for (option of periods; track option.key) {
              <button type="button" class="btn btn-sm" [class.btn-primary]="period() === option.key"
                [attr.data-period]="option.key" [attr.aria-pressed]="period() === option.key"
                (click)="period.set(option.key)">{{ option.label }}</button>
            }
          </div>
          @let k = kpis();
          @let m = month();
          <section class="kpis" aria-label="All-time account totals">
            <div class="kpi"><span>Deposited</span><strong>{{ money(k?.deposits) }}</strong><span class="kpi-sub">successful deposits</span></div>
            <div class="kpi"><span>Withdrawn</span><strong>{{ money(k?.withdrawals) }}</strong><span class="kpi-sub">successful withdrawals</span></div>
            <div class="kpi"><span>Profit / loss</span><strong [class.win]="(k?.profit ?? 0) > 0" [class.loss]="(k?.profit ?? 0) < 0">{{ money(k?.profit) }}</strong><span class="kpi-sub">withdrawals − deposits</span></div>
            <div class="kpi"><span>Bonuses</span><strong>{{ money(k?.rewards) }}</strong><span class="kpi-sub">tracked separately</span></div>
            <div class="kpi"><span>Net incl. bonuses</span><strong>{{ money(k?.net) }}</strong><span class="kpi-sub">profit + bonuses</span></div>
            <div class="kpi"><span>Cancelled withdrawals</span><strong>{{ money(k?.cancelledWithdrawals) }}</strong>
              <span class="kpi-sub">{{ k ? k.cancelledWithdrawalCount + (k.cancelledWithdrawalCount === 1 ? ' request' : ' requests') : '—' }}</span></div>
            <div class="kpi"><span>This month</span><strong [class.win]="(m?.current ?? 0) > 0" [class.loss]="(m?.current ?? 0) < 0">{{ money(m?.current) }}</strong>
              <span class="kpi-sub">last month {{ money(m?.previous) }}</span></div>
          </section>
          <div class="dash-grid">
            <section class="span-4">
              <h3>Cash flow per {{ chartPeriod() === 'weekly' ? 'week' : 'month' }}</h3>
              @if (series().length) { <mm-chart type="bar" [data]="flowChart()" [options]="flowOptions" label="Deposits, withdrawals and profit per period chart" /> }
              @else { <div class="empty-state"><i class="pi pi-chart-bar" aria-hidden="true"></i><span>No transactions yet.</span></div> }
            </section>
            <section class="span-2">
              <h3>Running profit / loss</h3>
              @if (series().length) { <mm-chart type="line" [data]="cumulativeChart()" [options]="cumulativeOptions" label="Running profit / loss chart" /> }
              @else { <div class="empty-state"><i class="pi pi-chart-line" aria-hidden="true"></i><span>No transactions yet.</span></div> }
            </section>
          </div>
          <div class="table-wrap"><table class="dt" aria-label="Cash flow report">
            <thead><tr><th>Period</th><th class="num">Deposits</th><th class="num">Deposits #</th><th class="num">Avg deposit</th>
              <th class="num">Withdrawals</th><th class="num">Withdrawals #</th><th class="num">Avg withdrawal</th>
              <th class="num">Cancelled withdrawals</th><th class="num">Bonuses</th><th class="num">Profit / loss</th></tr></thead>
            <tbody>@for (row of reportRows(); track row.periodStart) {
              <tr><th scope="row">{{ row.label }}</th><td class="num">{{ row.deposits | number:'1.0-4' }}</td>
                <td class="num">{{ row.depositCount }}</td><td class="num">{{ avg(row.deposits, row.depositCount) }}</td>
                <td class="num">{{ row.withdrawals | number:'1.0-4' }}</td><td class="num">{{ row.withdrawalCount }}</td>
                <td class="num">{{ avg(row.withdrawals, row.withdrawalCount) }}</td>
                <td class="num" [title]="row.cancelledWithdrawalCount + ' cancelled'">{{ row.cancelledWithdrawals | number:'1.0-4' }}</td>
                <td class="num">{{ row.rewards | number:'1.0-4' }}</td>
                <td class="num" [class.win]="row.profit > 0" [class.loss]="row.profit < 0">{{ row.profit | number:'1.0-4' }}</td></tr>
            } @empty { <tr><td colspan="10" class="empty">No transactions in this report.</td></tr> }</tbody>
          </table></div>
        </section>
        <section class="panel stack">
          <div class="filter-bar"><h2>Transactions</h2><button class="btn btn-sm" type="button" [disabled]="resource.isLoading()" (click)="resource.reload()">Refresh transactions</button></div>
          <div class="table-wrap"><table class="dt" aria-label="Transactions">
            <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Status</th><th class="num">Amount</th></tr></thead>
            <tbody>@for (txn of ledger.transactions; track txn) {
              <tr><td>{{ fmt(txn.occurredAt) }}</td><td>{{ txn.reference }}</td><td>{{ labels[txn.type] }}</td>
                <td>{{ statuses[txn.status] }}</td><td class="num">{{ txn.amount | number:'1.0-4' }}</td></tr>
            } @empty { <tr><td colspan="5" class="empty">No imported transactions yet.</td></tr> }</tbody>
          </table></div>
          @if (ledger.meta.totalElements > ledger.meta.size) {
            <mm-paginator [page]="ledger.meta.page" [size]="ledger.meta.size" [total]="ledger.meta.totalElements"
              [sizes]="[]" unit="transactions" (pageChange)="page.set($event.page)" />
          }
        </section>
      } @else {
        <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      }
    </div>
    <mm-copy-fallback />`,
})
export class AccountPage {
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  readonly copy = inject(CopyService);
  readonly page = signal(0);
  readonly resource = this.api.accountTransactionsResource(this.page, 25);
  readonly data = keepPrevious(this.resource);
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly prompt = signal('');
  readonly imageCount = signal(0);
  readonly pending = signal<File[]>([]);
  readonly dragging = signal(false);
  readonly pendingSize = computed(() => (this.pending().reduce((sum, file) => sum + file.size, 0) / 1048576).toFixed(1) + ' MiB');
  readonly thumbs = signal<string[]>([]);
  private readonly previews = effect(onCleanup => {
    // jsdom has no createObjectURL: tests fall back to an icon.
    const urls = this.pending().map(file => URL.createObjectURL?.(file) ?? '');
    this.thumbs.set(urls);
    onCleanup(() => urls.forEach(url => url && URL.revokeObjectURL(url)));
  });
  readonly period = signal<keyof AccountLedger['reports']>('allTime');
  readonly periods = [{ key: 'allTime', label: 'All time' }, { key: 'weekly', label: 'Weekly' }, { key: 'monthly', label: 'Monthly' }] as const;
  readonly labels = { CREDIT: 'Deposit', DEBIT: 'Withdrawal', REWARD: 'Bonus' };
  readonly statuses = { SUCCESS: 'Successful', CANCELLED: 'Cancelled' };
  readonly fmt = fmtDateTime;
  readonly hasData = computed(() => (this.data()?.meta.totalElements ?? 0) > 0);
  readonly reportRows = computed(() => {
    const reports = this.data()?.reports;
    const period = this.period();
    if (!reports || !this.hasData()) return [];
    if (period === 'allTime') return [{ periodStart: 'allTime', label: 'All time', ...reports.allTime }];
    const label = period === 'weekly' ? weekLabel : monthLabel;
    return reports[period].map(r => ({ ...r, label: label.format(new Date(r.periodStart)) }));
  });
  /** All-time tiles; null on an empty ledger so every tile prints '—'. */
  readonly kpis = computed(() => {
    const t = this.data()?.reports.allTime;
    if (!t || !this.hasData()) return null;
    return { ...t, net: Number(t.profit) + Number(t.rewards) };   // display-only sum; the server owns the money
  });
  /** Profit of this GMT+7 calendar month and the one before; a month without rows is a measured 0. */
  readonly month = computed(() => {
    const monthly = this.data()?.reports.monthly;
    if (!monthly || !this.hasData()) return null;
    const current = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()) + '-01';
    const profit = (start: string) => Number(monthly.find(r => r.periodStart === start)?.profit ?? 0);
    return { current: profit(current), previous: profit(shift(current, 0, -1)) };
  });

  readonly chartPeriod = computed(() => this.period() === 'weekly' ? 'weekly' : 'monthly');
  readonly series = computed(() => {
    const r = this.data()?.reports;
    if (!r) return [];
    const weekly = this.chartPeriod() === 'weekly';
    return periodSeries(weekly ? r.weekly : r.monthly, weekly ? 'week' : 'month', weekly ? 26 : 24);
  });
  private readonly seriesLabels = computed(() => {
    const label = this.chartPeriod() === 'weekly' ? weekLabel : monthLabel;
    return this.series().map(r => label.format(new Date(r.periodStart)));
  });
  readonly flowChart = computed(() => {
    const rows = this.series();
    return {
      labels: this.seriesLabels(),
      datasets: [
        { type: 'bar' as const, label: 'Deposits', data: rows.map(r => Number(r.deposits)), backgroundColor: () => SERIES[1], borderRadius: 4, order: 2 },
        { type: 'bar' as const, label: 'Withdrawals', data: rows.map(r => Number(r.withdrawals)), backgroundColor: () => SERIES[0], borderRadius: 4, order: 2 },
        { type: 'line' as const, label: 'Profit / loss', data: rows.map(r => Number(r.profit)), borderColor: () => SERIES[2],
          backgroundColor: () => SERIES[2], tension: .2, pointRadius: rows.length < 3 ? 5 : 2, order: 1 },
      ],
    };
  });
  readonly flowOptions: ChartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
  };
  /** Running profit, started at the profit made before the window so the line ends at the all-time profit. */
  readonly cumulativeChart = computed(() => {
    const rows = this.series();
    let total = Number(this.data()?.reports.allTime.profit ?? 0) - rows.reduce((s, r) => s + Number(r.profit), 0);
    const data = rows.map(r => (total += Number(r.profit)));
    return {
      labels: this.seriesLabels(),
      datasets: [{ label: 'Running profit / loss', data, borderColor: () => SERIES[0], backgroundColor: () => SERIES[0] + '1f',
        fill: 'origin' as const, tension: .2, pointRadius: rows.length < 3 ? 5 : 2 }],
    };
  });
  // Display-only float sums of 4-decimal values: format them so 0.30000000004 never shows.
  readonly cumulativeOptions: ChartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => this.money(ctx.parsed.y) } } },
    scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => this.money(Number(v)) } } },
  };

  money(v: number | null | undefined): string {
    return v === null || v === undefined ? '—' : formatNumber(Number(v), this.locale, '1.0-4');
  }
  avg(sum: number, count: number): string {
    return count ? this.money(Number(sum) / count) : '—';
  }

  /** Queues screenshots from the file input or the clipboard; Upload sends the whole queue as one import. */
  /** Returns how many images were queued (0 when nothing was a PNG or JPEG). */
  add(selected?: ArrayLike<File> | null): number {
    const all = Array.from(selected ?? []).filter(file => file.type === 'image/png' || file.type === 'image/jpeg');
    if (!all.length) return 0;
    const images = all.filter(file => file.size <= 8 * 1048576);
    const errors = all.filter(file => !images.includes(file)).map(file => file.name + ' is larger than 8 MiB.');
    const queue = [...this.pending(), ...images];
    if (queue.length > 10) errors.push('Choose 1 to 10 screenshots.');
    this.prompt.set('');
    this.uploadError.set(errors.join(' '));
    this.pending.set(queue.slice(0, 10));
    return all.length;
  }

  remove(index: number): void {
    this.pending.update(files => files.filter((_, i) => i !== index));
    this.uploadError.set('');
  }

  paste(event: ClipboardEvent): void {
    if (this.uploading()) return;
    if (this.add(event.clipboardData?.files)) event.preventDefault(); // text pastes pass through
  }

  upload(): void {
    const files = this.pending();
    if (!files.length) return;
    this.prompt.set('');
    this.uploadError.set('');
    this.uploading.set(true);
    this.api.uploadAccountImages(files)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => { this.uploading.set(false); this.pending.set([]); this.imageCount.set(files.length); this.prompt.set(result.prompt); },
        error: error => { this.uploading.set(false); this.uploadError.set(apiErrorText(error)); },
      });
  }
}
