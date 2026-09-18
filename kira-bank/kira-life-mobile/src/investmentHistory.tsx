import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, Share, View} from 'react-native';
import {
  AccountResponse,
  InvestmentReconciliationReportResponse,
  InvestmentStatisticsResponse,
  InvestmentTransactionStatus,
  InvestmentTransactionType,
  TransactionResponse,
  useInvestmentApi
} from './investmentApi';
import {dateLabel, money, validDate} from './data';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {
  Badge,
  Button,
  Card,
  Chips,
  Empty,
  Field,
  go,
  Icon,
  Info,
  Metric,
  Row,
  Screen,
  Section,
  T,
  useNotice
} from './ui';

const types: InvestmentTransactionType[] = ['DEPOSIT', 'WITHDRAWAL', 'BONUS'];
const typeLabels: Record<InvestmentTransactionType, string> = {
  DEPOSIT: 'Nạp tiền',
  WITHDRAWAL: 'Rút tiền',
  BONUS: 'Thưởng'
};
const statusLabels: Record<InvestmentTransactionStatus, string> = {
  PENDING: 'Chờ xử lý',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy'
};
const typeIcon: Record<InvestmentTransactionType, React.ComponentProps<typeof Icon>['name']> = {
  DEPOSIT: 'arrow-down-outline',
  WITHDRAWAL: 'arrow-up-outline',
  BONUS: 'gift-outline'
};
type RowTransaction = TransactionResponse & { accountId: number; accountName: string };
type StatusFilter = InvestmentTransactionStatus | 'all';

function typeAmount(stats: InvestmentStatisticsResponse | null, type: InvestmentTransactionType) {
  return stats?.byType.find(item => item.transactionType === type)?.amount ?? 0;
}

function typeCount(stats: InvestmentStatisticsResponse | null, type: InvestmentTransactionType) {
  return stats?.byType.find(item => item.transactionType === type)?.count ?? 0;
}

