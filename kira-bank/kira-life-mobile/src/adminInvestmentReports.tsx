import React, {useCallback, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {dateLabel, money} from './data';
import {
  errorMessage,
  InvestmentReconciliationReportReason,
  InvestmentReconciliationReportResponse,
  InvestmentReconciliationReportStatus,
  useInvestmentApi,
} from './investmentApi';
import {useAuth} from './auth';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, Field, Icon, Info, Row, Screen, Section, T, useNotice} from './ui';

const statuses: InvestmentReconciliationReportStatus[] = ['OPEN', 'IN_REVIEW', 'NEEDS_INFO', 'RESOLVED', 'REJECTED'];
const statusLabels: Record<InvestmentReconciliationReportStatus, string> = {
  OPEN: 'Mở', IN_REVIEW: 'Đang tra soát', NEEDS_INFO: 'Cần bổ sung', RESOLVED: 'Đã giải quyết', REJECTED: 'Từ chối',
};
const statusTone: Record<InvestmentReconciliationReportStatus, 'primary' | 'success' | 'warning' | 'error'> = {
  OPEN: 'primary', IN_REVIEW: 'warning', NEEDS_INFO: 'warning', RESOLVED: 'success', REJECTED: 'error',
};
const reasonLabels: Record<InvestmentReconciliationReportReason, string> = {
  AMOUNT_MISMATCH: 'Sai lệch số tiền',
  DUPLICATE_TRANSACTION: 'Trùng lặp giao dịch',
  AI_EXTRACTION_ERROR: 'Lỗi trích xuất AI OCR',
  COUNTERPARTY_INFO_MISMATCH: 'Sai thông tin đối tác / Tài khoản đối soát',
  OTHER: 'Lý do khác',
};

function transactionLabel(report: InvestmentReconciliationReportResponse, lang: 'vi' | 'en') {
  if (report.amount == null || !report.currency) return `#${report.transactionId}`;
  const sign = report.transactionType === 'WITHDRAWAL' ? '−' : '+';
  return `${sign}${money(report.amount, report.currency, lang)} · ${dateLabel(report.transactionAt || report.createdAt)}`;
}

function AdminReportCard({
                           report,
                           editing,
                           draftStatus,
                           draftNote,
                           saving,
                           onEdit,
                           onCancel,
                           onSave,
                           onStatusChange,
                           onNoteChange,
                         }: {
  report: InvestmentReconciliationReportResponse;
  editing: boolean;
  draftStatus: InvestmentReconciliationReportStatus;
  draftNote: string;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onStatusChange: (value: InvestmentReconciliationReportStatus) => void;
  onNoteChange: (value: string) => void;
}) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Card style={{gap: 11}}>
    <Row><Icon name="document-text-outline" color={c.primary}/><View style={{flex: 1}}><T size={12}
                                                                                          bold>{t('Hồ sơ')} #{report.id} · {t(reasonLabels[report.reason])}</T><T
      size={10}
      color={c.muted}>{report.accountName || `${t('Tài khoản')} #${report.accountId}`} · {transactionLabel(report, lang)}</T></View><Badge
      tone={statusTone[report.status]}>{t(statusLabels[report.status])}</Badge></Row>
    <T size={11}>{report.detail}</T>
    <Row><T size={10} color={c.muted} style={{flex: 1}}>{t('Tạo hồ sơ')}: {dateLabel(report.createdAt)}</T><T size={10}
                                                                                                              color={c.primary}>{t('{{n}} mốc xử lý', {n: report.history.length})}</T></Row>
    {report.resolutionNote ?
      <Info tone={report.status === 'REJECTED' ? 'error' : 'success'}>{report.resolutionNote}</Info> : null}
    {editing ? <View style={{gap: 10, paddingTop: 4}}><Section title={t('Cập nhật xử lý')}/><Chips value={draftStatus}
                                                                                                   onChange={value => onStatusChange(value as InvestmentReconciliationReportStatus)}
                                                                                                   values={statuses.map(value => ({
                                                                                                     value,
                                                                                                     label: t(statusLabels[value])
                                                                                                   }))}/><Field
        label={t('Ghi chú xử lý')} value={draftNote} onChangeText={onNoteChange} multiline maxLength={2000}
        placeholder={t('Nêu kết quả kiểm tra hoặc yêu cầu bổ sung thông tin')}/><Row><View style={{flex: 1}}><Button
        label={t('Hủy')} kind="secondary" onPress={onCancel}/></View><View style={{flex: 2}}><Button
        label={t('Lưu cập nhật')} icon="checkmark-circle-outline" onPress={onSave}
        loading={saving}/></View></Row></View> :
      <Button label={t('Cập nhật trạng thái')} kind="secondary" icon="create-outline" onPress={onEdit}/>}
  </Card>;
}

