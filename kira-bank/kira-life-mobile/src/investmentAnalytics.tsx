import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {money} from './data';
import {AccountResponse, errorMessage, InvestmentReport, useInvestmentApi} from './investmentApi';
import {InvestmentNav} from './investment';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {ReportCtx} from './analyticsParts';
import {
  AccountsView, ActivityView, BonusView, CadenceView, ComparisonView, DailyView, DistributionView, DrawdownsView, AllocationView, EquityView, GoalsView, InsightsView, LedgerView, LotsView,
  MatrixView, OverviewView, PerformanceView, PaybackView, PeriodicView, ProjectionView, RollingView,
  SeasonalityView
} from './analyticsViews';
import {Button, Card, Chips, Empty, Field, Info, Screen, T} from './ui';

type Tab = 'overview' | 'insights' | 'goals' | 'periodic' | 'accounts' | 'matrix' | 'equity' | 'performance' | 'drawdowns' | 'rolling' | 'daily' | 'activity' | 'distribution' | 'bonus' | 'ledger' | 'cadence' | 'allocation' | 'lots' | 'payback' | 'seasonality' | 'projection' | 'comparison';
const TABS: { value: Tab; label: string; months: number }[] = [
  {value: 'overview', label: 'Tổng quan', months: 12}, {value: 'insights', label: 'Nhận xét tự động', months: 3}, {value: 'goals', label: 'Mục tiêu', months: 12}, {value: 'periodic', label: 'Lãi/lỗ theo kỳ', months: 12},
  {value: 'accounts', label: 'Xếp hạng tài khoản', months: 12}, {value: 'matrix', label: 'Tài khoản × tháng', months: 12},
  {value: 'equity', label: 'Đường vốn & sụt giảm', months: 3}, {value: 'performance', label: 'Chỉ số hiệu suất', months: 12}, {value: 'drawdowns', label: 'Các đợt sụt giảm', months: 12}, {value: 'rolling', label: 'Cuốn chiếu & biến động', months: 3},
  {value: 'daily', label: 'Lịch theo ngày', months: 3}, {value: 'activity', label: 'Quy luật giao dịch', months: 3},
  {value: 'distribution', label: 'Quy mô giao dịch', months: 3}, {value: 'bonus', label: 'Phân tích thưởng', months: 12},
  {value: 'ledger', label: 'Sổ giao dịch', months: 1}, {value: 'cadence', label: 'Nhịp & vòng quay vốn', months: 12}, {value: 'allocation', label: 'Phân bổ vốn', months: 24}, {value: 'lots', label: 'Lô vốn (FIFO)', months: 24}, {value: 'payback', label: 'Hoàn vốn', months: 24}, {value: 'seasonality', label: 'Tính mùa vụ', months: 24},
  {value: 'projection', label: 'Ước tính theo nhịp hiện tại', months: 3}, {value: 'comparison', label: 'So sánh kỳ', months: 1},
];
const RANGES = [1, 3, 6, 12, 24];
const GRANULARITIES = [{value: 'DAY', label: 'Theo ngày'}, {value: 'WEEK', label: 'Theo tuần'}, {value: 'MONTH', label: 'Theo tháng'}, {value: 'QUARTER', label: 'Theo quý'}, {value: 'YEAR', label: 'Theo năm'}];

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rangeFor(months: number) {
  const now = new Date();
  return {fromDate: iso(new Date(now.getFullYear(), now.getMonth() - months + 1, 1)), toDate: iso(now)};
}

