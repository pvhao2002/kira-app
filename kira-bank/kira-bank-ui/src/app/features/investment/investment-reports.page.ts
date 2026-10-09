import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {
  InvestmentAccountSummary, InvestmentAccountsReport, InvestmentActivityReport, InvestmentBonusReport, InvestmentComparisonReport,
  InvestmentCadenceReport, InvestmentDailyReport, InvestmentGoalsReport, InvestmentAllocationReport, InvestmentInsightsReport, InvestmentLotsReport, InvestmentPerformanceReport, InvestmentDistributionReport, InvestmentDrawdownReport, InvestmentLedgerReport,
  InvestmentMatrixReport, InvestmentOverviewReport, InvestmentPaybackReport, InvestmentProjectionReport, InvestmentRollingReport,
  InvestmentSeasonalityReport, InvestmentEquityReport, InvestmentPeriodicReport, InvestmentReport, PageResponse
} from '../../shared/models/api.models';
import {AccountsReportComponent} from './reports/accounts-report';
import {ActivityReportComponent} from './reports/activity-report';
import {AllocationReportComponent} from './reports/allocation-report';
import {LotsReportComponent} from './reports/lots-report';
import {PerformanceReportComponent} from './reports/performance-report';
import {InsightsReportComponent} from './reports/insights-report';
import {GoalsReportComponent} from './reports/goals-report';
import {CadenceReportComponent} from './reports/cadence-report';
import {DrawdownsReportComponent} from './reports/drawdowns-report';
import {MatrixReportComponent} from './reports/matrix-report';
import {OverviewReportComponent} from './reports/overview-report';
import {LedgerReportComponent} from './reports/ledger-report';
import {PaybackReportComponent} from './reports/payback-report';
import {ProjectionReportComponent} from './reports/projection-report';
import {SeasonalityReportComponent} from './reports/seasonality-report';
import {BonusReportComponent} from './reports/bonus-report';
import {DailyReportComponent} from './reports/daily-report';
import {RollingReportComponent} from './reports/rolling-report';
import {ComparisonReportComponent} from './reports/comparison-report';
import {DistributionReportComponent} from './reports/distribution-report';
import {EquityReportComponent} from './reports/equity-report';
import {PeriodicReportComponent} from './reports/periodic-report';

const PREF_KEY = 'kira-investment-reports';
type TabId = 'overview' | 'insights' | 'goals' | 'periodic' | 'accounts' | 'matrix' | 'equity' | 'performance' | 'drawdowns' | 'rolling' | 'daily' | 'activity' | 'distribution' | 'bonus' | 'ledger' | 'cadence' | 'allocation' | 'lots' | 'payback' | 'seasonality' | 'projection' | 'comparison';
const TABS: TabId[] = ['overview', 'insights', 'goals', 'periodic', 'accounts', 'matrix', 'equity', 'performance', 'drawdowns', 'rolling', 'daily', 'activity', 'distribution', 'bonus', 'ledger', 'cadence', 'allocation', 'lots', 'payback', 'seasonality', 'projection', 'comparison'];
const DEFAULT_MONTHS: Record<TabId, number> = {overview: 12, insights: 3, goals: 12, periodic: 12, accounts: 12, matrix: 12, drawdowns: 12, cadence: 12, equity: 3, performance: 12, rolling: 3, daily: 3, activity: 3, distribution: 3, bonus: 12, ledger: 1, allocation: 60, lots: 60, payback: 60, seasonality: 24, projection: 3, comparison: 1};

