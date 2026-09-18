import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {router} from 'expo-router';
import {dateLabel} from './data';
import {AttachmentAiStatus, errorMessage, InvestmentAiJobResponse, useInvestmentApi} from './investmentApi';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Empty, Icon, Info, Row, Screen, Section, T} from './ui';

const statusLabels: Record<AttachmentAiStatus, string> = {
  NOT_REQUESTED: 'Chưa yêu cầu', PENDING: 'Đang chờ', PROCESSING: 'Đang xử lý', READY: 'Sẵn sàng',
  FAILED: 'Thất bại', CANCELLED: 'Đã hủy', CONFIRMED: 'Đã xác nhận',
};
const actorLabels = {USER: 'Người dùng', ADMIN: 'Quản trị viên', SYSTEM: 'Hệ thống'} as const;
const reasonLabels: Record<string, string> = {
  INITIAL_UPLOAD: 'Tải ảnh lên',
  MANUAL_RETRY: 'Người dùng yêu cầu thử lại',
  MANUAL_RUN_RESET: 'Đặt lại để chạy thủ công',
  MANUAL_RUN: 'Chạy thủ công',
  SCHEDULED_RUN: 'Scheduler nhận job',
  AI_PROCESSING_TIMEOUT: 'Quá thời gian xử lý AI',
  AI_RESULT_READY: 'AI trả kết quả',
  AI_RESULT_MISSING: 'Thiếu kết quả AI',
  AI_PROVIDER_ERROR: 'Provider AI báo lỗi',
  ATTACHMENT_STORAGE_UNAVAILABLE: 'Không đọc được ảnh từ R2',
  AI_MANUAL_RUN_ERROR: 'Lỗi chạy thủ công',
  USER_CONFIRMED: 'Người dùng xác nhận',
  MANUAL_CANCEL: 'Hủy thủ công',
  MIGRATED_EXISTING_STATE: 'Đồng bộ trạng thái cũ',
};
const tone = (status: AttachmentAiStatus): 'primary' | 'success' | 'warning' | 'error' | 'muted' =>
  status === 'READY' || status === 'CONFIRMED' ? 'success' : status === 'FAILED' ? 'error' : status === 'PROCESSING' ? 'warning' : status === 'CANCELLED' ? 'muted' : 'primary';