function render(tab: Tab, data: any, ctx: ReportCtx, report: InvestmentReport<unknown>, actions: { onSave: (p: string, a: number) => Promise<boolean>; onDelete: (id: number) => void; onSelectAccount: (id: number) => void }) {
  switch (tab) {
    case 'performance': return <PerformanceView data={data} ctx={ctx}/>;
    case 'insights': return <InsightsView data={data} ctx={ctx}/>;
    case 'goals': return <GoalsView data={data} ctx={ctx} onSave={actions.onSave} onDelete={actions.onDelete}/>;
    case 'overview': return <OverviewView data={data} ctx={ctx}/>;
    case 'matrix': return <MatrixView data={data} ctx={ctx}/>;
    case 'drawdowns': return <DrawdownsView data={data} ctx={ctx}/>;
    case 'cadence': return <CadenceView data={data} ctx={ctx}/>;
    case 'periodic': return <PeriodicView data={data} ctx={ctx}/>;
    case 'accounts': return <AccountsView data={data} ctx={ctx} onSelect={actions.onSelectAccount}/>;
    case 'equity': return <EquityView data={data} ctx={ctx}/>;
    case 'rolling': return <RollingView data={data} ctx={ctx}/>;
    case 'daily': return <DailyView data={data} ctx={ctx} fromDate={report.fromDate} toDate={report.toDate}/>;
    case 'bonus': return <BonusView data={data} ctx={ctx}/>;
    case 'ledger': return <LedgerView data={data} ctx={ctx}/>;
    case 'allocation': return <AllocationView data={data} ctx={ctx}/>;
    case 'lots': return <LotsView data={data} ctx={ctx}/>;
    case 'payback': return <PaybackView data={data} ctx={ctx}/>;
    case 'seasonality': return <SeasonalityView data={data} ctx={ctx}/>;
    case 'projection': return <ProjectionView data={data} ctx={ctx}/>;
    case 'activity': return <ActivityView data={data} ctx={ctx}/>;
    case 'distribution': return <DistributionView data={data} ctx={ctx}/>;
    case 'comparison': return <ComparisonView data={data} ctx={ctx}/>;
  }
}

const PREF_KEY = 'kira-investment-analytics';

