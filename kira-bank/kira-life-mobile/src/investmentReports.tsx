import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {dateLabel, money} from './data';
import {
  AccountResponse,
  errorMessage,
  InvestmentReconciliationReportReason,
  InvestmentReconciliationReportResponse,
  InvestmentReconciliationReportStatus,
  TransactionResponse,
  useInvestmentApi,
} from './investmentApi';
import {InvestmentNav} from './investment';
import {Lang, useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, Field, go, Icon, Info, Row, Screen, Section, T, useNotice} from './ui';

const reasonLabels: Record<InvestmentReconciliationReportReason, string> = {
  AMOUNT_MISMATCH: 'Sai lệch số tiền',
  DUPLICATE_TRANSACTION: 'Trùng lặp giao dịch',
  AI_EXTRACTION_ERROR: 'Lỗi trích xuất AI OCR',
  COUNTERPARTY_INFO_MISMATCH: 'Sai thông tin đối tác / Tài khoản đối soát',
  OTHER: 'Lý do khác',
};
const statusLabels: Record<InvestmentReconciliationReportStatus, string> = {
  OPEN: 'Mở',
  IN_REVIEW: 'Đang tra soát',
  NEEDS_INFO: 'Cần bổ sung',
  RESOLVED: 'Đã giải quyết',
  REJECTED: 'Từ chối',
};
const statusTone: Record<InvestmentReconciliationReportStatus, 'primary' | 'success' | 'warning' | 'error' | 'muted'> = {
  OPEN: 'primary',
  IN_REVIEW: 'warning',
  NEEDS_INFO: 'warning',
  RESOLVED: 'success',
  REJECTED: 'error',
};

function reportTitle(t: ReturnType<typeof useT>, report: InvestmentReconciliationReportResponse) {
  return `${t(reasonLabels[report.reason])} · ${t(statusLabels[report.status])}`;
}

function reportTransactionLabel(t: ReturnType<typeof useT>, report: InvestmentReconciliationReportResponse, lang: Lang) {
  if (report.amount == null || !report.currency) return `${t('Giao dịch')} #${report.transactionId}`;
  const sign = report.transactionType === 'WITHDRAWAL' ? '−' : '+';
  return `${sign}${money(report.amount, report.currency, lang)} · ${dateLabel(report.transactionAt || report.createdAt)}`;
}