@Component({
  selector: 'app-investment-reports',
  imports: [FormsModule, PeriodicReportComponent, AccountsReportComponent, EquityReportComponent, ActivityReportComponent,
    DistributionReportComponent, ComparisonReportComponent, DailyReportComponent, RollingReportComponent, BonusReportComponent, PaybackReportComponent, SeasonalityReportComponent,
    ProjectionReportComponent, LedgerReportComponent, OverviewReportComponent, MatrixReportComponent, DrawdownsReportComponent,
    CadenceReportComponent, GoalsReportComponent, InsightsReportComponent, PerformanceReportComponent, LotsReportComponent, AllocationReportComponent],
  templateUrl: './investment-reports.page.html',
  styleUrl: './investment-reports.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentReportsPage {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private request?: Subscription;
  readonly tabs = TABS;
  readonly tab = signal<TabId>('overview');
  readonly accounts = signal<InvestmentAccountSummary[]>([]);
  readonly accountId = signal<number | null>(null);
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly granularity = signal('MONTH');
  readonly compareFrom = signal('');
  readonly compareTo = signal('');
  readonly currency = signal('');
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly report = signal<InvestmentReport<unknown> | null>(null);
  readonly tooLong = computed(() => !!this.fromDate() && !!this.toDate() && (Date.parse(this.toDate()) - Date.parse(this.fromDate())) / 86400000 > 1830);
  readonly rangeInvalid = computed(() => !this.fromDate() || !this.toDate() || this.fromDate() > this.toDate() || this.tooLong()
    || (this.tab() === 'comparison' && (!!this.compareFrom() !== !!this.compareTo() || this.compareFrom() > this.compareTo())));
  readonly currencies = computed(() => this.report()?.currencies.map(item => item.currency) ?? []);
  readonly data = computed(() => {
    const items = this.report()?.currencies ?? [];
    return (items.find(item => item.currency === this.currency()) ?? items[0])?.data ?? null;
  });

  constructor() {
    const query = this.route.snapshot.queryParamMap;
    // explicit URL wins; otherwise reopen the tab and account used last time (a per-viewer convenience, so every storage access is optional)
    const saved = this.readPreference();
    const tab = (query.get('tab') ?? saved.tab) as TabId | null;
    if (tab && TABS.includes(tab)) this.tab.set(tab);
    this.setRange(DEFAULT_MONTHS[this.tab()]);
    const account = Number(query.get('accountId') ?? (query.get('tab') === null ? saved.accountId : null));
    if (Number.isInteger(account) && account > 0) this.accountId.set(account);
    const isDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (isDate(query.get('fromDate')) && isDate(query.get('toDate'))) { this.fromDate.set(query.get('fromDate')!); this.toDate.set(query.get('toDate')!); }
    const granularity = query.get('granularity');
    if (granularity && ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'].includes(granularity)) this.granularity.set(granularity);
    this.api.page<InvestmentAccountSummary>('investment/accounts', 0, 100, '').pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({next: (response: PageResponse<InvestmentAccountSummary>) => this.accounts.set(response.data)});
    this.load();
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  print(): void { window.print(); }
  drillInto(accountId: number): void { this.accountId.set(accountId); this.tab.set('overview'); this.load(); } // keeps the chosen date range
  choose(tab: TabId): void { this.tab.set(tab); this.setRange(DEFAULT_MONTHS[tab]); this.load(); }
  chooseAccount(value: string): void { this.accountId.set(value ? Number(value) : null); }
  chooseGranularity(value: string): void { this.granularity.set(value); this.load(); }
  apply(): void { if (!this.rangeInvalid()) this.load(); }
  asPeriodic(): InvestmentPeriodicReport { return this.data() as InvestmentPeriodicReport; }
  asAccounts(): InvestmentAccountsReport { return this.data() as InvestmentAccountsReport; }
  asEquity(): InvestmentEquityReport { return this.data() as InvestmentEquityReport; }
  asActivity(): InvestmentActivityReport { return this.data() as InvestmentActivityReport; }
  asDistribution(): InvestmentDistributionReport { return this.data() as InvestmentDistributionReport; }
  asDaily(): InvestmentDailyReport { return this.data() as InvestmentDailyReport; }
  asRolling(): InvestmentRollingReport { return this.data() as InvestmentRollingReport; }
  asBonus(): InvestmentBonusReport { return this.data() as InvestmentBonusReport; }
  asPayback(): InvestmentPaybackReport { return this.data() as InvestmentPaybackReport; }
  asSeasonality(): InvestmentSeasonalityReport { return this.data() as InvestmentSeasonalityReport; }
  asProjection(): InvestmentProjectionReport { return this.data() as InvestmentProjectionReport; }
  asLedger(): InvestmentLedgerReport { return this.data() as InvestmentLedgerReport; }
  asOverview(): InvestmentOverviewReport { return this.data() as InvestmentOverviewReport; }
  asMatrix(): InvestmentMatrixReport { return this.data() as InvestmentMatrixReport; }
  asDrawdowns(): InvestmentDrawdownReport { return this.data() as InvestmentDrawdownReport; }
  asCadence(): InvestmentCadenceReport { return this.data() as InvestmentCadenceReport; }
  asPerformance(): InvestmentPerformanceReport { return this.data() as InvestmentPerformanceReport; }
  asAllocation(): InvestmentAllocationReport { return this.data() as InvestmentAllocationReport; }
  asLots(): InvestmentLotsReport { return this.data() as InvestmentLotsReport; }
  asInsights(): InvestmentInsightsReport { return this.data() as InvestmentInsightsReport; }
  asGoals(): InvestmentGoalsReport { return (this.data() as InvestmentGoalsReport | null) ?? {asOf: this.toDate(), goals: []}; }
  saveGoal(body: {currency: string; period: string; targetAmount: number}): void {
    this.api.saveInvestmentGoal(body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next: () => this.load(), error: () => this.failed.set(true)});
  }
  removeGoal(id: number): void {
    this.api.deleteInvestmentGoal(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next: () => this.load(), error: () => this.failed.set(true)});
  }
  asComparison(): InvestmentComparisonReport { return this.data() as InvestmentComparisonReport; }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.failed.set(false);
    this.report.set(null);
    const params: Record<string, string | number> = {fromDate: this.fromDate(), toDate: this.toDate()};
    if (this.accountId() != null) params['accountId'] = this.accountId()!;
    if (this.tab() === 'periodic') params['granularity'] = this.granularity();
    if (this.tab() === 'comparison' && this.compareFrom() && this.compareTo()) { params['compareFromDate'] = this.compareFrom(); params['compareToDate'] = this.compareTo(); }
    void this.router.navigate([], {relativeTo: this.route, replaceUrl: true, queryParams: {tab: this.tab(), ...params}});
    this.savePreference();
    this.request = this.api.investmentReport<unknown>(this.tab(), params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.report.set(data);
        const values = data.currencies.map(item => item.currency);
        if (!values.includes(this.currency())) this.currency.set(values[0] ?? '');
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }

  private readPreference(): {tab?: string; accountId?: number} {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as {tab?: string; accountId?: number}; } catch { return {}; }
  }
  private savePreference(): void {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({tab: this.tab(), accountId: this.accountId()})); } catch { /* storage unavailable */ }
  }
  private setRange(months: number): void {
    const now = new Date();
    this.toDate.set(this.iso(now));
    this.fromDate.set(this.iso(months === 1 ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - months + 1, 1)));
  }
  private iso(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
}