export function AiJobDetail({id, admin = false}: { id: string; admin?: boolean }) {
  const attachmentId = Number(id);
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [job, setJob] = useState<InvestmentAiJobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
      setError(t('Không tìm thấy công việc AI'));
      setLoading(false);
      return;
    }
    const request = admin ? api.getAdminAiJob(attachmentId) : api.getAiJob(attachmentId);
    request.then(setJob).catch(e => setError(errorMessage(e))).finally(() => setLoading(false));
  }, [attachmentId, admin]);

  useEffect(() => {
    if (!job || !['PENDING', 'PROCESSING'].includes(job.status)) return;
    const timer = setInterval(() => {
      const request = admin ? api.getAdminAiJob(attachmentId) : api.getAiJob(attachmentId);
      request.then(setJob).catch(() => {
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [job, attachmentId, admin]);

  if (loading) return <Screen title={t('Chi tiết queue AI')} back><ActivityIndicator color={c.primary}/></Screen>;
  if (!job) return <Screen title={t('Chi tiết queue AI')} back><Empty
    title={error ? t(error) : t('Không tìm thấy công việc AI')}/></Screen>;

  return <Screen title={t('Chi tiết queue AI')}
                 subtitle={admin ? t('Theo dõi lịch sử xử lý toàn hệ thống') : t('Theo dõi đầy đủ từng lần xử lý')}
                 back>
    <Card tint><Row><Icon name="document-text-outline" color={job.status === 'FAILED' ? c.error : c.primary}/><View
      style={{flex: 1}}><T size={15} bold>{job.originalName}</T><T size={10}
                                                                   color={c.muted}>#{job.attachmentId}{job.owner ? ` · ${job.owner.fullName || t('Không xác định')}` : ''}</T></View><Badge
      tone={tone(job.status)}>{t(statusLabels[job.status])}</Badge></Row>
      <Row><View style={{flex: 1}}><T size={10} color={c.muted}>{t('Lần chạy')}</T><T
        size={13}>{job.attemptCount} / {job.maxAttempts}</T></View><View style={{flex: 1, alignItems: 'flex-end'}}><T
        size={10} color={c.muted}>{t('Tạo lúc')}</T><T size={10}>{dateLabel(job.createdAt)}</T></View></Row>
      <Row><View style={{flex: 1}}><T size={10} color={c.muted}>{t('Model AI')}</T><T
        size={11}>{job.model || '—'}</T></View><View style={{flex: 1, alignItems: 'flex-end'}}><T size={10}
                                                                                                  color={c.muted}>{t('Ảnh nguồn')}</T><T
        size={10}>{job.contentAvailable ? t('Khả dụng') : t('Đã hết hạn lưu trữ')}</T></View></Row>
      {job.error ? <Info tone="error">{t('Lỗi gần nhất')}: {job.error}</Info> : null}
    </Card>
    {job.reviewTargets.length ?
      <Card><T size={12} bold>{t('Lô transaction chờ duyệt')}</T>{job.reviewTargets.map(target => <Row
        key={target.batchId} style={{alignItems: 'flex-start'}}><Icon name="business-outline" size={18}
                                                                      color={c.primary}/><View style={{flex: 1}}><T
        size={11} bold>{target.accountName}</T><T size={10}
                                                  color={c.muted}>#{target.batchId.slice(0, 8).toUpperCase()} · {t(statusLabels[target.batchStatus as AttachmentAiStatus] || target.batchStatus)}</T></View><Badge>{t('{{n}} bản ghi chờ', {n: target.pendingItemCount})}</Badge></Row>)}
      </Card> : null}
    <Section title={t('Lịch sử chuyển trạng thái')}/>
    {job.history.length ? job.history.map((event, index) => <Card key={`${event.createdAt}-${index}`} style={{
      gap: 8,
      borderLeftWidth: 3,
      borderLeftColor: event.toStatus === 'FAILED' ? c.error : event.toStatus === 'READY' || event.toStatus === 'CONFIRMED' ? c.success : c.primary
    }}>
      <Row><Icon
        name={event.toStatus === 'FAILED' ? 'alert-circle-outline' : event.toStatus === 'READY' || event.toStatus === 'CONFIRMED' ? 'checkmark-circle-outline' : 'pulse-outline'}
        color={event.toStatus === 'FAILED' ? c.error : c.primary} size={19}/><T size={12} bold
                                                                                style={{flex: 1}}>{event.fromStatus ? `${t(statusLabels[event.fromStatus])} → ` : ''}{t(statusLabels[event.toStatus])}</T><T
        size={9} color={c.muted}>{dateLabel(event.createdAt)}</T></Row>
      <Row><T size={10} color={c.muted} style={{flex: 1}}>{t('Lần chạy')}: {event.attemptCount}</T><T size={10}
                                                                                                      color={c.muted}>{t(actorLabels[event.actorType])}</T></Row>
      <T size={11} color={c.muted}>{t(reasonLabels[event.reasonCode] || event.reasonCode)}</T>
    </Card>) : <Empty title={t('Chưa có lịch sử xử lý')}
                      description={t('Job này chưa có sự kiện chuyển trạng thái được lưu lại.')}/>}
    <Section title={t('Dữ liệu và thao tác')}/>
    {job.detectedJson ? <Info
      tone="success">{t('Đã trích xuất {{n}} transaction trong JSON chuẩn hóa.', {n: job.detectedJson.transactions.length})}</Info> : null}
    <Button label={t('Xem ảnh nguồn')} kind="secondary" disabled={!job.contentAvailable}
            onPress={() => router.push({pathname: '/[page]', params: {page: admin ? 'admin-source' : 'source', id}})}/>
    <Button label={t('Xem kết quả AI')} disabled={!['READY', 'CONFIRMED'].includes(job.status)}
            onPress={() => router.push({
              pathname: '/[page]',
              params: {page: admin ? 'admin-ai-result' : 'ai-result', id}
            })}/>
    <Button label={t('Về hàng đợi AI')} kind="secondary" onPress={() => router.back()}/>
  </Screen>;
}
