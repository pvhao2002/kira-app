import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {BankDashboard, bankErrorMessage, useBankApi} from './bankApi';
import {
  errorMessage,
  InvestmentStatisticsOperations,
  InvestmentStatisticsOverview,
  useInvestmentApi
} from './investmentApi';
import {dateLabel, money, validDate} from './data';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Field, go, Info, Metric, Progress, Row, Screen, Section, T} from './ui';

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return iso(date);
};
const MAX_RANGE_DAYS = 365;

export function FinanceReport() {
  const bankApi = useBankApi();
  const investmentApi = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [fromDate, setFromDate] = useState(daysAgo(29));
  const [toDate, setToDate] = useState(iso(new Date()));
  const [bank, setBank] = useState<BankDashboard | null>(null);
  const [investment, setInvestment] = useState<InvestmentStatisticsOverview | null>(null);
  const [operations, setOperations] = useState<InvestmentStatisticsOperations | null>(null);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [bankError, setBankError] = useState('');
  const [investmentError, setInvestmentError] = useState('');

  const loadInvestment = useCallback((from: string, to: string) => {
    const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
    if (!validDate(from) || !validDate(to) || span < 0 || span > MAX_RANGE_DAYS) {
      setInvestmentError(t('Khoảng ngày không hợp lệ (tối đa 365 ngày).'));
      return;
    }
    setLoading(true);
    investmentApi.getAllStatistics({fromDate: from, toDate: to}).then(result => {
      setInvestment(result);
      setInvestmentError('');
      setCurrency(current => result.currencies.some(item => item.currency === current) ? current : result.currencies[0]?.currency || '');
    }).catch(e => setInvestmentError(t(errorMessage(e)))).finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    bankApi.dashboard().then(setBank).catch(e => setBankError(t(bankErrorMessage(e))));
    investmentApi.getOperations().then(setOperations).catch(() => undefined);
    loadInvestment(fromDate, toDate);
  }, []);

  function preset(days: number) {
    const from = daysAgo(days - 1);
    const to = iso(new Date());
    setFromDate(from);
    setToDate(to);
    loadInvestment(from, to);
  }

  const flow = investment?.currencies.find(item => item.currency === currency) || investment?.currencies[0];
  const banks = [...(bank?.banks || [])].sort((a, b) => b.currentBalance - a.currentBalance);
  const accounts = [...(investment?.accounts || [])].sort((a, b) => b.netAmount - a.netAmount);

  return <Screen title={t('Báo cáo tài chính')} subtitle={t('Tổng hợp tín dụng và dòng tiền đầu tư')} back>
    <Section title={t('Tín dụng')}/>
    {bankError ? <Info tone="error">{bankError}</Info> : !bank ? <ActivityIndicator color={c.primary}/> : <>
      <Card tint><Row><Metric label={t('TỔNG HẠN MỨC')} value={money(bank.totalCreditLimit, bank.currency, lang)}
                              color={c.text}/><Metric label={t('DƯ NỢ HIỆN TẠI')}
                                                      value={money(bank.currentBalance, bank.currency, lang)}/></Row><Row><Metric
        label={t('DƯ NỢ SAO KÊ')} value={money(bank.totalStatementDebt, bank.currency, lang)}/><Metric
        label={t('CÒN KHẢ DỤNG')} value={money(bank.availableCredit, bank.currency, lang)} color={c.success}/></Row><Row><T
        size={11} color={c.muted} style={{flex: 1}}>{t('Mức sử dụng hạn mức')}</T><T size={11} bold
                                                                                   color={bank.utilizationRate >= 80 ? c.error : c.primary}>{bank.utilizationRate.toFixed(1)}%</T></Row><Progress
        value={bank.utilizationRate} color={bank.utilizationRate >= 80 ? c.error : c.primary}/></Card>
      {banks.map(item => <Card key={item.bankId}><Row><T size={13} bold style={{flex: 1}}>{item.bankName}</T><Badge
        tone={item.utilizationRate >= 80 ? 'error' : 'primary'}>{item.utilizationRate.toFixed(1)}%</Badge></Row><Row><Metric
        label={t('DƯ NỢ HIỆN TẠI')} value={money(item.currentBalance, item.currency, lang)}/><Metric
        label={t('CÒN KHẢ DỤNG')} value={money(item.availableCredit, item.currency, lang)} color={c.success}/></Row></Card>)}
    </>}

    <Section title={t('Đầu tư')}/>
    <Chips value="" onChange={value => preset(Number(value))} values={[{value: '7', label: t('7 ngày')}, {
      value: '30',
      label: t('30 ngày')
    }, {value: '90', label: t('90 ngày')}, {value: '365', label: t('12 tháng')}]}/>
    <Row><View style={{flex: 1}}><Field label={t('Từ ngày')} value={fromDate} onChangeText={setFromDate}
                                        autoCapitalize="none"/></View><View style={{flex: 1}}><Field
      label={t('Đến ngày')} value={toDate} onChangeText={setToDate} autoCapitalize="none"/></View></Row>
    <Button label={t('Áp dụng')} kind="secondary" icon="funnel-outline" onPress={() => loadInvestment(fromDate, toDate)}/>
    {investmentError ? <Info tone="error">{investmentError}</Info> : null}
    {loading && !investment ? <ActivityIndicator color={c.primary}/> : investment ? <>
      {investment.currencies.length > 1 ? <Chips value={flow?.currency || ''} onChange={setCurrency}
                                                 values={investment.currencies.map(item => ({
                                                   value: item.currency,
                                                   label: item.currency
                                                 }))}/> : null}
      {flow ? <Card tint><T size={11} color={c.primary}>{t('DÒNG TIỀN RÒNG')} · {flow.currency}</T><T size={24}
                                                                                                       bold
                                                                                                       color={flow.netAmount >= 0 ? c.success : c.error}>{money(flow.netAmount, flow.currency, lang)}</T><Row><Metric
        label={t('NẠP')} value={money(flow.deposits, flow.currency, lang)}/><Metric label={t('RÚT')}
                                                                                    value={money(flow.withdrawals, flow.currency, lang)}/></Row><Row><Metric
        label={t('THƯỞNG')} value={money(flow.bonuses, flow.currency, lang)}/><Metric label={t('SỐ GIAO DỊCH')}
                                                                                      value={String(flow.totalCount)}
                                                                                      color={c.text}/></Row></Card> :
        <Info>{t('Không có giao dịch trong khoảng này.')}</Info>}
      {accounts.map(account => <Card key={account.accountId}><Row><View style={{flex: 1}}><T size={13}
                                                                                            bold>{account.accountName}</T><T
        size={10} color={c.muted}>{account.accountCode || account.currency} · {account.status} · {t('{{n}} giao dịch', {n: account.totalCount})}</T></View><T
        size={13} bold
        color={account.netAmount >= 0 ? c.success : c.error}>{money(account.netAmount, account.currency, lang)}</T></Row></Card>)}
    </> : null}

    {operations ? <>
      <Section title={t('Vận hành đầu tư')}/>
      <Card><Row><Metric label={t('AI CHỜ')} value={String(operations.ai.pending + operations.ai.processing)}/><Metric
        label={t('AI SẴN SÀNG')} value={String(operations.ai.ready)} color={c.success}/><Metric label={t('AI LỖI')}
                                                                                                value={String(operations.ai.failed)}
                                                                                                color={c.error}/></Row><Row><Metric
        label={t('LÔ CHỜ DUYỆT')} value={String(operations.imports.total)}/><Metric label={t('TRA SOÁT MỞ')}
                                                                                    value={String(operations.reconciliation.open + operations.reconciliation.inReview + operations.reconciliation.needsInfo)}/></Row>
        {operations.imports.items.map(item => <Row key={item.batchId}><T size={11} style={{flex: 1}}>{item.accountName} · {dateLabel(item.createdAt)}</T><Badge
          tone="warning">{t('{{n}} cần duyệt', {n: item.reviewCount})}</Badge></Row>)}
        {operations.reconciliation.items.map(item => <Row key={item.id}><T size={11}
                                                                           style={{flex: 1}}>{item.accountName} · {money(item.amount, item.currency, lang)}</T><Badge
          tone="muted">{item.status}</Badge></Row>)}
        <Row><View style={{flex: 1}}><Button label={t('Hàng đợi AI')} kind="secondary" onPress={() => go('queue')}/></View><View
          style={{flex: 1}}><Button label={t('Hồ sơ tra soát')} kind="secondary"
                                    onPress={() => go('investment-reports')}/></View></Row>
      </Card>
    </> : null}
  </Screen>;
}
