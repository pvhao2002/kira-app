import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {BankCatalogItem, bankErrorMessage, CreditCardResponse, useBankApi} from './bankApi';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, Field, go, Icon, Info, Row, Screen, Section, T, useNotice} from './ui';

const number = (value: string, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function CardRow({card}: { card: CreditCardResponse }) {
  const t = useT();
  const {colors: c} = useTheme();
  const billingLabel = card.billingStatus === 'PAID' ? t('Đã thanh toán') : card.billingStatus === 'OVERDUE' ? t('Quá hạn') : card.billingStatus === 'NEEDS_INPUT' ? t('Cần nhập sao kê') : card.billingStatus === 'NOT_DUE' ? t('Chưa đến kỳ') : t('Chưa thanh toán');
  return <Card><Row><View style={{
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.primary + '22',
    alignItems: 'center',
    justifyContent: 'center'
  }}><Icon name="card-outline" size={19}/></View><View style={{flex: 1}}><T size={14} bold>{card.nickname}</T><T
    size={10} color={c.muted}>{card.bankName} · {card.cardType} · •••• {card.lastFour}</T></View><Badge
    tone={card.status === 'ACTIVE' ? 'success' : card.status === 'CLOSED' ? 'error' : 'warning'}>{t(card.status === 'ACTIVE' ? 'Hoạt động' : card.status === 'CLOSED' ? 'Đã đóng' : 'Không hoạt động')}</Badge></Row><Row><View
    style={{flex: 1}}><T size={10} color={c.muted}>{t('Hạn mức')}</T><T size={12}
                                                                        bold>{card.creditLimit.toLocaleString('vi-VN')} {card.currency}</T></View><View
    style={{flex: 1}}><T size={10} color={c.muted}>{t('Dư nợ hiện tại')}</T><T size={12} bold
                                                                               color={c.primary}>{card.currentBalance.toLocaleString('vi-VN')} {card.currency}</T></View></Row><Row><View
    style={{flex: 1}}><T size={10} color={c.muted}>{t('Kỳ sao kê')}</T><T size={11} bold
                                                                          color={card.billingStatus === 'OVERDUE' ? c.error : card.billingStatus === 'PAID' ? c.success : c.text}>{billingLabel}</T></View><Pressable
    accessibilityRole="button" accessibilityLabel={t('Cập nhật kỳ sao kê')}
    onPress={() => go('billing-cycle', {id: String(card.id)})} style={{padding: 8}}><Icon name="receipt-outline"
                                                                                          size={17}/></Pressable><Pressable
    accessibilityRole="button" accessibilityLabel={t('Chỉnh sửa')}
    onPress={() => go('card-edit', {id: String(card.id)})} style={{padding: 8}}><Icon name="pencil-outline" size={17}/></Pressable></Row></Card>;
}

export function CardManagement() {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api.listAllCards(query).then(items => {
      setCards(items);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [query, t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [query, load]);
  const shown = cards.filter(card => filter === 'all' || card.status === filter);
  return <Screen title={t('Quản lý thẻ')} subtitle={t('Theo dõi và cập nhật thông tin các thẻ thật')} back>
    <Row><View style={{flex: 1}}><T size={21} bold>{t('Thẻ của tôi')}</T><T size={11}
                                                                            color={c.muted}>{t('{{n}} thẻ đang được quản lý', {n: cards.length})}</T></View><Button
      label={t('Thêm thẻ')} icon="add" onPress={() => go('card-add')}/></Row>
    <Field label={t('Tìm thẻ')} value={query} onChangeText={setQuery} placeholder={t('Tên thẻ, số thẻ, ngân hàng')}/>
    <Chips value={filter} onChange={setFilter}
           values={[{value: 'all', label: t('Tất cả')}, {value: 'ACTIVE', label: t('Hoạt động')}, {
             value: 'INACTIVE',
             label: t('Không hoạt động')
           }, {value: 'CLOSED', label: t('Đã đóng')}]}/>
    {error ? <Info tone="error">{error}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : shown.length ? <>{shown.map(card => <CardRow key={card.id}
                                                                                                     card={card}/>)}<Button
        label={t('Xem thống kê theo ngân hàng')} kind="secondary" icon="analytics-outline"
        onPress={() => go('credit-stats')}/></> :
      <Empty title={t('Chưa có thẻ')} description={t('Thêm thẻ để quản lý hạn mức, trạng thái và thông tin sao kê.')}
             action={t('Thêm thẻ')} onPress={() => go('card-add')}/>}
  </Screen>;
}

export function CardEditor({id}: { id?: string }) {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const editing = !!id;
  const cardId = id ? Number(id) : 0;
  const [banks, setBanks] = useState<BankCatalogItem[]>([]);
  const [original, setOriginal] = useState<CreditCardResponse | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    bankId: '',
    cardType: 'Visa',
    nickname: '',
    lastFour: '',
    creditLimit: '',
    statementDay: '20',
    dueDay: '5',
    status: 'ACTIVE',
    note: ''
  });
  const field = (key: keyof typeof form, value: string) => setForm(previous => ({...previous, [key]: value}));
  useEffect(() => {
    api.listBanks().then(result => setBanks(result.data)).catch(e => setError(t(bankErrorMessage(e))));
  }, [t]);
  useEffect(() => {
    if (!editing || !cardId) return;
    api.getCard(cardId).then(card => {
      setOriginal(card);
      setForm({
        bankId: String(card.bankId),
        cardType: card.cardType,
        nickname: card.nickname,
        lastFour: card.lastFour,
        creditLimit: String(card.creditLimit),
        statementDay: String(card.statementDay),
        dueDay: String(card.dueDay),
        status: card.status,
        note: card.note || ''
      });
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [cardId, editing, t]);

  async function save() {
    const creditLimit = number(form.creditLimit);
    const statementDay = number(form.statementDay);
    const dueDay = number(form.dueDay);
    if ((!editing && !form.bankId) || !form.nickname.trim() || !/^\d{4}$/.test(form.lastFour) || creditLimit <= 0 || statementDay < 1 || statementDay > 31 || dueDay < 1 || dueDay > 31) {
      setError(t('Nhập ngân hàng, tên thẻ, 4 số cuối, hạn mức và ngày hợp lệ.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing && original) {
        await api.updateCard(original.id, {
          cardType: form.cardType.trim(),
          nickname: form.nickname.trim(),
          lastFour: form.lastFour,
          creditLimit,
          statementDay,
          dueDay,
          note: form.note.trim() || null,
          status: form.status,
          version: original.version,
          creditLimitVersion: original.creditLimitVersion
        });
      } else {
        await api.createCard({
          bankId: Number(form.bankId),
          cardType: form.cardType.trim(),
          nickname: form.nickname.trim(),
          lastFour: form.lastFour,
          creditLimit,
          statementDay,
          dueDay,
          note: form.note.trim() || null
        });
        notify(t('Đã thêm thẻ thật vào danh sách quản lý.'));
      }
      router.back();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title={t('Quản lý thẻ')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={editing ? t('Chỉnh sửa thẻ') : t('Thêm thẻ')}
                 subtitle={t('Thông tin được lưu vào tài khoản Kira của bạn')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={editing ? t('Lưu thay đổi') : t('Thêm thẻ')}
                                             icon="checkmark-circle-outline" onPress={save}
                                             loading={saving}/></View></Row>}>
    {error ? <Info tone="error">{error}</Info> : null}
    <Card tint><Section title={t('Thông tin thẻ')}/>{!editing ? <><T size={12}
                                                                     color={c.muted}>{t('Ngân hàng *')}</T><Chips
        value={form.bankId} onChange={value => field('bankId', value)}
        values={banks.map(bank => ({value: String(bank.id), label: bank.shortName || bank.name}))}/>{!banks.length ?
        <T size={11} color={c.muted}>{t('Đang tải danh sách ngân hàng…')}</T> : null}</> :
      <Info>{original?.bankName} · {original?.currency}</Info>}<Field label={t('Loại thẻ *')} value={form.cardType}
                                                                      onChangeText={value => field('cardType', value)}
                                                                      placeholder="Visa Signature"/><Field
      label={t('Tên hiển thị *')} value={form.nickname} onChangeText={value => field('nickname', value)}
      placeholder={t('Ví dụ: Thẻ chi tiêu hằng ngày')}/><Field label={t('4 số cuối *')} value={form.lastFour}
                                                               onChangeText={value => field('lastFour', value.replace(/\D/g, '').slice(0, 4))}
                                                               keyboardType="number-pad"/><Field
      label={t('Hạn mức chung *')} value={form.creditLimit}
      onChangeText={value => field('creditLimit', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"/><Row><View
      style={{flex: 1}}><Field label={t('Ngày chốt sao kê')} value={form.statementDay}
                               onChangeText={value => field('statementDay', value.replace(/\D/g, '').slice(0, 2))}
                               keyboardType="number-pad"/></View><View style={{flex: 1}}><Field
      label={t('Ngày đến hạn')} value={form.dueDay}
      onChangeText={value => field('dueDay', value.replace(/\D/g, '').slice(0, 2))}
      keyboardType="number-pad"/></View></Row>{editing ? <><T size={12} color={c.muted}>{t('Trạng thái')}</T><Chips
      value={form.status} onChange={value => field('status', value)}
      values={[{value: 'ACTIVE', label: t('Hoạt động')}, {
        value: 'INACTIVE',
        label: t('Không hoạt động')
      }, {value: 'CLOSED', label: t('Đã đóng')}]}/></> : null}<Field label={t('Ghi chú')} value={form.note}
                                                                     onChangeText={value => field('note', value)}
                                                                     multiline/></Card><Info>{t('Chỉ lưu 4 số cuối; không nhập số thẻ đầy đủ, CVV hoặc mật khẩu.')}</Info>{dialog}
  </Screen>;
}

export function BillingCycleEditor({id}: { id: string }) {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const cardId = Number(id);
  const [card, setCard] = useState<CreditCardResponse | null>(null);
  const [balance, setBalance] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'UNPAID' | 'PAID'>('UNPAID');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.getCard(cardId).then(value => {
      setCard(value);
      setBalance(value.statementBalance == null ? '' : String(value.statementBalance));
      setMinimumPayment(value.minimumPayment == null ? '' : String(value.minimumPayment));
      setPaymentStatus(value.billingStatus === 'PAID' ? 'PAID' : 'UNPAID');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [cardId, t]);

  async function save() {
    const statementBalance = Number(balance);
    const minimum = Number(minimumPayment);
    if (!card || !Number.isFinite(statementBalance) || statementBalance < 0 || !Number.isFinite(minimum) || minimum < 0 || (statementBalance > 0 && minimum <= 0) || minimum > statementBalance) {
      setError(t('Nhập dư nợ hợp lệ; thanh toán tối thiểu phải lớn hơn 0 và không vượt dư nợ.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.updateBillingCycle(card.id, {
        billingCycleId: card.billingCycleId,
        statementBalance,
        minimumPayment: minimum,
        paymentStatus,
        version: card.billingVersion
      });
      router.back();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title={t('Cập nhật kỳ sao kê')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={t('Cập nhật kỳ sao kê')}
                 subtitle={card ? `${card.nickname} · ${card.bankName}` : t('Kỳ sao kê của thẻ')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={t('Lưu kỳ sao kê')} icon="checkmark-circle-outline" onPress={save}
                                             loading={saving}/></View></Row>}>
    {error ? <Info tone="error">{error}</Info> : null}{card ? <><Card tint><Row><View style={{flex: 1}}><T size={11}
                                                                                                           color={c.primary}>{t('TRẠNG THÁI KỲ SAO KÊ')}</T><T
      size={22}
      bold>{card.billingStatus === 'PAID' ? t('Đã thanh toán') : card.billingStatus === 'OVERDUE' ? t('Quá hạn') : card.billingStatus === 'NEEDS_INPUT' ? t('Cần nhập số tiền') : card.billingStatus === 'NOT_DUE' ? t('Chưa đến ngày chốt') : t('Chưa thanh toán')}</T></View><Badge>{card.currency}</Badge></Row><Row><View
      style={{flex: 1}}><T size={10} color={c.muted}>{t('Ngày chốt')}</T><T
      size={12}>{card.statementDate || '—'}</T></View><View style={{flex: 1}}><T size={10}
                                                                                 color={c.muted}>{t('Ngày đến hạn')}</T><T
      size={12}>{card.paymentDueDate || '—'}</T></View></Row></Card><Card><Field label={t('Dư nợ sao kê *')}
                                                                                 value={balance}
                                                                                 onChangeText={value => setBalance(value.replace(/[^0-9.]/g, ''))}
                                                                                 keyboardType="decimal-pad"/><Field
      label={t('Thanh toán tối thiểu *')} value={minimumPayment}
      onChangeText={value => setMinimumPayment(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"/><T size={12}
                                                                                                              color={c.muted}>{t('Trạng thái thanh toán')}</T><Chips
      value={paymentStatus} onChange={value => setPaymentStatus(value as 'UNPAID' | 'PAID')}
      values={[{value: 'UNPAID', label: t('Chưa thanh toán')}, {
        value: 'PAID',
        label: t('Đã thanh toán')
      }]}/><Info>{paymentStatus === 'PAID' ? t('Đánh dấu đã thanh toán sẽ ghi nhận một khoản thanh toán toàn bộ trong sổ Kira Bank.') : t('Việc cập nhật chỉ thay đổi sổ theo dõi Kira Bank, không chuyển tiền tại ngân hàng.')}</Info></Card></> :
    <Empty title={t('Không tìm thấy thẻ')}/>}
  </Screen>;
}
