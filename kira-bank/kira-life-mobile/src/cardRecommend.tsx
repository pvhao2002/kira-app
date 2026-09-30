import React, {useCallback, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {bankErrorMessage, CardRecommendation, CardRecommendationResponse, useBankApi} from './bankApi';
import {money} from './data';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, Field, go, Info, Metric, Progress, Row, Screen, Section, T, useNotice} from './ui';

/** Common spending groups; each maps to one representative MCC (same list as the web app). */
const presets = [
  {mcc: '5812', label: 'Nhà hàng'},
  {mcc: '5814', label: 'Đồ ăn nhanh & cà phê'},
  {mcc: '5411', label: 'Siêu thị'},
  {mcc: '5541', label: 'Xăng dầu'},
  {mcc: '5399', label: 'Mua sắm online'},
  {mcc: '4121', label: 'Taxi & gọi xe'},
  {mcc: '4511', label: 'Vé máy bay'},
  {mcc: '7011', label: 'Khách sạn'},
  {mcc: '5732', label: 'Điện máy'},
  {mcc: '5912', label: 'Nhà thuốc'},
  {mcc: '7832', label: 'Rạp phim'},
  {mcc: '8299', label: 'Giáo dục'},
  {mcc: '4900', label: 'Điện nước'}
];

const reasonLabels: Record<string, string> = {
  NO_CASHBACK_PROGRAM: 'Chưa có chương trình cashback',
  NO_MATCHING_RULE: 'Không hoàn tiền cho MCC này',
  RULE_CAP_REACHED: 'Đã chạm trần nhóm',
  CARD_CAP_REACHED: 'Đã chạm trần tháng',
  PARTIALLY_CAPPED: 'Chỉ một phần được hoàn',
  INSUFFICIENT_CREDIT: 'Không đủ hạn mức',
  CREDIT_LIMIT_UNKNOWN: 'Chưa rõ hạn mức'
};

/** Parses a typed amount as whole currency units; digits only so no floating-point input reaches the API. */
const parseAmount = (value: string): number | undefined => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const usedPercent = (remaining: number | null, cap: number | null) =>
  remaining === null || cap === null || cap <= 0 ? 0 : Math.round((1 - remaining / cap) * 100);

function RecommendationCard({card, rank, best, hasAmount, recording, onRecord}: {
  card: CardRecommendation;
  rank: number;
  best: boolean;
  hasAmount: boolean;
  recording: boolean;
  onRecord: () => void
}) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const format = (value: number | null) => value === null ? '—' : money(value, card.currency, lang);
  return <Card tint={best}>
    <Row><T size={12} bold color={c.muted}>#{rank}</T><View style={{flex: 1}}><T size={14}
                                                                              bold>{card.nickname}{card.lastFour ? ` · •••• ${card.lastFour}` : ''}</T><T
      size={10} color={c.muted}>{card.bankName}{card.categoryName ? ` · ${card.categoryName}` : ''}</T></View>{best ?
      <Badge tone="success">{t('Nên dùng')}</Badge> : null}</Row>
    <Row style={{marginTop: 10}}>
      <Metric label={t('Cashback ước tính')} value={hasAmount ? format(card.estimatedCashback) : '—'} color={c.success}/>
      <Metric label={t('Tỷ lệ')} value={card.cashbackRate === null ? '—' : `${card.cashbackRate}%`}/>
      <Metric label={t('Hạn mức khả dụng')} value={format(card.availableCredit)}/>
    </Row>
    {card.ruleCap !== null ? <View style={{marginTop: 10, gap: 4}}><Row style={{justifyContent: 'space-between'}}><T
      size={10} color={c.muted}>{t('Trần nhóm kỳ này')}</T><T size={10}
                                                          color={c.muted}>{t('Còn {{remaining}} / {{cap}}', {
      remaining: format(card.ruleRemaining),
      cap: format(card.ruleCap)
    })}</T></Row><Progress value={usedPercent(card.ruleRemaining, card.ruleCap)}/></View> : null}
    {card.cardCap !== null ? <View style={{marginTop: 8, gap: 4}}><Row style={{justifyContent: 'space-between'}}><T
      size={10} color={c.muted}>{t('Trần tháng của thẻ')}</T><T size={10}
                                                           color={c.muted}>{t('Còn {{remaining}} / {{cap}}', {
      remaining: format(card.cardRemaining),
      cap: format(card.cardCap)
    })}</T></Row><Progress value={usedPercent(card.cardRemaining, card.cardCap)} color={c.lavender}/></View> : null}
    {card.reasons.length ? <Row style={{flexWrap: 'wrap', gap: 6, marginTop: 10}}>{card.reasons.map(reason => <Badge
      key={reason}
      tone={reason === 'INSUFFICIENT_CREDIT' || reason.endsWith('CAP_REACHED') ? 'error' : 'warning'}>{t(reasonLabels[reason] ?? reason)}</Badge>)}</Row> : null}
    <View style={{marginTop: 12}}><Button label={t('Tôi đã quẹt thẻ này')} kind="secondary" icon="checkmark-outline"
                                          disabled={!hasAmount || recording} loading={recording}
                                          onPress={onRecord}/></View>
  </Card>;
}

