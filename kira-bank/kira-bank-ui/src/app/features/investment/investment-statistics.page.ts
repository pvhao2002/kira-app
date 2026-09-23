import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink, ActivatedRoute, Router} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {IconComponent} from '../../shared/icon/icon';
import {InvestmentAccountSummary, InvestmentReconciliationReport, InvestmentStatisticsOperations, InvestmentStatisticsResponse, PageResponse} from '../../shared/models/api.models';
import {numberFormat, dateFormat} from '../../core/i18n/formatters';

interface LoadState<T> {data: T | null; loading: boolean; failed: boolean}
const initial = <T>(): LoadState<T> => ({data: null, loading: false, failed: false});

type NetFlowMode = 'WITHDRAWAL_MINUS_DEPOSIT' | 'WITHDRAWAL_PLUS_BONUS_MINUS_DEPOSIT';
interface NetFlowInputs {deposits: number; withdrawals: number; bonuses: number}

@Component({
  selector: 'app-investment-statistics',
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: './investment-statistics.page.html',
  styleUrl: './investment-statistics.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentStatisticsPage {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private statsRequest?: Subscription;
  private operationsRequest?: Subscription;
  private accountRequest?: Subscription;
  readonly stats = signal(initial<InvestmentStatisticsResponse>());
  readonly operations = signal(initial<InvestmentStatisticsOperations>());
  readonly report = signal<InvestmentReconciliationReport | null>(null);
  readonly reportLoading = signal(false);
  readonly accountOptions = signal<InvestmentAccountSummary[]>([]);
  readonly accountSearch = signal('');
  readonly accountPage = signal(0);
  readonly accountPages = signal(0);
  readonly accountLoading = signal(false);
  readonly accountId = signal<number | null>(null);
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly currency = signal('');
  readonly netFlowMode = signal<NetFlowMode>('WITHDRAWAL_MINUS_DEPOSIT');
  readonly rangeInvalid = computed(() => !this.fromDate() || !this.toDate() || this.fromDate() > this.toDate()
    || (new Date(`${this.toDate()}T00:00:00Z`).getTime() - new Date(`${this.fromDate()}T00:00:00Z`).getTime()) / 86400000 > 365);
  readonly chart = computed(() => {
    const values = this.stats().data?.currencies ?? [];
    return values.find(item => item.currency === this.currency()) ?? values[0] ?? null;
  });
  readonly chartMax = computed(() => Math.max(1, ...(this.chart()?.daily.flatMap(day => [day.deposits, day.withdrawals, day.bonuses]) ?? [])));
  readonly netFlowDaily = computed(() => (this.chart()?.daily ?? []).map(day => ({date: day.date, value: this.netFlow(day)})));
  private readonly netFlowRange = computed(() => {
    const values = this.netFlowDaily().map(day => day.value);
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    return {min, max: max === min ? max + 1 : max};
  });
  readonly netFlowPoints = computed(() => {
    const daily = this.netFlowDaily();
    const {min, max} = this.netFlowRange();
    const span = max - min;
    return daily.map((day, index) => ({
      date: day.date,
      value: day.value,
      x: daily.length > 1 ? (index / (daily.length - 1)) * 100 : 50,
      y: 100 - ((day.value - min) / span) * 100
    }));
  });
  readonly netFlowLinePoints = computed(() => this.netFlowPoints().map(point => `${point.x},${point.y}`).join(' '));
  readonly netFlowZeroY = computed(() => {
    const {min, max} = this.netFlowRange();
    return 100 - ((0 - min) / (max - min)) * 100;
  });
  readonly netFlowMonthly = computed(() => {
    const totals = new Map<string, NetFlowInputs>();
    for (const day of this.chart()?.daily ?? []) {
      const month = day.date.slice(0, 7);
      const bucket = totals.get(month) ?? {deposits: 0, withdrawals: 0, bonuses: 0};
      bucket.deposits += day.deposits;
      bucket.withdrawals += day.withdrawals;
      bucket.bonuses += day.bonuses;
      totals.set(month, bucket);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, inputs]) => ({month, value: this.netFlow(inputs)}));
  });
  readonly netFlowMonthlyMax = computed(() => Math.max(1, ...this.netFlowMonthly().map(m => Math.abs(m.value))));

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const account = Number(params.get('accountId'));
    this.accountId.set(Number.isFinite(account) && account > 0 ? account : null);
    const today = this.today();
    this.fromDate.set(params.get('fromDate') || this.shift(today, -29));
    this.toDate.set(params.get('toDate') || today);
    this.loadAccounts();
    this.loadAll();
    this.destroyRef.onDestroy(() => { this.statsRequest?.unsubscribe(); this.operationsRequest?.unsubscribe(); this.accountRequest?.unsubscribe(); });
  }

  apply(): void {
    if (this.rangeInvalid()) return;
    const start = new Date(`${this.fromDate()}T00:00:00Z`);
    const end = new Date(`${this.toDate()}T00:00:00Z`);
    if ((end.getTime() - start.getTime()) / 86400000 > 365) return;
    const queryParams: Record<string, string | number | null> = {
      fromDate: this.fromDate(), toDate: this.toDate(), accountId: this.accountId()
    };
    void this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: 'merge'});
    this.loadAll();
  }

  refresh(): void { this.loadAll(); }
  searchAccounts(value: string): void { this.accountSearch.set(value); this.loadAccounts(0); }
  moveAccountPage(delta: number): void { const page = this.accountPage() + delta; if (page >= 0 && page < this.accountPages()) this.loadAccounts(page); }
  resetDates(days: number): void {
    this.toDate.set(this.today());
    this.fromDate.set(this.shift(this.toDate(), -(days - 1)));
    this.apply();
  }
  chooseAccount(value: string): void { this.accountId.set(value ? Number(value) : null); }
  selectAccountAndApply(value: number): void { this.accountId.set(value); this.apply(); }
  chooseCurrency(value: string): void { this.currency.set(value); }
  chooseNetFlowMode(value: string): void { this.netFlowMode.set(value as NetFlowMode); }
  netFlow(row: NetFlowInputs): number {
    return this.netFlowMode() === 'WITHDRAWAL_MINUS_DEPOSIT'
      ? row.withdrawals - row.deposits
      : row.withdrawals + row.bonuses - row.deposits;
  }
  chartHeight(value: number): number { return value / this.chartMax() * 100; }
  monthBarHeight(value: number): number { return Math.abs(value) / this.netFlowMonthlyMax() * 100; }
  monthLabel(value: string): string {
    const date = new Date(`${value}-01T00:00:00`);
    return dateFormat(this.locale(), {month: 'short', year: '2-digit'}).format(date);
  }
  date(value: string): string { return dateFormat(this.locale(), {day: '2-digit', month: '2-digit'}).format(new Date(`${value}T00:00:00`)); }
  dateTime(value: string): string { return dateFormat(this.locale(), {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)); }
  money(amount: number, currency: string): string { return numberFormat(this.locale(), {style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2}).format(amount); }
  label(type: string): string { return this.i18n.t(`investmentStatistics.type.${type.toLowerCase()}`); }
  importStatus(value: string): string {
    const key = value.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return this.i18n.t(`investmentTransactions.importStatus.${key}`);
  }
  status(value: string): string { return this.i18n.t(`investmentStatistics.status.${value.toLowerCase()}`); }
  openReport(id: number): void {
    this.reportLoading.set(true);
    this.api.investmentReconciliationReport(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => { this.report.set(value); this.reportLoading.set(false); },
      error: () => this.reportLoading.set(false)
    });
  }
  closeReport(): void { this.report.set(null); }
  private loadAll(): void { this.loadStats(); this.loadOperations(); }
  private loadAccounts(page = this.accountPage()): void {
    this.accountRequest?.unsubscribe();
    this.accountLoading.set(true);
    this.accountRequest = this.api.page<InvestmentAccountSummary>('investment/accounts', page, 20, this.accountSearch()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: PageResponse<InvestmentAccountSummary>) => { this.accountOptions.set(response.data); this.accountPage.set(response.meta.page); this.accountPages.set(response.meta.totalPages); this.accountLoading.set(false); },
      error: () => this.accountLoading.set(false)
    });
  }
  loadStats(): void {
    this.statsRequest?.unsubscribe();
    this.stats.update(value => ({...value, loading: true, failed: false}));
    const params: Record<string, string | number> = {fromDate: this.fromDate(), toDate: this.toDate()};
    if (this.accountId() != null) params['accountId'] = this.accountId()!;
    this.statsRequest = this.api.investmentStatistics(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.stats.set({data, loading: false, failed: false}); if (!data.currencies.some(item => item.currency === this.currency())) this.currency.set(data.currencies[0]?.currency ?? ''); },
      error: () => this.stats.update(value => ({...value, loading: false, failed: true}))
    });
  }
  loadOperations(): void {
    this.operationsRequest?.unsubscribe();
    this.operations.update(value => ({...value, loading: true, failed: false}));
    this.operationsRequest = this.api.investmentStatisticsOperations(this.accountId() ?? undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.operations.set({data, loading: false, failed: false}),
      error: () => this.operations.update(value => ({...value, loading: false, failed: true}))
    });
  }
  private today(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
  private shift(date: string, amount: number): string { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); }
  private locale(): string { return this.i18n.locale(); }
}
