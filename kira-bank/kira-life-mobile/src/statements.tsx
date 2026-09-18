import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {dateLabel, money} from './data';
import {bankErrorMessage, CreditCardResponse, PaymentHistoryResponse, StatementResponse, useBankApi} from './bankApi';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, Field, go, Icon, Info, Metric, Row, Screen, Section, T} from './ui';

const payable = (status: string) => ['OPEN', 'UNPAID', 'PARTIALLY_PAID'].includes(status);

function StatementCard({statement, card}: { statement: StatementResponse; card?: CreditCardResponse }) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Card><Row><View style={{flex: 1}}><T size={14}
                                               bold>{card?.nickname || t('Sao kê #{{id}}', {id: statement.id})}</T><T
    size={10}
    color={c.muted}>{card?.bankName || t('Thẻ liên kết')} · {dateLabel(statement.statementDate)}</T></View><Badge
    tone={statement.status === 'PAID' ? 'success' : statement.status === 'CANCELLED' ? 'muted' : 'warning'}>{t(statement.status)}</Badge></Row><Row><Metric
    label={t('DƯ NỢ SAO KÊ')} value={money(statement.statementBalance, card?.currency || 'VND', lang)}/><Metric
    label={t('CÒN PHẢI TRẢ')} value={money(statement.remainingAmount, card?.currency || 'VND', lang)}
    color={statement.remainingAmount > 0 ? c.primary : c.success}/></Row><Row><T size={10} color={c.muted}
                                                                                 style={{flex: 1}}>{t('Hạn thanh toán')}: {dateLabel(statement.dueDate)}</T>{payable(statement.status) && statement.remainingAmount > 0 ?
    <Pressable accessibilityRole="button" onPress={() => go('statement-pay', {id: String(statement.id)})}
               style={{padding: 8}}><T size={11} color={c.primary}>{t('Thanh toán')} ›</T></Pressable> : null}
  </Row></Card>;
}