export function CardRecommend() {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [mcc, setMcc] = useState(presets[0].mcc);
  const [amountText, setAmountText] = useState('');
  const [result, setResult] = useState<CardRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const amount = parseAmount(amountText);
  const validMcc = /^\d{4}$/.test(mcc);

  const load = (code: string, value?: number) => {
    if (!/^\d{4}$/.test(code)) {
      setError(t('MCC phải gồm 4 chữ số.'));
      return;
    }
    setLoading(true);
    setError('');
    api.recommendations(code, value)
      .then(setResult)
      .catch(e => setError(t(bankErrorMessage(e))))
      .finally(() => setLoading(false));
  };
  // Focus reloads use the latest query and API client without re-subscribing on every keystroke.
  const latest = useRef({load, mcc, amount});
  latest.current = {load, mcc, amount};
  useFocusEffect(useCallback(() => {
    latest.current.load(latest.current.mcc, latest.current.amount);
  }, []));

  const record = (card: CardRecommendation) => {
    if (!amount || recordingId !== null) return;
    setRecordingId(card.cardId);
    const preset = presets.find(item => item.mcc === mcc);
    api.createCardTransaction(card.cardId, {
      transactionDate: today(),
      description: preset ? t(preset.label) : `MCC ${mcc}`,
      amount,
      transactionType: 'SPENDING',
      mccCode: mcc,
      cashbackRuleId: card.ruleId
    }, `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .then(() => {
        notify(t('Đã ghi nhận vào {{card}}.', {card: card.nickname}));
        load(mcc, amount);
      })
      .catch(e => setError(t(bankErrorMessage(e))))
      .finally(() => setRecordingId(null));
  };

  const cards = result?.cards ?? [];
  const bestId = cards[0] && !cards[0].insufficientCredit && cards[0].estimatedCashback > 0 ? cards[0].cardId : null;

  return <Screen title={t('Nên quẹt thẻ nào?')} subtitle={t('So sánh cashback còn lại trong kỳ của từng thẻ')} back>
    <Section title={t('Nhóm chi tiêu')}/>
    <Chips values={presets.map(item => ({label: t(item.label), value: item.mcc}))} value={mcc}
           onChange={value => {
             setMcc(value);
             load(value, amount);
           }}/>
    <Row style={{alignItems: 'flex-start'}}>
      <View style={{width: 96}}><Field label="MCC" value={mcc} keyboardType="number-pad" maxLength={4}
                                       onChangeText={value => setMcc(value.replace(/\D/g, '').slice(0, 4))}/></View>
      <View style={{flex: 1}}><Field label={t('Số tiền')} value={amountText} keyboardType="number-pad"
                                     placeholder={t('Không bắt buộc')}
                                     onChangeText={value => setAmountText(value.replace(/\D/g, ''))}/></View>
    </Row>
    <Button label={t('Tìm thẻ tốt nhất')} icon="search-outline" disabled={!validMcc || loading} loading={loading}
            onPress={() => load(mcc, amount)}/>
    <T size={10} color={c.muted}>{t('Trần cashback tính theo giao dịch bạn đã nhập hoặc ghi nhận. Cửa hàng có thể dùng MCC khác với dự kiến.')}</T>
    {error ? <Info tone="error">{error}</Info> : null}
    {loading && !result ? <ActivityIndicator color={c.primary}/> : null}
    {result && !cards.length ? <Empty title={t('Bạn chưa có thẻ tín dụng đang hoạt động.')} action={t('Thêm thẻ')}
                                      onPress={() => go('card-add')}/> : null}
    {cards.map((card, index) => <RecommendationCard key={card.cardId} card={card} rank={index + 1}
                                                    best={bestId === card.cardId} hasAmount={!!amount}
                                                    recording={recordingId === card.cardId}
                                                    onRecord={() => record(card)}/>)}
    {dialog}
  </Screen>;
}
