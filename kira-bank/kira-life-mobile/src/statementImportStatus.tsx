import React, {useCallback, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {bankErrorMessage, CreditCardResponse, StatementImportResponse, StatementImportStatus as Status, useBankApi} from './bankApi';
import {dateLabel, money} from './data';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Empty, Info, Metric, Row, Screen, T, useNotice} from './ui';

const statusLabels: Record<Status, string> = {
  QUEUED: 'Đang xếp hàng',
  PROCESSING: 'Đang đọc',
  READY: 'Chờ kiểm tra',
  FAILED: 'Thất bại',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy'
};
const statusTone = (status: Status) =>
  status === 'CONFIRMED' || status === 'READY' ? 'success' : status === 'FAILED' || status === 'CANCELLED' ? 'error' : 'primary';
const waiting = (status?: Status) => status === 'QUEUED' || status === 'PROCESSING';

/**
 * Read-only view of one AI statement import, opened from its notification. Review and confirmation stay on the web
 * app where the full table and source images fit; here the user can follow progress, retry or cancel.
 */
export function StatementImportStatus({id}: { id: string }) {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const importId = Number(id);
  const [item, setItem] = useState<StatementImportResponse | null>(null);
  const [card, setCard] = useState<CreditCardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!Number.isSafeInteger(importId) || importId <= 0) {
      setLoading(false);
      setError(t('Không tìm thấy lượt nhập sao kê.'));
      return;
    }
    api.getStatementImport(importId)
      .then(result => {
        setItem(result);
        setError('');
        if (!card || card.id !== result.cardId) api.getCard(result.cardId).then(setCard).catch(() => setCard(null));
      })
      .catch(e => setError(t(bankErrorMessage(e))))
      .finally(() => setLoading(false));
  };
  const latest = useRef({load, item});
  latest.current = {load, item};

  useFocusEffect(useCallback(() => {
    latest.current.load();
    // Poll only while AI is still working and the screen is visible.
    const timer = setInterval(() => {
      if (waiting(latest.current.item?.status)) latest.current.load();
    }, 5000);
    return () => clearInterval(timer);
  }, []));

  const act = (action: 'retry' | 'cancel') => {
    if (!item || busy) return;
    setBusy(true);
    const call = action === 'retry' ? api.retryStatementImport(item.id, item.version) : api.cancelStatementImport(item.id, item.version);
    call.then(result => {
      setItem(result);
      notify(t(action === 'retry' ? 'Đã đưa sao kê vào hàng đợi AI.' : 'Đã hủy lượt nhập sao kê.'));
    })
      .catch(e => setError(t(bankErrorMessage(e))))
      .finally(() => setBusy(false));
  };

  const draft = item?.draft;
  const currency = draft?.currency || card?.currency || 'VND';
  const format = (value: number | null | undefined) => value === null || value === undefined ? '—' : money(value, currency, lang);
  const reviewCount = draft?.transactions.filter(row => row.needsReview || row.duplicate).length ?? 0;

  return <Screen title={t('Nhập sao kê bằng AI')} subtitle={card ? `${card.nickname}${card.lastFour ? ' · •••• ' + card.lastFour : ''}` : undefined} back>
    {error ? <Info tone="error">{error}</Info> : null}
    {loading && !item ? <ActivityIndicator color={c.primary}/> : null}
    {!loading && !item && !error ? <Empty title={t('Không tìm thấy lượt nhập sao kê.')}/> : null}
    {item ? <>
      <Card>
        <Row><View style={{flex: 1}}><T size={15} bold>{t('Lượt nhập #{{id}}', {id: item.id})}</T><T size={10}
                                                                                                color={c.muted}>{dateLabel(item.createdAt)} · {t('{{count}} trang', {count: item.files.length})}</T></View><Badge
          tone={statusTone(item.status)}>{t(statusLabels[item.status])}</Badge></Row>
        {waiting(item.status) ? <Row style={{marginTop: 10}}><ActivityIndicator color={c.primary}/><T size={11}
                                                                                                    color={c.muted}
                                                                                                    style={{flex: 1}}>{item.aiConfigured ? t('AI đang đọc sao kê, màn hình tự cập nhật.') : t('AI chưa được cấu hình; lượt nhập sẽ tự chạy khi quản trị viên bật AI.')}</T></Row> : null}
        {item.status === 'FAILED' ? <T size={11} color={c.error}>{t('AI không đọc được sao kê này.')}{item.errorCode ? ` (${item.errorCode})` : ''}</T> : null}
      </Card>

      {draft ? <Card>
        <T size={13} bold>{t('AI đọc được')}</T>
        <Row style={{marginTop: 8}}>
          <Metric label={t('Tổng dư nợ')} value={format(draft.statementBalance)}/>
          <Metric label={t('Thanh toán tối thiểu')} value={format(draft.minimumPayment)}/>
        </Row>
        <Row style={{marginTop: 8}}>
          <Metric label={t('Ngày sao kê')} value={draft.statementDate ? dateLabel(draft.statementDate) : '—'}/>
          <Metric label={t('Hạn thanh toán')} value={draft.dueDate ? dateLabel(draft.dueDate) : '—'}/>
        </Row>
        <T size={11} color={c.muted} style={{marginTop: 8}}>{t('{{count}} giao dịch · {{review}} dòng cần kiểm tra', {
          count: draft.transactions.length,
          review: reviewCount
        })}</T>
      </Card> : null}

      {item.result ? <Card>
        <T size={13} bold>{t('Đã lưu sao kê')}</T>
        <T size={11} color={c.muted}>{t('Thêm {{count}} giao dịch', {count: item.result.inserted})} · {t('Bỏ qua {{count}} giao dịch trùng', {count: item.result.skipped})}</T>
        <T size={11} color={c.success}>{t('Cashback dự kiến: {{amount}}', {amount: format(item.result.expectedCashback)})}</T>
        {!item.result.totalsApplied ? <T size={11} color={c.warning}>{t('Kỳ sao kê đã có thanh toán nên giữ nguyên số tổng; chỉ thêm giao dịch.')}</T> : null}
      </Card> : null}

      {item.status === 'READY' ? <Info>{t('Hãy mở Kira Bank trên web để đối chiếu ảnh gốc, sửa và xác nhận sao kê.')}</Info> : null}
      {item.status === 'FAILED' && !item.storagePurged ?
        <Button label={t('Thử lại')} icon="refresh-outline" disabled={busy} loading={busy} onPress={() => act('retry')}/> : null}
      {item.status === 'QUEUED' || item.status === 'READY' || item.status === 'FAILED' ?
        <Button label={t('Hủy lượt nhập')} kind="danger" icon="close-outline" disabled={busy} onPress={() => act('cancel')}/> : null}
    </> : null}
    {dialog}
  </Screen>;
}