function csvField(value: string | number | null | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function mergeDaily(first: InvestmentStatisticsResponse['daily'] = [], second: InvestmentStatisticsResponse['daily'] = []) {
  const byDate = new Map(first.map(item => [item.date, {...item}]));
  second.forEach(item => {
    const existing = byDate.get(item.date);
    if (!existing) {
      byDate.set(item.date, {...item});
      return;
    }
    existing.deposits += item.deposits;
    existing.withdrawals += item.withdrawals;
    existing.bonuses += item.bonuses;
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function ApiTransactionRow({transaction}: { transaction: RowTransaction }) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const withdrawal = transaction.transactionType === 'WITHDRAWAL';
  const bonus = transaction.transactionType === 'BONUS';
  return <Pressable accessibilityRole="button" accessibilityLabel={t('{{type}}, {{amount}}, xem chi tiết', {
    type: t(typeLabels[transaction.transactionType]),
    amount: money(transaction.amount, transaction.currency, lang)
  })} onPress={() => go('transaction-detail', {id: String(transaction.id), accountId: String(transaction.accountId)})}>
    <Card style={{padding: 14, gap: 10}}><Row style={{gap: 8}}><View style={{
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.elevated,
      alignItems: 'center',
      justifyContent: 'center'
    }}><Icon name={typeIcon[transaction.transactionType]} color={bonus ? c.lavender : c.primary} size={18}/></View><View
      style={{flex: 1}}><T size={12} bold>{t(typeLabels[transaction.transactionType])}</T><T size={9}
                                                                                             color={c.muted}>{dateLabel(transaction.transactionAt)} • {transaction.accountName}</T></View><View
      style={{alignItems: 'flex-end', maxWidth: '42%'}}><T size={13} color={bonus ? c.lavender : c.primary}
                                                           bold>{withdrawal ? '−' : '+'}{money(transaction.amount, transaction.currency, lang)}</T><T
      size={9}
      color={transaction.transactionStatus === 'COMPLETED' ? c.success : c.warning}>• {t(statusLabels[transaction.transactionStatus])}</T></View></Row><Row
      style={{justifyContent: 'space-between'}}><T size={9}
                                                   color={c.muted}>{t('Mã GD')}: {transaction.externalTransactionId || t('— (Không có)')}</T><T
      size={9} color={c.primary}>{t('Chi tiết')}</T></Row></Card>
  </Pressable>;
}

function StatsCard({currency, stats}: { currency: string; stats: InvestmentStatisticsResponse }) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Card><Row><Icon name="analytics-outline"/><View style={{flex: 1}}><T size={12}
                                                                               bold>{t('Thống kê dòng tiền')} · {currency}</T><T
    size={10}
    color={c.muted}>{t('{{n}} giao dịch đã ghi nhận', {n: stats.totalCount})}</T></View><Badge>{t('Độc lập')}</Badge></Row><Row
    style={{gap: 6}}>{types.map(type => <View key={type} style={{flex: 1, gap: 4}}><T size={9}
                                                                                      color={c.muted}>{t(typeLabels[type])}</T><T
    size={12} color={type === 'BONUS' ? c.lavender : c.primary}
    bold>{money(typeAmount(stats, type), currency, lang)}</T><T size={9}
                                                                color={c.muted}>{t('{{n}} bản ghi', {n: typeCount(stats, type)})}</T></View>)}</Row><Row><Metric
    label={t('Tổng dòng tiền')} value={money(stats.totalAmount, currency, lang)}/><Metric label={t('Giá trị ròng')}
                                                                                          value={money(stats.netAmount, currency, lang)}
                                                                                          color={stats.netAmount < 0 ? c.error : c.success}/></Row></Card>;
}

async function loadAllTransactions(api: ReturnType<typeof useInvestmentApi>, account: AccountResponse, params: {
  fromDate?: string;
  toDate?: string;
  status?: InvestmentTransactionStatus
}) {
  const all: TransactionResponse[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const result = await api.listTransactions(account.id, {...params, page, size: 100});
    all.push(...result.data);
    totalPages = result.meta.totalPages;
    page += 1;
  } while (page < totalPages);
  return all.map(transaction => ({...transaction, accountId: account.id, accountName: account.accountName}));
}

async function loadAllAccounts(api: ReturnType<typeof useInvestmentApi>) {
  const all: AccountResponse[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const result = await api.listAccounts('', page, 100);
    all.push(...result.data);
    totalPages = result.meta.totalPages;
    page += 1;
  } while (page < totalPages);
  return all;
}

function useInvestmentAccounts() {
  const api = useInvestmentApi();
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    loadAllAccounts(api).then(result => {
      setAccounts(result);
      setError('');
    }).catch(() => setError('Không tải được danh sách tài khoản đầu tư.')).finally(() => setLoading(false));
  }, []);
  return {accounts, loading, error};
}

