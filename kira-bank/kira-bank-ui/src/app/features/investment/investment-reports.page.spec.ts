import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {InvestmentReport, InvestmentReportTotals} from '../../shared/models/api.models';
import {InvestmentReportsPage} from './investment-reports.page';

const totals = (net: number, count = 2): InvestmentReportTotals => ({count, deposits: 1000, withdrawals: 1000 + net, bonuses: 50, net, netWithBonus: net + 50});
const day = (date: string, net: number) => ({date, totals: totals(net)});
const slot = (key: number) => ({key, totals: totals(10)});
const month = (m: number) => ({month: m, occurrences: m % 2, winningOccurrences: 1, count: 3, totalNet: m * 10 - 50, averageNet: m * 10 - 50});

const FIXTURES: Record<string, unknown> = {
  allocation: {totalDeposits: 1300, totalOutstanding: 1000, hhi: 5200, concentration: 'CONCENTRATED', topSharePct: 60, rows: [
    {accountId: 1, accountName: 'Alpha', deposits: 800, withdrawals: 200, outstanding: 600, outstandingSharePct: 60, depositSharePct: 61.54},
    {accountId: 2, accountName: 'Beta', deposits: 400, withdrawals: 0, outstanding: 400, outstandingSharePct: 40, depositSharePct: 30.77}]},
  lots: {lotCount: 3, recoveredLots: 2, averageDaysToRecover: 34, totalDeposited: 350, totalRecovered: 300, outstanding: 50,
    aging: [{bucket: '0-30', lots: 1, outstanding: 50}, {bucket: '31-90', lots: 0, outstanding: 0}, {bucket: '91+', lots: 0, outstanding: 0}], truncated: false,
    lots: [{accountId: 2, accountName: 'Beta', depositDate: '2026-04-20', amount: 50, recovered: 0, outstanding: 50, recoveredDate: null, daysToRecover: null, ageDays: 10},
      {accountId: 1, accountName: 'Alpha', depositDate: '2026-01-01', amount: 100, recovered: 100, outstanding: 0, recoveredDate: '2026-02-10', daysToRecover: 40, ageDays: 119}]},
  performance: {activeDays: 5, winDays: 2, lossDays: 2, winRatePct: 50, grossWin: 400, grossLoss: 400, averageWin: 200, averageLoss: 200,
    payoffRatio: 1, profitFactor: null, expectancyPerDay: 0, medianDayNet: 0, largestWin: 300, largestLoss: 300, totalNet: 0, maxDrawdown: 300, recoveryFactor: null},
  insights: {asOf: '2026-06-30', insights: [
    {code: 'LOSING_STREAK', severity: 'WARN', accountId: null, accountName: null, value: 3, date: null},
    {code: 'DORMANT_ACCOUNT', severity: 'INFO', accountId: 2, accountName: 'Beta', value: 90, date: '2026-04-01'},
    {code: 'LARGE_TRANSACTION_BONUS', severity: 'INFO', accountId: 1, accountName: 'Alpha', value: 500, date: '2026-06-28'}]},
  goals: {asOf: '2026-06-10', goals: [{id: 5, period: 'MONTH', target: 1000, achieved: 600, remaining: 400, pct: 60, elapsedPct: 33.33, onTrack: true,
    reached: false, requiredDaily: 20, daysRemaining: 20}]},
  overview: {totals: totals(300, 4), activeAccounts: 2, activeDays: 3, firstDate: '2026-01-01', lastDate: '2026-02-01', lastAt: '2026-02-01T03:00:00Z',
    averageTransaction: 250, withdrawalToDepositPct: 130, bestAccount: {accountId: 1, accountName: 'Alpha', net: 500},
    worstAccount: {accountId: 2, accountName: 'Beta', net: -200}, currentMonth: '2026-02', currentMonthNet: 500, previousMonthNet: -200, monthNetChange: 700},
  matrix: {months: ['2026-01', '2026-02'], rows: [{accountId: 1, accountName: 'Alpha', cells: [-200, 500], cumulative: [-200, 300], total: 300}], monthTotals: [-200, 500], cumulativeTotals: [-200, 300]},
  drawdowns: {episodes: [{peakDate: '2026-01-01', startDate: '2026-01-02', troughDate: '2026-01-03', recoveryDate: null, depth: 200,
    daysToTrough: 1, daysToRecover: null, durationDays: 5}], count: 1, ongoing: true, longestDays: 5, deepest: 200},
  cadence: {averageGapDays: 7, avgDaysDepositToWithdrawal: null, rows: [{accountId: 1, accountName: 'Alpha', transactions: 3, averageGapDays: 7,
    longestGapDays: 10, longestGapFrom: '2026-01-05', longestGapTo: '2026-01-15', avgDaysDepositToWithdrawal: null}]},
  periodic: {granularity: 'MONTH', totals: totals(300), averageNet: 150, best: null, worst: null, profitablePeriods: 1, losingPeriods: 1,
    rows: [{period: '2026-01', start: '2026-01-01', totals: totals(-200), cumulativeNet: -200, netChange: null, netChangePct: null},
      {period: '2026-02', start: '2026-02-01', totals: totals(500), cumulativeNet: 300, netChange: 700, netChangePct: 350}]},
  accounts: {totals: totals(300), rows: [{accountId: 1, accountName: 'Alpha', totals: totals(300), roiPct: 30, averageDeposit: 1000, averageWithdrawal: 1300,
    firstDate: '2026-01-01', lastDate: '2026-02-01', daysSinceLast: 5, netSharePct: 100}]},
  equity: {points: [{date: '2026-01-01', net: 100, cumulativeNet: 100, peak: 100, drawdown: 0}, {date: '2026-01-02', net: -50, cumulativeNet: 50, peak: 100, drawdown: 50}],
    finalNet: 50, peakNet: 100, maxDrawdown: 50, maxDrawdownDate: '2026-01-02', currentDrawdown: 50, bestDay: {date: '2026-01-01', net: 100},
    worstDay: {date: '2026-01-02', net: -50}, activeDays: 2, winDays: 1, lossDays: 1, longestWinStreak: 1, longestLossStreak: 1, currentStreak: -1},
  rolling: {points: [{date: '2026-01-01', net: 100, rolling7: 100, rolling30: 100}, {date: '2026-01-02', net: -50, rolling7: 50, rolling30: 50}],
    latest7: 50, latest30: 50, best7: 100, worst7: 50, averageDailyNet: 25, volatility: 106.07},
  daily: {totals: totals(50), days: [day('2026-01-01', 100), day('2026-01-02', -50)], best: day('2026-01-01', 100), worst: day('2026-01-02', -50),
    averageNetPerActiveDay: 25, averageTransactionsPerActiveDay: 2},
  activity: {byWeekday: [1, 2, 3, 4, 5, 6, 7].map(slot), byHour: Array.from({length: 24}, (_, i) => slot(i)), byDayOfMonth: Array.from({length: 31}, (_, i) => slot(i + 1)), busiestDayOfMonth: 5,
    matrix: Array.from({length: 7}, (_, d) => Array.from({length: 24}, (_, h) => (d === 0 && h === 9 ? 3 : 0))), busiestWeekday: 1, busiestHour: 9},
  distribution: {byType: [{type: 'DEPOSIT', count: 2, total: 400, min: 100, max: 300, average: 200, median: 200, p90: 300}],
    buckets: [{from: 100, to: 200, deposits: 1, withdrawals: 0, bonuses: 0}, {from: 200, to: 300, deposits: 1, withdrawals: 1, bonuses: 0}],
    largest: [{accountName: 'Alpha', type: 'DEPOSIT', amount: 300, at: '2026-01-02T03:00:00Z'}]},
  bonus: {totalBonuses: 150, totalDeposits: 1000, bonusPctOfDeposits: 15, bonusPctOfPositiveNet: null, averageBonus: 75, largestBonus: 100,
    byMonth: [{key: '2026-01', label: '2026-01', bonuses: 100, deposits: 1000, bonusPctOfDeposits: 10, bonusCount: 1}],
    byAccount: [{key: '1', label: 'Alpha', bonuses: 150, deposits: 0, bonusPctOfDeposits: null, bonusCount: 2}]},
  ledger: {totals: totals(50), truncated: true, limit: 1000, rows: [
    {at: '2026-01-02T03:00:00Z', accountId: 1, accountName: 'Alpha', type: 'WITHDRAWAL', amount: 150, signedNet: 150, runningNet: 50},
    {at: '2026-01-01T03:00:00Z', accountId: 1, accountName: 'Alpha', type: 'BONUS', amount: 5, signedNet: 0, runningNet: -100}]},
  payback: {deposits: 1000, withdrawals: 600, recoveredPct: 60, outstanding: 400, accountsBrokeEven: 0, accountsOutstanding: 1,
    rows: [{accountId: 1, accountName: 'Alpha', deposits: 1000, withdrawals: 600, recoveredPct: 60, outstanding: 400, brokeEven: false,
      firstDate: '2026-01-01', breakEvenDate: null, daysToBreakEven: null}]},
  seasonality: {months: Array.from({length: 12}, (_, i) => month(i + 1)), best: month(12), worst: month(1)},
  projection: {asOf: '2026-06-10', monthToDateNet: 600, daysElapsed: 10, daysRemaining: 20, dailyRunRate30: 10, projectedMonthEnd: 800,
    projectedNext30: 300, projectedYear: 3650, trailing30: 300, trailing90: 300, observedDays: 12},
  comparison: {previousFrom: '2026-01-01', previousTo: '2026-01-31', current: totals(200), previous: totals(100), deltas: [
    {metric: 'COUNT', current: 2, previous: 2, change: 0, changePct: 0}, {metric: 'NET', current: 200, previous: 100, change: 100, changePct: 100},
    {metric: 'DEPOSITS', current: 1000, previous: 0, change: 1000, changePct: null}]},
};