export function InvestmentAnalytics() {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [tab, setTab] = useState<Tab>('overview');
  const [months, setMonths] = useState(12);
  const [ready, setReady] = useState(false); // wait for the remembered tab so the first request is the right one
  const [granularity, setGranularity] = useState('MONTH');
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [currency, setCurrency] = useState('');
  const [loaded, setLoaded] = useState<{ tab: Tab; report: InvestmentReport<unknown> } | null>(null);
  const request = useRef(0);
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
  // both ends or neither: a half-filled window would be ignored by the API, so it is not sent
  const compareValid = (compareFrom === '' && compareTo === '') || (isDate(compareFrom) && isDate(compareTo) && compareFrom <= compareTo);
  // reload only when the window becomes valid or changes, not on every keystroke of a half-typed date
  const compareKey = compareValid && compareFrom ? `${compareFrom}|${compareTo}` : '';
  const compareApplied: (string | undefined)[] = compareKey ? compareKey.split('|') : [undefined, undefined];
  // A response only counts for the tab it was requested for (the tab changes a frame before the new request starts).
  const report = loaded?.tab === tab ? loaded.report : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  // Per-viewer convenience only: any storage failure just means opening on the defaults.
  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then(raw => {
      const saved = raw ? JSON.parse(raw) as { tab?: Tab; accountId?: string } : {};
      const found = TABS.find(item => item.value === saved.tab);
      if (found) { setTab(found.value); setMonths(found.months); }
      if (typeof saved.accountId === 'string') setAccountId(saved.accountId);
    }).catch(() => undefined).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(PREF_KEY, JSON.stringify({tab, accountId})).catch(() => undefined);
  }, [ready, tab, accountId]);
  useEffect(() => {
    api.listAllAccounts().then(setAccounts).catch(() => undefined);
  }, []);
  const load = useCallback(() => {
    if (!ready) return;
    const id = ++request.current;
    setLoading(true);
    setError('');
    setLoaded(null);
    api.getReport<unknown>(tab, {...rangeFor(months), accountId: accountId || undefined, granularity: tab === 'periodic' ? granularity : undefined,
      compareFromDate: tab === 'comparison' ? compareApplied[0] : undefined, compareToDate: tab === 'comparison' ? compareApplied[1] : undefined}).then(value => {
      if (id !== request.current) return;
      setLoaded({tab, report: value});
      setError('');
      setCurrency(current => value.currencies.some(item => item.currency === current) ? current : value.currencies[0]?.currency ?? '');
    }).catch(e => id === request.current && setError(t(errorMessage(e)))).finally(() => id === request.current && setLoading(false));
  }, [ready, tab, months, granularity, accountId, compareKey, t]);
  useEffect(load, [load]);

  const actions = {
    onSelectAccount: (id: number) => { setAccountId(String(id)); setTab('overview'); setMonths(TABS[0].months); },
    // failures show above the report so the typed value survives and the screen is not replaced by an error card
    onSave: (period: string, targetAmount: number) => api.saveGoal({currency: currency || 'VND', period, targetAmount})
      .then(() => { setActionError(''); load(); return true; }).catch(e => { setActionError(t(errorMessage(e))); return false; }),
    onDelete: (id: number) => api.deleteGoal(id).then(() => { setActionError(''); load(); }).catch(e => setActionError(t(errorMessage(e))))
  };
  const selected = report?.currencies.find(item => item.currency === currency) ?? report?.currencies[0];
  const ctx: ReportCtx = {lang, currency: selected?.currency ?? '', fmt: value => money(value, selected?.currency ?? 'VND', lang)};
  return <Screen title={t('Báo cáo đầu tư')} subtitle={t('Phân tích chi tiết giao dịch nạp, rút và thưởng đã hoàn tất.')}>
    <InvestmentNav active="investment-analytics"/>
    <Chips value={tab} onChange={value => {
      const next = TABS.find(item => item.value === value)!;
      setTab(next.value);
      setMonths(next.months);
    }} values={TABS.map(item => ({value: item.value, label: t(item.label)}))}/>
    <Chips value={String(months)} onChange={value => setMonths(Number(value))}
           values={RANGES.map(m => ({value: String(m), label: t(`${m} tháng`)}))}/>
    {accounts.length > 1 ? <Chips value={accountId} onChange={setAccountId} values={[{value: '', label: t('Tất cả tài khoản')},
      ...accounts.map(account => ({value: String(account.id), label: account.accountName}))]}/> : null}
    {tab === 'periodic' ? <Chips value={granularity} onChange={setGranularity} values={GRANULARITIES.map(item => ({value: item.value, label: t(item.label)}))}/> : null}
    {tab === 'comparison' ? <View style={{gap: 6}}>
      <Field label={t('So với: từ ngày (YYYY-MM-DD, tùy chọn)')} value={compareFrom} onChangeText={setCompareFrom} placeholder="2026-01-01" autoCapitalize="none"/>
      <Field label={t('So với: đến ngày (YYYY-MM-DD, tùy chọn)')} value={compareTo} onChangeText={setCompareTo} placeholder="2026-01-31" autoCapitalize="none"
             error={compareValid ? undefined : t('Nhập đủ cả hai ngày hợp lệ (từ ≤ đến) hoặc để trống để so với kỳ liền trước.')}/>
    </View> : null}
    {report && report.currencies.length > 1 ? <Chips value={ctx.currency} onChange={setCurrency}
      values={report.currencies.map(item => ({value: item.currency, label: item.currency}))}/> : null}
    <T size={10} color={c.muted}>{t('Lãi/lỗ = rút − nạp. Tiền thưởng hiển thị riêng. Các loại tiền tệ không bao giờ bị cộng lẫn.')}</T>
    {actionError ? <Info tone="error">{actionError}</Info> : null}
    {loading || (!report && !error) ? <ActivityIndicator color={c.primary}/> : error ?
      <Card><Info tone="error">{error}</Info><Button label={t('Thử lại')} kind="secondary" onPress={load}/></Card> :
      selected && report ? render(tab, selected.data, ctx, report, actions) :
        tab === 'goals' ? <GoalsView data={{asOf: '', goals: []}} ctx={{...ctx, currency: 'VND', fmt: value => money(value, 'VND', lang)}}
                                     onSave={actions.onSave} onDelete={actions.onDelete}/> :
        <Empty title={t('Không có giao dịch hoàn tất trong khoảng này.')}/>}
    {!loading ? <Button label={t('Tải lại')} kind="secondary" onPress={load}/> : null}
  </Screen>;
}
