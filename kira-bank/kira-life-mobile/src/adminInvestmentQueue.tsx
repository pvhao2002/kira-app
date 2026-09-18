import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {dateLabel} from './data';
import {
  AttachmentAiStatus,
  errorMessage,
  errorMessageForCode,
  InvestmentAiJobResponse,
  InvestmentAiQueueSummaryResponse,
  useInvestmentApi
} from './investmentApi';
import {useAuth} from './auth';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Dialog, Empty, go, Icon, Info, Metric, Row, Screen, T, useNotice} from './ui';

const statuses: AttachmentAiStatus[] = ['PENDING', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'CONFIRMED'];
const statusLabels: Record<AttachmentAiStatus, string> = {
  NOT_REQUESTED: 'Chưa yêu cầu',
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang xử lý',
  READY: 'Sẵn sàng',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  CONFIRMED: 'Đã xác nhận',
};
const statusTone: Record<AttachmentAiStatus, 'primary' | 'success' | 'warning' | 'error' | 'muted'> = {
  NOT_REQUESTED: 'muted',
  PENDING: 'primary',
  PROCESSING: 'warning',
  READY: 'success',
  FAILED: 'error',
  CANCELLED: 'muted',
  CONFIRMED: 'success',
};

function AdminJobCard({
                        job,
                        busy,
                        onRun,
                        onCancel,
                      }: { job: InvestmentAiJobResponse; busy: string; onRun: () => void; onCancel: () => void }) {
  const t = useT();
  const {colors: c} = useTheme();
  const running = busy === `${job.attachmentId}:run`;
  const cancelling = busy === `${job.attachmentId}:cancel`;
  return <Card style={{gap: 11}}>
    <Row><Icon name="document-text-outline" color={job.status === 'FAILED' ? c.error : c.primary}/><View
      style={{flex: 1}}><T size={13} bold>{job.originalName}</T><T size={10}
                                                                   color={c.muted}>#{job.attachmentId} · {job.owner?.fullName || t('Không xác định')} · {job.owner?.email || '—'}</T></View><Badge
      tone={statusTone[job.status]}>{t(statusLabels[job.status])}</Badge></Row>
    <Row><View style={{flex: 1}}><T size={10} color={c.muted}>{t('Model AI')}</T><T
      size={11}>{job.model || '—'}</T></View><View style={{flex: 1}}><T size={10} color={c.muted}>{t('Lần chạy')}</T><T
      size={11}>{job.attemptCount} / {job.maxAttempts}</T></View><View style={{flex: 1, alignItems: 'flex-end'}}><T
      size={10} color={c.muted}>{t('Tạo lúc')}</T><T size={10}>{dateLabel(job.createdAt)}</T></View></Row>
    {job.processingStartedAt || job.nextAttemptAt || job.completedAt ?
      <Row><View style={{flex: 1}}><T size={10} color={c.muted}>{t('Bắt đầu xử lý')}</T><T
        size={10}>{job.processingStartedAt ? dateLabel(job.processingStartedAt) : '—'}</T></View><View
        style={{flex: 1}}><T size={10} color={c.muted}>{t('Lần chạy tiếp theo')}</T><T
        size={10}>{job.nextAttemptAt ? dateLabel(job.nextAttemptAt) : '—'}</T></View><View
        style={{flex: 1, alignItems: 'flex-end'}}><T size={10} color={c.muted}>{t('Hoàn tất lúc')}</T><T
        size={10}>{job.completedAt ? dateLabel(job.completedAt) : '—'}</T></View></Row> : null}
    {job.reviewTargets.length ? <View style={{gap: 4}}><T size={10}
                                                          color={c.muted}>{t('Tài khoản / lô duyệt')}</T>{job.reviewTargets.map(target =>
        <T key={target.batchId} size={10}>{target.accountName} · {t('{{n}} bản ghi chờ', {n: target.pendingItemCount})} ·
          #{target.batchId.slice(0, 8).toUpperCase()}</T>)}</View> :
      <T size={10} color={c.muted}>{t('Chưa có lô transaction để duyệt.')}</T>}
    {job.detectedJson ? <Info
      tone="success">{t('Đã trích xuất {{n}} transaction trong JSON chuẩn hóa.', {n: job.detectedJson.transactions.length})}</Info> : null}
    {job.status === 'FAILED' ? <Info
      tone="error">{job.error ? t(errorMessageForCode(job.error)) : t('Ảnh bị mờ hoặc không nhận diện được hóa đơn hợp lệ.')}</Info> : null}
    {job.status === 'PROCESSING' ? <Info>{t('AI đang xử lý; hệ thống sẽ tự cập nhật trạng thái.')}</Info> : null}
    <Row style={{gap: 6}}><View style={{flex: 1}}><Button label={t('Chi tiết')} kind="secondary"
                                                          onPress={() => go('admin-ai-job-detail', {id: String(job.attachmentId)})}/></View>{job.canRun ?
      <View style={{flex: 1}}><Button label={running ? t('Đang chạy…') : t('Chạy lại')} kind="secondary" onPress={onRun}
                                      loading={running} disabled={!!busy && !running}/></View> : null}{job.canCancel ?
      <View style={{flex: 1}}><Button label={cancelling ? t('Đang hủy…') : t('Hủy công việc')} kind="secondary"
                                      onPress={onCancel} loading={cancelling}
                                      disabled={!!busy && !cancelling}/></View> : null}</Row>
  </Card>;
}

export function AdminInvestmentQueue() {
  const {session} = useAuth();
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [filter, setFilter] = useState<'all' | AttachmentAiStatus>('all');
  const [jobs, setJobs] = useState<InvestmentAiJobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextPage, setNextPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [busy, setBusy] = useState('');
  const [pendingCancel, setPendingCancel] = useState<InvestmentAiJobResponse | null>(null);
  const [summary, setSummary] = useState<InvestmentAiQueueSummaryResponse | null>(null);
  const requestVersion = useRef(0);
  const loadedFilter = useRef<string | null>(null);

  const loadFirst = useCallback(() => {
    const request = ++requestVersion.current;
    if (loadedFilter.current !== filter) {
      loadedFilter.current = filter;
      setLoading(true);
    }
    setError('');
    setSummary(null);
    api.listAdminAiJobs(filter === 'all' ? undefined : [filter], 0, 20)
      .then(result => {
        if (request !== requestVersion.current) return;
        setJobs(result.data);
        setNextPage(1);
        setTotalPages(result.meta.totalPages);
        setTotalJobs(result.meta.totalElements);
      })
      .catch(e => {
        if (request === requestVersion.current) setError(errorMessage(e));
      })
      .finally(() => {
        if (request === requestVersion.current) setLoading(false);
      });
    api.getAdminAiJobSummary().then(value => {
      if (request === requestVersion.current) setSummary(value);
    }).catch(() => {
    });
  }, [filter]);
  useFocusEffect(useCallback(() => {
    loadFirst();
  }, [loadFirst]));
  useEffect(() => {
    if (!jobs.some(job => job.status === 'PENDING' || job.status === 'PROCESSING')) return;
    const timer = setInterval(loadFirst, 4000);
    return () => clearInterval(timer);
  }, [jobs, loadFirst]);

  async function loadMore() {
    if (loadingMore || nextPage >= totalPages) return;
    const request = requestVersion.current;
    setLoadingMore(true);
    try {
      const result = await api.listAdminAiJobs(filter === 'all' ? undefined : [filter], nextPage, 20);
      if (request !== requestVersion.current) return;
      setJobs(current => [...current, ...result.data]);
      setNextPage(nextPage + 1);
      setTotalPages(result.meta.totalPages);
      setTotalJobs(result.meta.totalElements);
    } catch (e) {
      if (request === requestVersion.current) setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  function applyJobUpdate(updated: InvestmentAiJobResponse) {
    const stillMatches = filter === 'all' || updated.status === filter;
    setJobs(current => stillMatches
      ? current.map(item => item.attachmentId === updated.attachmentId ? updated : item)
      : current.filter(item => item.attachmentId !== updated.attachmentId));
    if (!stillMatches) setTotalJobs(current => Math.max(0, current - 1));
  }

  async function run(job: InvestmentAiJobResponse) {
    setBusy(`${job.attachmentId}:run`);
    setError('');
    try {
      const result = await api.runAdminAiJob(job.attachmentId);
      applyJobUpdate(result);
      notify(t('Đã gửi yêu cầu chạy AI.'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    const job = pendingCancel;
    setPendingCancel(null);
    setBusy(`${job.attachmentId}:cancel`);
    setError('');
    try {
      const result = await api.cancelAdminAiJob(job.attachmentId);
      applyJobUpdate(result);
      notify(t('Đã hủy công việc AI.'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  if (!session) return <Screen title={t('Queue AI Admin')} back><Empty
    title={t('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')}/></Screen>;
  if (!session.user.roles.includes('ADMIN')) return <Screen title={t('Queue AI Admin')} back><Empty
    title={t('Màn hình này chỉ dành cho Admin.')}/></Screen>;
  return <Screen title={t('Queue AI Admin')} subtitle={t('Theo dõi và điều khiển AI transaction của toàn hệ thống')}
                 back>
    <Card tint><Row><Icon name="pulse-outline"/><View style={{flex: 1}}><T size={13}
                                                                           bold>{t('Hàng đợi AI toàn hệ thống')}</T><T
      size={10} color={c.muted}>{t('{{n}} công việc trong bộ lọc hiện tại', {n: totalJobs})}</T></View><Pressable
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
    {summary ? <Card><Row><View style={{flex: 1}}><T size={12} bold>{t('Tổng quan queue AI')}</T><T size={10}
                                                                                                    color={c.muted}>{t('Cập nhật lúc')} · {dateLabel(summary.generatedAt)}</T></View><Badge>{t('{{n}} công việc', {n: summary.total})}</Badge></Row><Row><Metric
      label={t('Đang chờ')} value={String(summary.pending)} color={c.primary}/><Metric label={t('Đang xử lý')}
                                                                                       value={String(summary.processing)}
                                                                                       color={c.warning}/><Metric
      label={t('Thất bại')} value={String(summary.failed)}
      color={summary.failed ? c.error : c.success}/></Row><Row><Metric label={t('Sẵn sàng')}
                                                                       value={String(summary.ready)} color={c.success}/><Metric
      label={t('Đã hủy')} value={String(summary.cancelled)} color={c.muted}/><Metric label={t('Đã xác nhận')}
                                                                                     value={String(summary.confirmed)}
                                                                                     color={c.success}/></Row></Card> : null}
    {error ? <Info tone="error">{t(error)}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : jobs.length ? jobs.map(job => <AdminJobCard
        key={job.attachmentId} job={job} busy={busy} onRun={() => run(job)} onCancel={() => setPendingCancel(job)}/>) :
      <Empty title={t('Không có công việc AI')}
             description={t('Không có attachment transaction phù hợp với trạng thái đã chọn.')}/>}
    {!loading && nextPage < totalPages ?
      <Button label={t('Tải thêm')} kind="secondary" onPress={loadMore} loading={loadingMore}/> : null}
    <Info>{t('Admin chỉ điều khiển trạng thái xử lý; dữ liệu transaction vẫn cần người dùng kiểm tra và xác nhận trước khi ghi sổ.')}</Info>
    <Dialog visible={!!pendingCancel} title={t('Hủy công việc AI?')}
            message={t('Attachment sẽ được đánh dấu đã hủy và không tự chạy tiếp.')}
            onClose={() => setPendingCancel(null)} onConfirm={confirmCancel} confirmLabel={t('Hủy công việc')}/>{dialog}
  </Screen>;
}