const reportOf = (type: string): InvestmentReport<unknown> => ({
  type: type.toUpperCase(), fromDate: '2026-01-01', toDate: '2026-02-28', timeZone: 'Asia/Ho_Chi_Minh', accountId: null,
  currencies: [{currency: 'VND', data: FIXTURES[type]}]
});

describe('InvestmentReportsPage', () => {
  let fixture: ComponentFixture<InvestmentReportsPage>;
  let api: {page: ReturnType<typeof vi.fn>; investmentReport: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    localStorage.clear();
    api = {
      page: vi.fn().mockReturnValue(of({data: [{id: 1, accountName: 'Alpha', currency: 'VND'}], meta: {page: 0, size: 100, totalElements: 1, totalPages: 1}})),
      investmentReport: vi.fn((type: string) => of(reportOf(type)))
    };
    await TestBed.configureTestingModule({imports: [InvestmentReportsPage], providers: [provideRouter([]), {provide: ApiService, useValue: api}]}).compileComponents();
    fixture = TestBed.createComponent(InvestmentReportsPage);
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('opens on the overview with a 12-month range and no account filter', () => {
    expect(api.investmentReport).toHaveBeenCalledTimes(1);
    const [type, params] = api.investmentReport.mock.calls[0];
    expect(type).toBe('overview');
    expect(params['granularity']).toBeUndefined();
    expect(params['accountId']).toBeUndefined();
    expect(text()).toContain('Alpha');
  });

  it('restores tab, account, range and granularity from the URL query', async () => {
    const query: Record<string, string> = {tab: 'ledger', accountId: '7', fromDate: '2026-01-01', toDate: '2026-01-31', granularity: 'WEEK'};
    TestBed.resetTestingModule();
    api.investmentReport.mockClear();
    await TestBed.configureTestingModule({
      imports: [InvestmentReportsPage],
      providers: [provideRouter([]), {provide: ApiService, useValue: api},
        {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: {get: (key: string) => query[key] ?? null}}}}]
    }).compileComponents();
    const restored = TestBed.createComponent(InvestmentReportsPage);
    restored.detectChanges();
    const [type, params] = api.investmentReport.mock.calls[0];
    expect(type).toBe('ledger');
    expect(params).toMatchObject({accountId: 7, fromDate: '2026-01-01', toDate: '2026-01-31'});
    expect(restored.componentInstance.granularity()).toBe('WEEK');
  });

  it('ignores malformed query values', async () => {
    const query: Record<string, string> = {tab: 'nope', accountId: '-3', fromDate: 'x', toDate: '2026-01-31'};
    TestBed.resetTestingModule();
    api.investmentReport.mockClear();
    await TestBed.configureTestingModule({
      imports: [InvestmentReportsPage],
      providers: [provideRouter([]), {provide: ApiService, useValue: api},
        {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: {get: (key: string) => query[key] ?? null}}}}]
    }).compileComponents();
    TestBed.createComponent(InvestmentReportsPage).detectChanges();
    const [type, params] = api.investmentReport.mock.calls[0];
    expect(type).toBe('overview');
    expect(params['accountId']).toBeUndefined();
    expect(params['fromDate']).not.toBe('x');
  });

  it('shows the active granularity and currency in their selects', () => {
    fixture.componentInstance.choose('periodic');
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('app-periodic-report select') as HTMLSelectElement;
    expect(select.value).toBe('MONTH');
    fixture.componentInstance.chooseGranularity('QUARTER');
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('app-periodic-report select') as HTMLSelectElement).value).toBe('QUARTER');
  });

  it('saves and deletes goals through the API and reloads', () => {
    Object.assign(api, {saveInvestmentGoal: vi.fn(() => of({id: 5})), deleteInvestmentGoal: vi.fn(() => of(undefined))});
    const component = fixture.componentInstance;
    component.choose('goals');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-goals-report [role=progressbar]')).not.toBeNull();
    const before = api.investmentReport.mock.calls.length;
    component.saveGoal({currency: 'VND', period: 'MONTH', targetAmount: 1000});
    component.removeGoal(5);
    expect((api as unknown as {saveInvestmentGoal: ReturnType<typeof vi.fn>}).saveInvestmentGoal).toHaveBeenCalledWith({currency: 'VND', period: 'MONTH', targetAmount: 1000});
    expect((api as unknown as {deleteInvestmentGoal: ReturnType<typeof vi.fn>}).deleteInvestmentGoal).toHaveBeenCalledWith(5);
    expect(api.investmentReport.mock.calls.length).toBe(before + 2);
  });

  it('still offers the goal form when there is no data at all', () => {
    api.investmentReport.mockReturnValue(of({...reportOf('goals'), currencies: []}));
    fixture.componentInstance.choose('goals');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-goals-report form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No goals for this currency yet');
  });

  it('turns insight codes into readable sentences with their values', () => {
    fixture.componentInstance.choose('insights');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Losing streak: 3 active days');
    expect(text).toContain('Beta has had no transactions for 90 days (last 2026-04-01)');
    expect(text).toContain('Unusually large bonus of');
    expect(fixture.nativeElement.querySelector('.sev.warn')).not.toBeNull();
  });

  it('drills from the account ranking into that account overview', () => {
    const component = fixture.componentInstance;
    component.choose('accounts');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('app-accounts-report button.link') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.tab()).toBe('overview');
    expect(component.accountId()).toBe(1);
    const [type, params] = api.investmentReport.mock.lastCall!;
    expect(type).toBe('overview');
    expect(params['accountId']).toBe(1);
  });

  it('sends a custom comparison window only on the comparison tab and requires both ends', () => {
    const component = fixture.componentInstance;
    component.choose('comparison');
    component.compareFrom.set('2025-01-01');
    expect(component.rangeInvalid()).toBe(true); // only one end
    component.compareTo.set('2025-01-31');
    expect(component.rangeInvalid()).toBe(false);
    component.apply();
    expect(api.investmentReport.mock.lastCall![1]).toMatchObject({compareFromDate: '2025-01-01', compareToDate: '2025-01-31'});
    component.choose('periodic');
    expect(api.investmentReport.mock.lastCall![1]['compareFromDate']).toBeUndefined();
  });

  it('reopens the last used tab and account when the URL has none, but the URL still wins', async () => {
    localStorage.setItem('kira-investment-reports', JSON.stringify({tab: 'ledger', accountId: 1}));
    TestBed.resetTestingModule();
    api.investmentReport.mockClear();
    await TestBed.configureTestingModule({imports: [InvestmentReportsPage], providers: [provideRouter([]), {provide: ApiService, useValue: api}]}).compileComponents();
    TestBed.createComponent(InvestmentReportsPage).detectChanges();
    expect(api.investmentReport.mock.calls[0][0]).toBe('ledger');
    expect(api.investmentReport.mock.calls[0][1]['accountId']).toBe(1);
    // corrupt storage must not break the page
    localStorage.setItem('kira-investment-reports', '{not json');
    TestBed.resetTestingModule();
    api.investmentReport.mockClear();
    await TestBed.configureTestingModule({imports: [InvestmentReportsPage], providers: [provideRouter([]), {provide: ApiService, useValue: api}]}).compileComponents();
    TestBed.createComponent(InvestmentReportsPage).detectChanges();
    expect(api.investmentReport.mock.calls[0][0]).toBe('overview');
  });

  it('blocks ranges longer than five years before calling the API', () => {
    const component = fixture.componentInstance;
    const calls = api.investmentReport.mock.calls.length;
    component.fromDate.set('2015-01-01');
    component.toDate.set('2026-01-01');
    fixture.detectChanges();
    expect(component.rangeInvalid()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    component.apply();
    expect(api.investmentReport.mock.calls.length).toBe(calls);
  });

  it('sends the month granularity only for the periodic report', () => {
    fixture.componentInstance.choose('periodic');
    fixture.detectChanges();
    const [type, params] = api.investmentReport.mock.lastCall!;
    expect(type).toBe('periodic');
    expect(params['granularity']).toBe('MONTH');
    expect(text()).toContain('2026-02');
  });

  it('renders every report tab from realistic payloads without throwing', () => {
    const component = fixture.componentInstance;
    for (const tab of component.tabs) {
      component.choose(tab);
      fixture.detectChanges();
      expect(api.investmentReport).toHaveBeenLastCalledWith(tab, expect.any(Object));
      expect(fixture.nativeElement.querySelector('.panel:not(.filters)'), `tab ${tab}`).not.toBeNull();
      expect(text(), `tab ${tab}`).not.toContain('NaN');
      expect(text(), `tab ${tab}`).not.toContain('undefined');
    }
  });

  it('shows guarded blanks for missing percentages and a calendar for the daily tab', () => {
    const component = fixture.componentInstance;
    component.choose('bonus');
    fixture.detectChanges();
    expect(text()).toContain('15%');
    expect(text()).toContain('—');
    component.choose('daily');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.day.active').length).toBe(2);
  });

  it('passes the account filter and refuses an inverted range', () => {
    const component = fixture.componentInstance;
    component.chooseAccount('1');
    component.apply();
    expect(api.investmentReport.mock.lastCall![1]['accountId']).toBe(1);
    const calls = api.investmentReport.mock.calls.length;
    component.fromDate.set('2026-03-01');
    component.toDate.set('2026-01-01');
    component.apply();
    expect(api.investmentReport.mock.calls.length).toBe(calls);
  });

  it('shows the empty state when the API returns no currencies and an error state on failure', () => {
    const component = fixture.componentInstance;
    api.investmentReport.mockReturnValueOnce(of({...reportOf('overview'), currencies: []}));
    component.load();
    fixture.detectChanges();
    expect(text()).toContain('No completed transactions');
    api.investmentReport.mockReturnValueOnce(throwError(() => new Error('boom')));
    component.load();
    fixture.detectChanges();
    expect(text()).toContain('Unable to load this report');
  });
});