export function AdminInvestmentReports() {
  const {session} = useAuth();
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify} = useNotice();
  const [filter, setFilter] = useState<'all' | InvestmentReconciliationReportStatus>('all');
  const [reports, setReports] = useState<InvestmentReconciliationReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextPage, setNextPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<InvestmentReconciliationReportStatus>('IN_REVIEW');
  const [draftNote, setDraftNote] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const requestVersion = useRef(0);

  const loadFirst = useCallback(() => {
    const request = ++requestVersion.current;
    setLoading(true);
    setError('');
    setEditingId(null);
    api.listAdminReconciliationReports(filter === 'all' ? undefined : filter, 0, 20)
      .then(result => {
        if (request !== requestVersion.current) return;
        setReports(result.data);
        setNextPage(1);
        setTotalPages(result.meta.totalPages);
        setTotalReports(result.meta.totalElements);
      })
      .catch(e => {
        if (request === requestVersion.current) setError(errorMessage(e));
      })
      .finally(() => {
        if (request === requestVersion.current) setLoading(false);
      });
  }, [filter]);
  useFocusEffect(useCallback(() => {
    loadFirst();
  }, [loadFirst]));

  async function loadMore() {
    if (loadingMore || nextPage >= totalPages) return;
    const request = requestVersion.current;
    setLoadingMore(true);
    try {
      const result = await api.listAdminReconciliationReports(filter === 'all' ? undefined : filter, nextPage, 20);
      if (request !== requestVersion.current) return;
      setReports(current => [...current, ...result.data]);
      setNextPage(nextPage + 1);
      setTotalPages(result.meta.totalPages);
      setTotalReports(result.meta.totalElements);
    } catch (e) {
      if (request === requestVersion.current) setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  function startEdit(report: InvestmentReconciliationReportResponse) {
    setEditingId(report.id);
    setDraftStatus(report.status);
    setDraftNote(report.resolutionNote || '');
    setError('');
  }

  async function save(report: InvestmentReconciliationReportResponse) {
    setSavingId(report.id);
    setError('');
    try {
      const updated = await api.updateAdminReconciliationReport(report.id, {
        status: draftStatus,
        resolutionNote: draftNote.trim() || null,
        version: report.version
      });
      setReports(current => current.map(item => item.id === updated.id ? updated : item).filter(item => filter === 'all' || item.status === filter));
      setTotalReports(current => filter === 'all' || updated.status === filter ? current : Math.max(0, current - 1));
      setEditingId(null);
      notify(t('Đã cập nhật hồ sơ tra soát.'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSavingId(null);
    }
  }

  if (!session) return <Screen title={t('Quản trị tra soát')} back><Empty
    title={t('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')}/></Screen>;
  if (!session.user.roles.includes('ADMIN')) return <Screen title={t('Quản trị tra soát')} back><Empty
    title={t('Màn hình này chỉ dành cho Admin.')}/></Screen>;
  return <Screen title={t('Quản trị tra soát')} subtitle={t('Xử lý hồ sơ sai lệch từ toàn bộ người dùng')} back>
    <Card tint><Row><Icon name="shield-checkmark-outline"/><View style={{flex: 1}}><T size={13}
                                                                                      bold>{t('Hàng đợi tra soát Admin')}</T><T
      size={10} color={c.muted}>{t('{{n}} hồ sơ trong bộ lọc hiện tại', {n: totalReports})}</T></View><Pressable
      accessibilityRole="button" accessibilityLabel={t('Tải lại')} onPress={loadFirst} style={{padding: 8}}><Icon
      name="refresh-outline" size={18}/></Pressable></Row><Chips value={filter}
                                                                 onChange={value => setFilter(value as typeof filter)}
                                                                 values={[{
                                                                   value: 'all',
                                                                   label: t('Tất cả')
                                                                 }, ...statuses.map(value => ({
                                                                   value,
                                                                   label: t(statusLabels[value])
                                                                 }))]}/></Card>
    {error ? <Info tone="error">{t(error)}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : reports.length ? reports.map(report => <AdminReportCard
        key={report.id} report={report} editing={editingId === report.id} draftStatus={draftStatus} draftNote={draftNote}
        saving={savingId === report.id} onEdit={() => startEdit(report)} onCancel={() => setEditingId(null)}
        onSave={() => save(report)} onStatusChange={setDraftStatus} onNoteChange={setDraftNote}/>) :
      <Empty title={t('Chưa có hồ sơ tra soát')} description={t('Không có hồ sơ phù hợp với trạng thái đã chọn.')}/>}
    {!loading && nextPage < totalPages ?
      <Button label={t('Tải thêm')} kind="secondary" onPress={loadMore} loading={loadingMore}/> : null}
    <Info>{t('Mọi thay đổi trạng thái được ghi vào lịch sử bất biến và gửi thông báo cho người tạo hồ sơ.')}</Info>
  </Screen>;
}