export function InvestmentHistory({initialFilter = false}: { initialFilter?: boolean }) {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {notify} = useNotice();
  const {accounts, loading: accountsLoading, error: accountsError} = useInvestmentAccounts();
  const [accountKey, setAccountKey] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('COMPLETED');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [query, setQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<InvestmentTransactionType[]>([]);
  const [openFilter, setOpenFilter] = useState(initialFilter);
  const [searchOpen, setSearchOpen] = useState(false);
  const [rows, setRows] = useState<RowTransaction[]>([]);
  const [stats, setStats] = useState<InvestmentStatisticsResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const targetAccounts = useMemo(() => accountKey === 'all' ? accounts : accounts.filter(account => String(account.id) === accountKey), [accounts, accountKey]);
  useEffect(() => {
    if (!targetAccounts.length) {
      setRows([]);
      setStats([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const params = {
      fromDate: appliedFromDate || undefined,
      toDate: appliedToDate || undefined,
      status: status === 'all' ? undefined : status
    };
    Promise.all([Promise.all(targetAccounts.map(account => loadAllTransactions(api, account, params))), Promise.all(targetAccounts.map(account => api.getStatistics(account.id, params)))])
      .then(([loadedRows, loadedStats]) => {
        if (!active) return;
        setRows(loadedRows.flat().sort((a, b) => b.transactionAt.localeCompare(a.transactionAt)));
        setStats(loadedStats);
      })
      .catch(e => {
        if (active) {
          setError('Không tải được lịch sử giao dịch.');
          notify(String(e));
        }
      }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accounts, accountKey, appliedFromDate, appliedToDate, status]);
  const filtered = rows.filter(row => (!selectedTypes.length || selectedTypes.includes(row.transactionType)) && (!minAmount || row.amount >= Number(minAmount)) && (!maxAmount || row.amount <= Number(maxAmount)) && `${row.externalTransactionId || ''} ${row.description || ''} ${t(typeLabels[row.transactionType])}`.toLocaleLowerCase(lang).includes(query.toLocaleLowerCase(lang)));
  const groupedStats = stats.reduce<Record<string, InvestmentStatisticsResponse>>((result, item) => {
    const existing = result[item.currency];
    if (!existing) {
      result[item.currency] = {...item, byType: item.byType.map(value => ({...value}))};
      return result;
    }
    result[item.currency] = {
      ...existing,
      totalCount: existing.totalCount + item.totalCount,
      totalAmount: existing.totalAmount + item.totalAmount,
      netAmount: existing.netAmount + item.netAmount,
      daily: mergeDaily(existing.daily, item.daily),
      byType: types.map(type => {
        const current = existing.byType.find(value => value.transactionType === type);
        const incoming = item.byType.find(value => value.transactionType === type);
        return {
          transactionType: type,
          count: (current?.count ?? 0) + (incoming?.count ?? 0),
          amount: (current?.amount ?? 0) + (incoming?.amount ?? 0)
        };
      }),
    };
    return result;
  }, {});
  const activeFilters = Number(accountKey !== 'all') + Number(status !== 'COMPLETED') + Number(selectedTypes.length > 0) + Number(!!fromDate || !!toDate) + Number(!!minAmount || !!maxAmount);

  function applyFilter() {
    if ((fromDate && !validDate(fromDate)) || (toDate && !validDate(toDate)) || (fromDate && toDate && fromDate > toDate)) {
      setError(t('Ngày không hợp lệ hoặc ngày bắt đầu sau ngày kết thúc.'));
      return;
    }
    if ([minAmount, maxAmount].some(value => value && (!Number.isFinite(Number(value)) || Number(value) < 0)) || (minAmount && maxAmount && Number(minAmount) > Number(maxAmount))) {
      setError(t('Khoảng số tiền không hợp lệ.'));
      return;
    }
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setOpenFilter(false);
    setError('');
  }

  function reset() {
    setAccountKey('all');
    setStatus('COMPLETED');
    setFromDate('');
    setToDate('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setQuery('');
    setMinAmount('');
    setMaxAmount('');
    setSelectedTypes([]);
    setError('');
  }

  async function shareCsv() {
    if (!filtered.length) {
      notify(t('Không có dữ liệu để xuất.'));
      return;
    }
    const header = ['transaction_id', 'account', 'type', 'status', 'amount', 'currency', 'transaction_at', 'external_transaction_id', 'description'];
    const lines = filtered.map(row => [row.id, row.accountName, row.transactionType, row.transactionStatus, row.transactionType === 'WITHDRAWAL' ? -row.amount : row.amount, row.currency, row.transactionAt, row.externalTransactionId, row.description].map(csvField).join(','));
    try {
      await Share.share({title: t('Xuất lịch sử giao dịch'), message: [header.join(','), ...lines].join('\n')});
    } catch {
      notify(t('Không thể chia sẻ dữ liệu trên thiết bị này.'));
    }
  }

  return <Screen title={t('Lịch sử giao dịch')} back><Row><View><Badge>{t('PHÂN HỆ ĐẦU TƯ')}</Badge></View><T size={11}
                                                                                                 style={{flex: 1}}>• {t('Lịch sử giao dịch')}</T><Pressable
    accessibilityLabel={t('Tìm kiếm giao dịch')} accessibilityRole="button"
    onPress={() => setSearchOpen(value => !value)} style={{padding: 8}}><Icon name="search-outline"
                                                                              size={18}/></Pressable><Pressable
    accessibilityLabel={t('Bộ lọc')} accessibilityRole="button" onPress={() => setOpenFilter(value => !value)}
    style={{padding: 8}}><Icon name="options-outline" size={18}/>{activeFilters ?
    <T size={9} color={c.primary}>{activeFilters}</T> : null}</Pressable></Row>
    {searchOpen ? <Field label={t('Tìm giao dịch')} placeholder={t('Mã giao dịch, mô tả…')} value={query}
                         onChangeText={setQuery}/> : null}<Card><Row><Icon name="wallet-outline"/><View
      style={{flex: 1}}><T size={9} color={c.muted}>{t('TÀI KHOẢN ĐỐI SOÁT')}</T><T size={13}
                                                                                    bold>{accountKey === 'all' ? t('Tất cả tài khoản') : targetAccounts[0]?.accountName || '—'}</T></View><Pressable
      accessibilityRole="button" onPress={() => setOpenFilter(true)}><T size={11}
                                                                        color={c.primary}>{t('Đổi ⇄')}</T></Pressable></Row></Card>
    {accountsLoading ? <ActivityIndicator color={c.primary}/> : accountsError ?
      <Info tone="error">{t(accountsError)}</Info> : null}
    {openFilter ?
      <Card><Section title={t('Bộ lọc lịch sử giao dịch')}/><Chips value={accountKey} onChange={setAccountKey}
                                                                   values={[{
                                                                     value: 'all',
                                                                     label: t('Tất cả tài khoản')
                                                                   }, ...accounts.map(account => ({
                                                                     value: String(account.id),
                                                                     label: account.accountName
                                                                   }))]}/><Chips value={status}
                                                                                 onChange={value => setStatus(value as StatusFilter)}
                                                                                 values={[{
                                                                                   value: 'COMPLETED',
                                                                                   label: t(statusLabels.COMPLETED)
                                                                                 }, {
                                                                                   value: 'PENDING',
                                                                                   label: t(statusLabels.PENDING)
                                                                                 }, {
                                                                                   value: 'FAILED',
                                                                                   label: t(statusLabels.FAILED)
                                                                                 }, {
                                                                                   value: 'CANCELLED',
                                                                                   label: t(statusLabels.CANCELLED)
                                                                                 }, {
                                                                                   value: 'all',
                                                                                   label: t('Tất cả')
                                                                                 }]}/><Section
        title={t('Loại giao dịch')}/><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{[{
        value: 'all',
        label: t('Tất cả loại')
      }, ...types.map(type => ({value: type, label: t(typeLabels[type])}))].map(item => {
        const selected = item.value === 'all' ? !selectedTypes.length : selectedTypes.includes(item.value as InvestmentTransactionType);
        return <Pressable key={item.value} accessibilityRole="checkbox" accessibilityState={{checked: selected}}
                          onPress={() => setSelectedTypes(item.value === 'all' ? [] : selected ? selectedTypes.filter(value => value !== item.value) : [...selectedTypes, item.value as InvestmentTransactionType])}
                          style={{
                            width: '48%',
                            padding: 12,
                            borderRadius: 22,
                            backgroundColor: selected ? c.primary + '22' : c.elevated,
                            borderWidth: selected ? 1 : 0,
                            borderColor: c.primary
                          }}><T color={selected ? c.primary : c.muted}
                                bold>{item.label} {selected ? '✓' : ''}</T></Pressable>;
      })}</View><Row><View style={{flex: 1}}><Field label={t('Từ ngày')} placeholder="YYYY-MM-DD" value={fromDate}
                                                    onChangeText={setFromDate}/></View><View style={{flex: 1}}><Field
        label={t('Đến ngày')} placeholder="YYYY-MM-DD" value={toDate} onChangeText={setToDate}/></View></Row><Row><View
        style={{flex: 1}}><Field label={t('Số tiền từ')} keyboardType="numeric" value={minAmount}
                                 onChangeText={setMinAmount}/></View><View style={{flex: 1}}><Field
        label={t('Số tiền đến')} value={maxAmount} onChangeText={setMaxAmount}
        keyboardType="numeric"/></View></Row>{error ? <Info tone="error">{error}</Info> : null}<Row><View
        style={{flex: 1}}><Button label={t('Đặt lại')} kind="secondary" onPress={reset}/></View><View style={{flex: 2}}><Button
        label={t('Áp dụng bộ lọc')} onPress={applyFilter}/></View></Row></Card> : null}
    {error && !openFilter ?
      <Info tone="error">{t(error)}</Info> : null}{Object.entries(groupedStats).map(([currency, value]) => <StatsCard
      key={currency} currency={currency} stats={value}/>)}<Row><View style={{flex: 1}}><Button
      label={t('Nhập thủ công')} kind="secondary" icon="create-outline"
      onPress={() => go('manual-transaction')}/></View><View style={{flex: 1}}><Button label={t('Chia sẻ CSV')}
                                                                                       kind="secondary"
                                                                                       icon="download-outline"
                                                                                       onPress={shareCsv}
                                                                                       disabled={loading || !filtered.length}/></View></Row>{loading ?
      <ActivityIndicator color={c.primary}/> : filtered.length ? filtered.map(row => <ApiTransactionRow
        key={`${row.accountId}-${row.id}`} transaction={row}/>) : <Empty title={t('Chưa có dữ liệu giao dịch')}
                                                                         description={t('Không tìm thấy bản ghi giao dịch nào trong khoảng thời gian hoặc điều kiện lọc đã chọn.')}
                                                                         action={t('Nhập giao dịch mới')}
                                                                         onPress={() => go('import')}/>}<Info>{t('Dữ liệu giao dịch được đồng bộ và lưu trữ độc lập để phục vụ đối soát, không can thiệp trực tiếp vào số dư khả dụng thực tế của tài khoản đối tác.')}</Info>
  </Screen>;
}

export function InvestmentTransactionDetail({id, accountId}: { id: string; accountId?: string }) {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [transaction, setTransaction] = useState<TransactionResponse | null>(null);
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<InvestmentReconciliationReportResponse[]>([]);
  useEffect(() => {
    const parsedAccount = Number(accountId);
    const parsedTransaction = Number(id);
    if (!Number.isFinite(parsedAccount) || !Number.isFinite(parsedTransaction)) {
      setLoading(false);
      return;
    }
    Promise.all([api.getTransaction(parsedAccount, parsedTransaction), api.getAccount(parsedAccount)]).then(([loadedTransaction, loadedAccount]) => {
      setTransaction(loadedTransaction);
      setAccount(loadedAccount);
      api.listAllReconciliationReports().then(all => setReports(all.filter(report => report.accountId === parsedAccount && report.transactionId === parsedTransaction))).catch(() => setReports([]));
    }).catch(() => setTransaction(null)).finally(() => setLoading(false));
  }, [id, accountId]);
  if (loading) return <Screen title={t('Chi tiết giao dịch')} back><ActivityIndicator color={c.primary}/></Screen>;
  if (!transaction || !account) return <Screen title={t('Chi tiết giao dịch')} back><Empty
    title={t('Giao dịch không còn tồn tại')} action={t('Về lịch sử')} onPress={() => go('history')}/></Screen>;
  const withdrawal = transaction.transactionType === 'WITHDRAWAL';
  const bonus = transaction.transactionType === 'BONUS';
  const infoRow = (label: string, value: string) => <Row key={label} style={{alignItems: 'flex-start'}}><T size={10}
                                                                                                           color={c.muted}
                                                                                                           style={{flex: 1}}>{label}</T><T
    size={11} style={{flex: 1, textAlign: 'right'}}>{value}</T></Row>;
  const openReports = reports.filter(report => report.status === 'OPEN' || report.status === 'IN_REVIEW' || report.status === 'NEEDS_INFO');
  return <Screen title={t('Chi tiết giao dịch')} subtitle={t('Sổ đối soát Đầu tư')} back><Card tint style={{
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10
  }}><View style={{
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: c.elevated,
    justifyContent: 'center',
    alignItems: 'center'
  }}><Icon name={typeIcon[transaction.transactionType]} size={32}/></View><T size={11}
                                                                             color={c.muted}>{t(typeLabels[transaction.transactionType]).toUpperCase()}</T><T
    size={30} bold
    color={bonus ? c.lavender : c.primary}>{withdrawal ? '−' : '+'}{money(transaction.amount, transaction.currency, lang)}</T><Badge
    tone={transaction.transactionStatus === 'COMPLETED' ? 'success' : 'warning'}>• {t(statusLabels[transaction.transactionStatus])}</Badge><T
    size={10} color={c.muted}>◷ {dateLabel(transaction.transactionAt)}</T></Card><Card><Row><Icon name="wallet-outline"
                                                                                                  size={16}/><T
    size={12} bold
    color={c.primary}>{t('THÔNG TIN TÀI KHOẢN & ĐỐI SOÁT')}</T></Row>{[[t('Tài khoản đối soát'), `${account.accountName} (${account.currency})`], [t('Mã tài khoản'), account.accountCode], [t('Mã giao dịch Kira'), String(transaction.id)], [t('Mã đối tác / Ngân hàng'), transaction.externalTransactionId || t('— (Không có)')], [t('Độ tin cậy AI'), transaction.confidence == null ? '—' : `${(transaction.confidence * 100).toFixed(0)}%`]].map(([label, value]) => infoRow(label, value))}
  </Card><Card><Row><Icon name="shield-checkmark-outline" color={c.lavender} size={16}/><T size={12} bold
                                                                                           color={c.lavender}>{t('CHI TIẾT NGUỒN DỮ LIỆU')}</T></Row>{[[t('Nguồn nhập bản ghi'), transaction.sourceAttachmentId ? t('Trích xuất ảnh (AI OCR)') : t('Nhập thủ công')], [t('Mã file SHA-256'), transaction.sourceFileHash || '—'], [t('Mô tả ghi chú'), transaction.description || '—'], [t('Nội dung nhận diện'), transaction.rawText || '—']].map(([label, value]) => infoRow(label, value))}
  </Card><Card><Row><Icon name="search-outline" color={c.warning} size={16}/><T size={12} bold
                                                                                color={c.warning}>{t('TRA SOÁT GIAO DỊCH')}</T></Row>{openReports.length ? <>
      <Info tone="warning">{t('Giao dịch này đang có hồ sơ tra soát mở.')}</Info>{openReports.map(report => <Button
      key={report.id} label={t('Mở hồ sơ tra soát')} kind="secondary"
      onPress={() => go('investment-report-detail', {id: String(report.id)})}/>)}</> :
    <Button label={t('Báo cáo sai lệch')} icon="document-text-outline" onPress={() => go('investment-report-create', {
      id: String(transaction.id),
      accountId: String(account.id)
    })}/>}{reports.length > openReports.length ?
    <Button label={t('Xem lịch sử tra soát')} kind="secondary" onPress={() => go('investment-reports')}/> : null}</Card><Info>{t('Dữ liệu được ghi nhận trong sổ đối soát đầu tư độc lập, không thay đổi số dư thực tế tại tài khoản đối tác.')}</Info><Button
    label={t('Xem ảnh chứng từ gốc')} icon="image-outline" kind="secondary" disabled={!transaction.sourceAttachmentId}
    onPress={() => transaction.sourceAttachmentId ? go('source', {id: String(transaction.sourceAttachmentId)}) : notify(t('Giao dịch này chưa có ảnh chứng từ liên kết.'))}/>{transaction.sourceAttachmentId ?
    <Button label={t('Theo dõi xử lý AI')} icon="pulse-outline" kind="secondary"
            onPress={() => go('ai-job-detail', {id: String(transaction.sourceAttachmentId)})}/> : null}{dialog}
  </Screen>;
}

export function InvestmentAccountStats({id}: { id: string }) {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const {accounts, loading: accountsLoading, error} = useInvestmentAccounts();
  const [accountId, setAccountId] = useState(Number(id));
  const [period, setPeriod] = useState<'all' | '30' | '90' | '365'>('all');
  const [stats, setStats] = useState<InvestmentStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const account = accounts.find(value => value.id === accountId);
  useEffect(() => {
    if (!accountId) return;
    const to = new Date();
    const from = new Date(to);
    if (period !== 'all') from.setDate(from.getDate() - Number(period) + 1);
    const isoDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    setLoading(true);
    api.getStatistics(accountId, {
      status: 'COMPLETED',
      fromDate: period === 'all' ? undefined : isoDate(from),
      toDate: period === 'all' ? undefined : isoDate(to)
    }).then(setStats).catch(() => notify(t('Không tải được thống kê tài khoản.'))).finally(() => setLoading(false));
  }, [accountId, period]);
  if (accountsLoading || loading) return <Screen title={t('Thống kê theo tài khoản')} back><ActivityIndicator
    color={c.primary}/></Screen>;
  if (error || !account || !stats) return <Screen title={t('Thống kê theo tài khoản')} back><Empty
    title={t('Không tìm thấy tài khoản')}/></Screen>;
  return <Screen title={t('Thống kê theo tài khoản')}
                 subtitle={t('Theo dõi Deposit, Withdrawal và Bonus từ các giao dịch đã xác nhận')} back><Chips
    value={String(accountId)} onChange={value => setAccountId(Number(value))}
    values={accounts.map(value => ({value: String(value.id), label: value.accountName}))}/><Section
    title={t('Khoảng thời gian thống kê')}/><Chips value={period} onChange={value => setPeriod(value as typeof period)}
                                                   values={[{value: 'all', label: t('Toàn thời gian')}, {
                                                     value: '30',
                                                     label: t('30 ngày')
                                                   }, {value: '90', label: t('90 ngày')}, {
                                                     value: '365',
                                                     label: t('365 ngày')
                                                   }]}/><Card tint><Row><Icon name="analytics-outline"/><View
    style={{flex: 1}}><T bold>{account.accountName}</T><T size={10}
                                                          color={c.muted}>{account.accountCode} • {account.currency}</T></View><Badge>{t('Hoàn thành')}</Badge></Row><T
    size={10} color={c.muted}>{t('GIÁ TRỊ RÒNG ĐÃ GHI NHẬN')}</T><T size={27} bold
                                                                    color={stats.netAmount < 0 ? c.error : c.primary}>{money(stats.netAmount, stats.currency, lang)}</T><Row><Metric
    label={t('Tổng giao dịch')} value={String(stats.totalCount)}/><Metric label={t('Tổng dòng tiền')}
                                                                          value={money(stats.totalAmount, stats.currency, lang)}/></Row></Card><StatsCard
    currency={stats.currency} stats={stats}/>{stats.daily.length ?
    <Card><Section title={t('Dòng tiền theo ngày')}/><T size={10}
                                                        color={c.muted}>{t('Bảy ngày gần nhất trong khoảng đã chọn')}</T>{stats.daily.slice(-7).map(day => {
      const net = day.deposits + day.bonuses - day.withdrawals;
      return <View key={day.date} style={{gap: 5, paddingVertical: 8, borderTopWidth: 1, borderColor: c.border}}><Row><T
        size={10} color={c.muted} style={{flex: 1}}>{dateLabel(day.date)}</T><T size={11} bold
                                                                                color={net < 0 ? c.error : c.success}>{net >= 0 ? '+' : '−'}{money(Math.abs(net), stats.currency, lang)}</T></Row><Row><Metric
        label={t('Deposit')} value={money(day.deposits, stats.currency, lang)}/><Metric label={t('Withdrawal')}
                                                                                        value={money(day.withdrawals, stats.currency, lang)}/><Metric
        label={t('Bonus')} value={money(day.bonuses, stats.currency, lang)} color={c.lavender}/></Row></View>;
    })}</Card> : null}<Button label={t('Xem toàn bộ giao dịch của tài khoản này')} kind="secondary"
                              onPress={() => go('history')}/><Info>{t('Thống kê chỉ tính các bản ghi đã xác nhận trong sổ đối soát; không truy cập hoặc thay đổi số dư thực tế tại đối tác.')}</Info>{dialog}
  </Screen>;
}