export function InvestmentReportForm({accountId, transactionId}: { accountId: string; transactionId: string }) {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [transaction, setTransaction] = useState<TransactionResponse | null>(null);
  const [reason, setReason] = useState<InvestmentReconciliationReportReason>('AI_EXTRACTION_ERROR');
  const [detail, setDetail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const parsedAccountId = Number(accountId);
  const parsedTransactionId = Number(transactionId);

  useEffect(() => {
    if (!Number.isFinite(parsedAccountId) || !Number.isFinite(parsedTransactionId)) {
      setLoading(false);
      setError(t('Giao dịch không hợp lệ.'));
      return;
    }
    Promise.all([api.getAccount(parsedAccountId), api.getTransaction(parsedAccountId, parsedTransactionId)])
      .then(([loadedAccount, loadedTransaction]) => {
        setAccount(loadedAccount);
        setTransaction(loadedTransaction);
        setError('');
      })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [accountId, transactionId]);

  async function submit() {
    const cleanDetail = detail.trim();
    if (cleanDetail.length < 10) {
      setError(t('Nội dung tra soát cần ít nhất 10 ký tự.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createReconciliationReport(parsedAccountId, parsedTransactionId, {reason, detail: cleanDetail});
      notify(t('Đã tạo hồ sơ tra soát.'));
      router.replace({pathname: '/[page]', params: {page: 'investment-reports'}});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title={t('Báo cáo sai lệch')} back><ActivityIndicator color={c.primary}/></Screen>;
  if (!account || !transaction) return <Screen title={t('Báo cáo sai lệch')} back><Empty
    title={t('Giao dịch không còn tồn tại')} description={error || t('Không tải được dữ liệu giao dịch.')}/></Screen>;
  const amount = `${transaction.transactionType === 'WITHDRAWAL' ? '−' : '+'}${money(transaction.amount, transaction.currency, lang)}`;
  return <Screen title={t('Báo cáo sai lệch')} subtitle={t('Tạo hồ sơ tra soát cho giao dịch, không sửa sổ giao dịch')}
                 back>
    <Card tint><Row><Icon name="alert-circle-outline" color={c.warning}/><View style={{flex: 1}}><T
      bold>{t('Giao dịch cần tra soát')}</T><T size={11} color={c.muted}>{account.accountName} ·
      #{transaction.id}</T></View></Row><T size={24} bold
                                           color={transaction.transactionType === 'BONUS' ? c.lavender : c.primary}>{amount}</T><T
      size={10}
      color={c.muted}>{dateLabel(transaction.transactionAt)} · {t(transaction.transactionType === 'DEPOSIT' ? 'Nạp tiền' : transaction.transactionType === 'WITHDRAWAL' ? 'Rút tiền' : 'Thưởng')}</T></Card>
    <Card><Section title={t('Lý do tra soát')}/><Chips value={reason}
                                                       onChange={value => setReason(value as InvestmentReconciliationReportReason)}
                                                       values={Object.entries(reasonLabels).map(([value, label]) => ({
                                                         value,
                                                         label: t(label)
                                                       }))}/><Field label={t('Chi tiết cần kiểm tra')}
                                                                    hint={t('Nêu rõ số tiền, thời điểm, mã đối tác hoặc điểm AI nhận diện sai.')}
                                                                    placeholder={t('Ví dụ: Số tiền trên ảnh là 1.500.000 nhưng hệ thống ghi nhận 1.050.000.')}
                                                                    value={detail} onChangeText={setDetail} multiline
                                                                    maxLength={1000}/></Card>
    {error ? <Info tone="error">{t(error)}</Info> : null}
    <Button label={t('Tạo hồ sơ tra soát')} icon="document-text-outline" onPress={submit} loading={saving}
            disabled={!detail.trim()}/>
    <Button label={t('Hủy')} kind="secondary" onPress={() => router.back()}/>
    {dialog}
  </Screen>;
}

function ReportCard({report}: { report: InvestmentReconciliationReportResponse }) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Pressable accessibilityRole="button" onPress={() => go('investment-report-detail', {id: String(report.id)})}>
    <Card style={{gap: 10}}><Row><Icon name="document-text-outline" color={c.primary}/><View style={{flex: 1}}><T
      bold>{reportTitle(t, report)}</T><T size={10}
                                          color={c.muted}>{report.accountName || `${t('Tài khoản')} #${report.accountId}`}</T></View><Badge
      tone={statusTone[report.status]}>{t(statusLabels[report.status])}</Badge></Row><T
      size={11}>{reportTransactionLabel(t, report, lang)}</T><T size={11}
                                                                color={c.muted}>{report.detail}</T>{report.resolutionNote ?
      <Info tone={report.status === 'REJECTED' ? 'error' : 'success'}>{report.resolutionNote}</Info> : null}<T size={10}
                                                                                                               color={c.primary}>{t('Xem chi tiết')} →</T></Card>
  </Pressable>;
}

export function InvestmentReports() {
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [reports, setReports] = useState<InvestmentReconciliationReportResponse[]>([]);
  const [filter, setFilter] = useState<'all' | InvestmentReconciliationReportStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  function load() {
    setLoading(true);
    api.listAllReconciliationReports().then(value => {
      if (mounted.current) {
        setReports(value);
        setError('');
      }
    }).catch(e => {
      if (mounted.current) setError(errorMessage(e));
    }).finally(() => {
      if (mounted.current) setLoading(false);
    });
  }

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, []));
  const visible = useMemo(() => filter === 'all' ? reports : reports.filter(report => report.status === filter), [filter, reports]);
  const openCount = reports.filter(report => report.status === 'OPEN' || report.status === 'IN_REVIEW' || report.status === 'NEEDS_INFO').length;
  return <Screen title={t('Đầu tư')}>
    <InvestmentNav active="investment-reports"/>
    <Card tint><Row><Icon name="search-outline"/><View style={{flex: 1}}><T size={12}
                                                                            bold>{t('Theo dõi tra soát')}</T><T
      size={10}
      color={c.muted}>{t('{{n}} hồ sơ đang mở', {n: openCount})}</T></View><View style={{alignItems: 'center', justifyContent: 'center'}}><Badge>{reports.length}</Badge></View><Pressable
      accessibilityRole="button" accessibilityLabel={t('Tải lại')} onPress={load} style={{padding: 8}}><Icon
      name="refresh-outline" size={18}/></Pressable></Row><Chips value={filter}
                                                                 onChange={value => setFilter(value as typeof filter)}
                                                                 values={[{
                                                                   value: 'all',
                                                                   label: t('Tất cả')
                                                                 }, {
                                                                   value: 'OPEN',
                                                                   label: t('Mở')
                                                                 }, {
                                                                   value: 'IN_REVIEW',
                                                                   label: t('Đang tra soát')
                                                                 }, {
                                                                   value: 'NEEDS_INFO',
                                                                   label: t('Cần bổ sung')
                                                                 }, {
                                                                   value: 'RESOLVED',
                                                                   label: t('Đã giải quyết')
                                                                 }, {value: 'REJECTED', label: t('Từ chối')}]}/></Card>
    {error ? <Info tone="error">{t(error)}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : visible.length ? visible.map(report => <ReportCard
      key={report.id} report={report}/>) : <Empty title={t('Chưa có hồ sơ tra soát')}
                                                  description={t('Khi phát hiện sai lệch trong transaction, bạn có thể mở hồ sơ ngay từ màn chi tiết.')}
                                                  action={t('Về lịch sử giao dịch')} onPress={() => go('history')}/>}
  </Screen>;
}

export function InvestmentReportDetail({id}: { id: string }) {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [report, setReport] = useState<InvestmentReconciliationReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  function load() {
    const reportId = Number(id);
    if (!Number.isFinite(reportId)) {
      setLoading(false);
      setError(t('Hồ sơ tra soát không hợp lệ.'));
      return;
    }
    setLoading(true);
    api.getReconciliationReport(reportId).then(value => {
      if (mounted.current) {
        setReport(value);
        setError('');
      }
    }).catch(e => {
      if (mounted.current) setError(errorMessage(e));
    }).finally(() => {
      if (mounted.current) setLoading(false);
    });
  }

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [id]));
  if (loading) return <Screen title={t('Chi tiết hồ sơ tra soát')} back><ActivityIndicator color={c.primary}/></Screen>;
  if (!report) return <Screen title={t('Chi tiết hồ sơ tra soát')} back><Empty
    title={t('Không tìm thấy hồ sơ tra soát')} description={error} action={t('Về danh sách tra soát')}
    onPress={() => go('investment-reports')}/></Screen>;
  const txLabel = report.amount == null || !report.currency ? `#${report.transactionId}` : `${report.transactionType === 'WITHDRAWAL' ? '−' : '+'}${money(report.amount, report.currency, lang)}`;
  const infoRow = (label: string, value: string) => <Row key={label} style={{alignItems: 'flex-start'}}><T size={10}
                                                                                                           color={c.muted}
                                                                                                           style={{flex: 1}}>{label}</T><T
    size={11} style={{flex: 1, textAlign: 'right'}}>{value}</T></Row>;
  return <Screen title={t('Chi tiết hồ sơ tra soát')} subtitle={t('Lịch sử xử lý và kết quả đối soát')} back>
    <Card tint style={{gap: 10}}><Row><Icon name="document-text-outline" color={c.primary}/><View style={{flex: 1}}><T
      size={13} bold>{t(reasonLabels[report.reason])}</T><T size={10}
                                                            color={c.muted}>{report.accountName || `${t('Tài khoản')} #${report.accountId}`}</T></View><Badge
      tone={statusTone[report.status]}>{t(statusLabels[report.status])}</Badge><Pressable accessibilityRole="button"
                                                                                          accessibilityLabel={t('Tải lại')}
                                                                                          onPress={load}
                                                                                          style={{padding: 6}}><Icon
      name="refresh-outline" size={18}/></Pressable></Row><T size={27} bold
                                                             color={report.transactionType === 'BONUS' ? c.lavender : c.primary}>{txLabel}</T>{report.transactionAt ?
      <T size={10} color={c.muted}>◷ {dateLabel(report.transactionAt)}</T> : null}</Card>
    <Card><Section
      title={t('Thông tin transaction')}/>{[[t('Mã giao dịch Kira'), String(report.transactionId)], [t('Loại giao dịch'), report.transactionType ? t(report.transactionType === 'DEPOSIT' ? 'Nạp tiền' : report.transactionType === 'WITHDRAWAL' ? 'Rút tiền' : 'Thưởng') : '—'], [t('Tạo hồ sơ'), dateLabel(report.createdAt)], [t('Mã đối tác / Ngân hàng'), report.externalTransactionId || '—']].map(([label, value]) => infoRow(label, value))}
    </Card>
    <Card><Section title={t('Nội dung tra soát')}/><T size={12}>{report.detail}</T>{report.resolutionNote ?
      <Info tone={report.status === 'REJECTED' ? 'error' : 'success'}>{report.resolutionNote}</Info> :
      <Info>{t('Hồ sơ đang chờ Admin xử lý. Bạn có thể theo dõi trạng thái tại đây.')}</Info>}</Card>
    <Card><Section title={t('Lịch sử trạng thái')}/>{report.history.length ? report.history.map((event, index) => <View
      key={`${event.createdAt}-${index}`}
      style={{gap: 5, paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderColor: c.border}}><Row><Badge
      tone={statusTone[event.toStatus]}>{t(statusLabels[event.toStatus])}</Badge><T size={10} color={c.muted} style={{
      flex: 1,
      textAlign: 'right'
    }}>{dateLabel(event.createdAt)}</T></Row>{event.note ? <T size={11} color={c.muted}>{event.note}</T> : null}
    </View>) : <T size={11} color={c.muted}>{t('Chưa có lịch sử xử lý.')}</T>}</Card>
    {report.sourceAttachmentId ? <Button label={t('Xem ảnh chứng từ gốc')} kind="secondary" icon="image-outline"
                                         onPress={() => go('source', {id: String(report.sourceAttachmentId)})}/> : null}
    <Button label={t('Mở transaction')} kind="secondary" onPress={() => go('transaction-detail', {
      id: String(report.transactionId),
      accountId: String(report.accountId)
    })}/>
  </Screen>;
}