export function StatementsPreview() {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [statements, setStatements] = useState<StatementResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listStatements(0, 3), api.listCards('', 0, 50)]).then(([statementPage, cardPage]) => {
      setStatements(statementPage.data);
      setCards(cardPage.data);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  const cardById = new Map(cards.map(card => [card.id, card]));
  return <><Section title={t('Kỳ sao kê & Hạn sắp tới')} action={t('Quản lý sao kê')}
                    onPress={() => go('statements')}/>{loading ?
    <Card><ActivityIndicator color={c.primary}/></Card> : error ?
      <Card><Info tone="error">{error}</Info></Card> : statements.length ? statements.slice(0, 2).map(statement =>
          <StatementCard key={statement.id} statement={statement} card={cardById.get(statement.userCardId)}/>) :
        <Card><T size={11} color={c.muted}>{t('Chưa có sao kê')}</T><Button label={t('Quản lý sao kê')} kind="secondary"
                                                                            onPress={() => go('statements')}/></Card>}</>;
}

export function StatementsManagement() {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [statements, setStatements] = useState<StatementResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listAllStatements(), api.listAllCards()]).then(([statementItems, cardItems]) => {
      setStatements(statementItems);
      setCards(cardItems);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  const shown = statements.filter(statement => filter === 'all' || statement.status === filter);
  const cardById = new Map(cards.map(card => [card.id, card]));
  return <Screen title={t('Quản lý sao kê')} subtitle={t('Theo dõi dư nợ, hạn thanh toán và lịch sử trả nợ')} back><Row><View
    style={{flex: 1}}><T size={21} bold>{t('Sao kê & Thanh toán')}</T><T size={11}
                                                                         color={c.muted}>{t('{{n}} sao kê trong tài khoản', {n: statements.length})}</T></View><Button
    label={t('Lịch sử')} kind="secondary" icon="time-outline" onPress={() => go('payments')}/><Button
    label={t('Thống kê')} kind="secondary" icon="analytics-outline" onPress={() => go('credit-stats')}/></Row><Button
    label={t('Nhập sao kê')} kind="secondary" icon="add-circle-outline" onPress={() => go('statement-add')}/><Chips
    value={filter} onChange={setFilter}
    values={[{value: 'all', label: t('Tất cả')}, {value: 'OPEN', label: t('Đang mở')}, {
      value: 'PARTIALLY_PAID',
      label: t('Trả một phần')
    }, {value: 'PAID', label: t('Đã thanh toán')}, {value: 'CANCELLED', label: t('Đã hủy')}]}/>{error ?
    <Info tone="error">{error}</Info> : null}{loading ?
    <ActivityIndicator color={c.primary}/> : shown.length ? shown.map(statement => <StatementCard key={statement.id}
                                                                                                  statement={statement}
                                                                                                  card={cardById.get(statement.userCardId)}/>) :
      <Empty title={t('Chưa có sao kê')} description={t('Sao kê được tạo từ dữ liệu đối soát của thẻ.')}
             action={t('Quản lý thẻ')}
             onPress={() => go('cards')}/>}<Info>{t('Thanh toán được gửi kèm Idempotency-Key để tránh ghi nhận trùng khi mạng chập chờn.')}</Info></Screen>;
}

const isoToday = (offsetMonths = 0, day = 1) => {
  const date = new Date();
  date.setMonth(date.getMonth() + offsetMonths, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function StatementEditor() {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    cardId: '',
    periodStart: isoToday(0, 1),
    periodEnd: isoToday(0, new Date().getDate()),
    statementDate: isoToday(),
    dueDate: isoToday(1, 5),
    openingBalance: '0',
    totalSpending: '',
    totalRefund: '0',
    totalFee: '0',
    totalInterest: '0',
    minimumPayment: ''
  });
  const selectedCard = cards.find(card => String(card.id) === form.cardId);
  const update = (key: keyof typeof form, value: string) => setForm(current => ({...current, [key]: value}));
  useEffect(() => {
    api.listCards().then(result => {
      setCards(result.data);
      if (result.data[0]) update('cardId', String(result.data[0].id));
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);

  async function save() {
    const dates = [form.periodStart, form.periodEnd, form.statementDate, form.dueDate];
    const amounts = [form.openingBalance, form.totalSpending, form.totalRefund, form.totalFee, form.totalInterest, form.minimumPayment].map(Number);
    const [openingBalance, totalSpending, totalRefund, totalFee, totalInterest, minimumPayment] = amounts;
    const balance = openingBalance + totalSpending + totalFee + totalInterest - totalRefund;
    if (!form.cardId || dates.some(value => !/^\d{4}-\d{2}-\d{2}$/.test(value)) || form.periodEnd < form.periodStart || form.dueDate < form.statementDate || amounts.some(value => !Number.isFinite(value) || value < 0) || balance < 0 || (balance > 0 && minimumPayment <= 0) || minimumPayment > balance) {
      setError(t('Kiểm tra thẻ, ngày và các khoản tiền; dư nợ phải không âm, thanh toán tối thiểu không vượt dư nợ.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createStatement({
        userCardId: Number(form.cardId),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        statementDate: form.statementDate,
        dueDate: form.dueDate,
        openingBalance,
        totalSpending,
        totalRefund,
        totalFee,
        totalInterest,
        minimumPayment
      });
      router.back();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title={t('Nhập sao kê')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={t('Nhập sao kê')} subtitle={t('Thêm kỳ sao kê để theo dõi dư nợ và thống kê ngân hàng')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={t('Lưu sao kê')} icon="checkmark-circle-outline" onPress={save}
                                             loading={saving}/></View></Row>}>
    {error ? <Info tone="error">{error}</Info> : null}{cards.length ? <><Card tint><T size={12}
                                                                                      color={c.muted}>{t('Thẻ áp dụng *')}</T><Chips
      value={form.cardId} onChange={value => update('cardId', value)}
      values={cards.map(card => ({value: String(card.id), label: `${card.nickname} •••• ${card.lastFour}`}))}/><T
      size={10}
      color={c.muted}>{selectedCard ? `${selectedCard.bankName} · ${selectedCard.currency}` : t('Chọn một thẻ')}</T></Card><Card><Section
      title={t('Thời gian sao kê')}/><Row><View style={{flex: 1}}><Field label={t('Từ ngày *')} value={form.periodStart}
                                                                         onChangeText={value => update('periodStart', value)}
                                                                         placeholder="YYYY-MM-DD"/></View><View
      style={{flex: 1}}><Field label={t('Đến ngày *')} value={form.periodEnd}
                               onChangeText={value => update('periodEnd', value)}
                               placeholder="YYYY-MM-DD"/></View></Row><Row><View style={{flex: 1}}><Field
      label={t('Ngày chốt *')} value={form.statementDate} onChangeText={value => update('statementDate', value)}
      placeholder="YYYY-MM-DD"/></View><View style={{flex: 1}}><Field label={t('Ngày đến hạn *')} value={form.dueDate}
                                                                      onChangeText={value => update('dueDate', value)}
                                                                      placeholder="YYYY-MM-DD"/></View></Row></Card><Card><Section
      title={t('Cấu phần dư nợ')}/><Field label={t('Dư đầu kỳ')} value={form.openingBalance}
                                          onChangeText={value => update('openingBalance', value.replace(/[^0-9.]/g, ''))}
                                          keyboardType="decimal-pad"/><Field label={t('Tổng chi tiêu')}
                                                                             value={form.totalSpending}
                                                                             onChangeText={value => update('totalSpending', value.replace(/[^0-9.]/g, ''))}
                                                                             keyboardType="decimal-pad"/><Field
      label={t('Tổng hoàn tiền')} value={form.totalRefund}
      onChangeText={value => update('totalRefund', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"/><Row><View
      style={{flex: 1}}><Field label={t('Phí')} value={form.totalFee}
                               onChangeText={value => update('totalFee', value.replace(/[^0-9.]/g, ''))}
                               keyboardType="decimal-pad"/></View><View style={{flex: 1}}><Field label={t('Lãi')}
                                                                                                 value={form.totalInterest}
                                                                                                 onChangeText={value => update('totalInterest', value.replace(/[^0-9.]/g, ''))}
                                                                                                 keyboardType="decimal-pad"/></View></Row><Field
      label={t('Thanh toán tối thiểu')} value={form.minimumPayment}
      onChangeText={value => update('minimumPayment', value.replace(/[^0-9.]/g, ''))}
      keyboardType="decimal-pad"/><Info>{t('Dư nợ dự kiến')}: {money([form.openingBalance, form.totalSpending, form.totalFee, form.totalInterest].map(Number).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) - (Number(form.totalRefund) || 0), selectedCard?.currency || 'VND', lang)}</Info></Card><Info>{t('Sao kê được lưu vào sổ Kira Bank; không tự động đọc hoặc chuyển tiền từ ngân hàng.')}</Info></> :
    <Empty title={t('Chưa có thẻ')} description={t('Thêm thẻ trước khi nhập sao kê.')} action={t('Quản lý thẻ')}
           onPress={() => go('cards')}/>}
  </Screen>;
}

function PaymentCard({payment, statement, card}: {
  payment: PaymentHistoryResponse;
  statement?: StatementResponse;
  card?: CreditCardResponse
}) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const method = payment.paymentMethod === 'BANK_TRANSFER' ? t('Chuyển khoản') : payment.paymentMethod === 'CASH' ? t('Tiền mặt') : t('Khác');
  return <Card><Row><Icon name="checkmark-circle-outline" color={c.success} size={20}/><View style={{flex: 1}}><T
    size={13} bold>{t('Thanh toán sao kê #{{id}}', {id: payment.statementId})}</T><T size={10}
                                                                                     color={c.muted}>{card?.nickname || t('Thẻ liên kết')} · {dateLabel(payment.paymentDate)}</T></View><Badge
    tone={payment.status === 'COMPLETED' ? 'success' : 'warning'}>{payment.status === 'COMPLETED' ? t('Đã hoàn tất') : t(payment.status)}</Badge></Row><Row><Metric
    label={t('SỐ TIỀN')} value={money(payment.amount, card?.currency || 'VND', lang)} color={c.success}/><Metric
    label={t('PHƯƠNG THỨC')} value={method} color={c.text}/></Row><T size={10}
                                                                     color={c.muted}>{t('Mã tham chiếu')}: {payment.referenceNumber}</T>{statement ?
    <T size={10}
       color={c.muted}>{t('Còn lại sau kỳ sao kê')}: {money(statement.remainingAmount, card?.currency || 'VND', lang)}</T> : null}{payment.note ?
    <T size={10} color={c.muted}>{t('Ghi chú')}: {payment.note}</T> : null}</Card>;
}

export function PaymentHistory() {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [payments, setPayments] = useState<PaymentHistoryResponse[]>([]);
  const [statements, setStatements] = useState<StatementResponse[]>([]);
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listAllPayments(), api.listAllStatements(), api.listAllCards()]).then(([paymentItems, statementItems, cardItems]) => {
      setPayments(paymentItems);
      setStatements(statementItems);
      setCards(cardItems);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  const shown = payments.filter(payment => filter === 'all' || payment.status === filter);
  const statementById = new Map(statements.map(statement => [statement.id, statement]));
  const cardById = new Map(cards.map(card => [card.id, card]));
  return <Screen title={t('Lịch sử thanh toán')} subtitle={t('Tra cứu các khoản đã ghi nhận vào sổ Kira Bank')}
                 back><Row><View style={{flex: 1}}><T size={21} bold>{t('Lịch sử trả nợ')}</T><T size={11}
                                                                                                 color={c.muted}>{t('{{n}} khoản thanh toán', {n: payments.length})}</T></View><Button
    label={t('Sao kê')} kind="secondary" icon="receipt-outline" onPress={() => go('statements')}/></Row><Chips
    value={filter} onChange={setFilter}
    values={[{value: 'all', label: t('Tất cả')}, {value: 'COMPLETED', label: t('Đã hoàn tất')}]}/>{error ?
    <Info tone="error">{error}</Info> : null}{loading ?
    <ActivityIndicator color={c.primary}/> : shown.length ? shown.map(payment => {
      const statement = statementById.get(payment.statementId);
      return <PaymentCard key={payment.id} payment={payment} statement={statement}
                          card={statement ? cardById.get(statement.userCardId) : undefined}/>;
    }) : <Empty title={t('Chưa có thanh toán')}
                description={t('Các khoản trả nợ sẽ xuất hiện sau khi được ghi nhận vào một sao kê.')}
                action={t('Quản lý sao kê')}
                onPress={() => go('statements')}/>}<Info>{t('Lịch sử này chỉ hiển thị các khoản thanh toán thuộc tài khoản hiện tại.')}</Info></Screen>;
}

export function StatementPayment({id}: { id: string }) {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const statementId = Number(id);
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [card, setCard] = useState<CreditCardResponse | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => `statement-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    api.getStatement(statementId).then(async value => {
      setStatement(value);
      setAmount(String(value.remainingAmount));
      try {
        setCard(await api.getCard(value.userCardId));
      } catch { /* card details are optional for payment */
      }
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [statementId, t]);

  async function pay() {
    const value = Number(amount);
    if (!statement || !payable(statement.status) || value <= 0 || value > statement.remainingAmount || !reference.trim()) {
      setError(t('Nhập số tiền không vượt số dư còn lại và mã tham chiếu.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.payStatement(statement.id, {
        amount: value,
        paymentMethod: method,
        referenceNumber: reference.trim(),
        note: note.trim() || undefined
      }, idempotencyKey);
      router.back();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title={t('Thanh toán sao kê')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={t('Thanh toán sao kê')} subtitle={card?.nickname || t('Xác nhận khoản thanh toán')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={t('Ghi nhận thanh toán')} icon="checkmark-circle-outline"
                                             onPress={pay} loading={saving}/></View></Row>}>
    {error ? <Info tone="error">{error}</Info> : null}{statement ?
    <Card tint><T size={11} color={c.primary}>{t('DƯ NỢ CÒN LẠI')}</T><T size={26}
                                                                         bold>{money(statement.remainingAmount, card?.currency || 'VND', lang)}</T><T
      size={10} color={c.muted}>{t('Hạn thanh toán')}: {dateLabel(statement.dueDate)}</T><Field
      label={t('Số tiền thanh toán *')} value={amount} onChangeText={value => setAmount(value.replace(/[^0-9.]/g, ''))}
      keyboardType="decimal-pad"/><T size={12} color={c.muted}>{t('Phương thức thanh toán')}</T><Chips value={method}
                                                                                                       onChange={setMethod}
                                                                                                       values={[{
                                                                                                         value: 'BANK_TRANSFER',
                                                                                                         label: t('Chuyển khoản')
                                                                                                       }, {
                                                                                                         value: 'CASH',
                                                                                                         label: t('Tiền mặt')
                                                                                                       }, {
                                                                                                         value: 'OTHER',
                                                                                                         label: t('Khác')
                                                                                                       }]}/><Field
      label={t('Mã tham chiếu *')} value={reference} onChangeText={setReference}
      placeholder={t('Mã giao dịch ngân hàng')}/><Field label={t('Ghi chú')} value={note} onChangeText={setNote}
                                                        multiline/><Info>{t('Khoản thanh toán chỉ cập nhật sổ sao kê Kira; không tự động chuyển tiền từ ngân hàng.')}</Info></Card> :
    <Empty title={t('Không tìm thấy sao kê')}/>}
  </Screen>;
}
