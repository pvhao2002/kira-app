import {ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild} from '@angular/core';
import {BarController, BarElement, CategoryScale, Chart, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip} from 'chart.js';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {InvestmentAccountSummary, InvestmentPeriodicReport, InvestmentReport, PageResponse} from '../../shared/models/api.models';
import {formatMoney} from './reports/report-format';

type Granularity = 'DAY' | 'MONTH' | 'YEAR';
const GRANULARITIES: Granularity[] = ['DAY', 'MONTH', 'YEAR'];
const MONTHS_BACK: Record<Granularity, number> = {DAY: 1, MONTH: 12, YEAR: 60};
Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

@Component({
  selector: 'app-investment-cashflow',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investment-cashflow.page.html',
  styleUrl: './investment-cashflow.page.scss'
})
export class InvestmentCashflowPage {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly granularities = GRANULARITIES;
  readonly granularity = signal<Granularity>('MONTH');
  readonly accounts = signal<InvestmentAccountSummary[]>([]);
  readonly accountId = signal<number | null>(null);
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly currency = signal('');
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly report = signal<InvestmentReport<InvestmentPeriodicReport> | null>(null);
  readonly currencies = computed(() => this.report()?.currencies.map(item => item.currency) ?? []);
  readonly data = computed(() => {
    const items = this.report()?.currencies ?? [];
    return (items.find(item => item.currency === this.currency()) ?? items[0])?.data ?? null;
  });
  readonly rows = computed(() => this.data()?.rows ?? []);
  readonly rangeInvalid = computed(() => !this.fromDate() || !this.toDate() || this.fromDate() > this.toDate()
    || (Date.parse(this.toDate()) - Date.parse(this.fromDate())) / 86400000 > 1830);
  private readonly barCanvas = viewChild<ElementRef<HTMLCanvasElement>>('barCanvas');
  private readonly lineCanvas = viewChild<ElementRef<HTMLCanvasElement>>('lineCanvas');
  private readonly theme = signal(0); // bumped when <html data-theme> changes so canvas colours are re-read
  private barChart?: Chart;
  private lineChart?: Chart;

  constructor() {
    this.setRange('MONTH');
    this.api.page<InvestmentAccountSummary>('investment/accounts', 0, 100, '').pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({next: (response: PageResponse<InvestmentAccountSummary>) => this.accounts.set(response.data)});
    const observer = new MutationObserver(() => this.theme.update(n => n + 1));
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme', 'class']});
    effect(() => this.draw());
    this.load();
    this.destroyRef.onDestroy(() => { observer.disconnect(); this.request?.unsubscribe(); this.barChart?.destroy(); this.lineChart?.destroy(); });
  }

  chooseGranularity(value: Granularity): void { this.setRange(value); this.load(); }
  chooseAccount(value: string): void { this.accountId.set(value ? Number(value) : null); }
  apply(): void { if (!this.rangeInvalid()) this.load(); }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency() || 'VND', amount); }
  private draw(): void {
    const rows = this.rows(), bar = this.barCanvas()?.nativeElement, line = this.lineCanvas()?.nativeElement;
    this.i18n.locale();
    this.theme();
    this.barChart?.destroy(); this.lineChart?.destroy();
    this.barChart = this.lineChart = undefined;
    if (!bar || !line) return;
    const css = getComputedStyle(bar), muted = css.getPropertyValue('--muted').trim() || '#64748b', border = css.getPropertyValue('--border').trim() || '#e2e8f0';
    const labels = rows.map(r => r.period);
    const tick = (value: string | number) => this.compact(Number(value));
    const tooltip = {callbacks: {label: (c: {dataset: {label?: string}; parsed: {y: number | null}}) => `${c.dataset.label}: ${this.money(c.parsed.y ?? 0)}`}};
    const options = {
      responsive: true, maintainAspectRatio: false, interaction: {mode: 'index' as const, intersect: false},
      plugins: {legend: {labels: {color: muted, usePointStyle: true, boxWidth: 8}}, tooltip},
      scales: {x: {ticks: {color: muted, maxTicksLimit: 12}, grid: {display: false}}, y: {ticks: {color: muted, callback: tick}, grid: {color: border}}}
    };
    this.barChart = new Chart(bar, {
      type: 'bar',
      data: {labels, datasets: [
        {label: this.i18n.t('investmentReports.deposits'), data: rows.map(r => r.totals.deposits), backgroundColor: '#2563eb', borderRadius: 4},
        {label: this.i18n.t('investmentReports.withdrawals'), data: rows.map(r => r.totals.withdrawals), backgroundColor: '#f59e0b', borderRadius: 4}]},
      options
    });
    this.lineChart = new Chart(line, {
      type: 'line',
      data: {labels, datasets: [{label: this.i18n.t('investmentCashflow.diff'), data: rows.map(r => r.totals.net), borderColor: '#7c3aed',
        backgroundColor: 'rgba(124,58,237,.12)', fill: true, cubicInterpolationMode: 'monotone' as const, pointRadius: rows.length > 60 ? 0 : 3}]},
      options
    });
  }
  private compact(value: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), {notation: 'compact', maximumFractionDigits: 1}).format(value);
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.failed.set(false);
    this.report.set(null);
    const params: Record<string, string | number> = {fromDate: this.fromDate(), toDate: this.toDate(), granularity: this.granularity()};
    if (this.accountId() != null) params['accountId'] = this.accountId()!;
    this.request = this.api.investmentReport<InvestmentPeriodicReport>('periodic', params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.report.set(data);
        const values = data.currencies.map(item => item.currency);
        if (!values.includes(this.currency())) this.currency.set(values[0] ?? '');
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }

  private setRange(granularity: Granularity): void {
    this.granularity.set(granularity);
    const now = new Date(), months = MONTHS_BACK[granularity];
    this.toDate.set(this.iso(now));
    this.fromDate.set(this.iso(months === 1 ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - months + 1, 1)));
  }
  private iso(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
}
