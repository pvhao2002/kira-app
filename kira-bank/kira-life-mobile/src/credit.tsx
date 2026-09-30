import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Image, Modal, Pressable, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useFocusEffect} from 'expo-router';
import {banks, cards, money} from './data';
import {BankDashboard, bankErrorMessage, CreditCardResponse, useBankApi} from './bankApi';
import {StatementsPreview} from './statements';
import {Allocation, Gauge, TrendChart} from './charts';
import {useTheme} from './theme';
import {useAuth} from './auth';
import {useDemo} from './store';
import {useLanguage, useT} from './i18n';
import {
  Badge,
  Button,
  Card,
  Chips,
  Dialog,
  Empty,
  Field,
  FitValue,
  go,
  Icon,
  Info,
  Metric,
  Progress,
  Row,
  Screen,
  Section,
  T,
  useNotice
} from './ui';

export function BankCard({bank}: { bank: typeof banks[number] }) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Card><Row><View style={{
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: bank.color + '22',
    justifyContent: 'center',
    alignItems: 'center'
  }}><T size={12} bold color={bank.color}>{bank.short}</T></View><View style={{flex: 1}}><T bold>{bank.name}</T><T
    size={10} color={c.muted}>{t('{{n}} thẻ ({{names}})', {
    n: bank.cards,
    names: bank.id === 'tcb' ? 'Signature, Everyday' : bank.id === 'vpb' ? 'StepUp Mastercard' : 'Cash Back'
  })}</T></View><Badge>{(bank.debt / bank.limit * 100).toFixed(1)}%</Badge></Row><Row><Metric label={t('HẠN MỨC CHUNG')}
                                                                                              value={money(bank.limit, undefined, lang)}
                                                                                              color={c.text}/><Metric
    label={t('DƯ NỢ HIỆN TẠI')} value={money(bank.debt, undefined, lang)}/></Row><Progress
    value={bank.debt / bank.limit * 100} color={bank.color}/></Card>;
}

function PlasticCard({card}: { card: typeof cards[number] }) {
  const bank = banks.find(b => b.id === card.bank)!;
  const t = useT();
  const {colors: c} = useTheme();
  return <LinearGradient
    colors={card.bank === 'vpb' ? ['#0a2324', '#10383b', '#1e5358'] : card.bank === 'vib' ? ['#1b1c38', '#24264f', '#342e61'] : ['#0a192f', '#0f2744', '#1a3a5c']}
    style={{padding: 16, borderRadius: 16, gap: 12}}>
    <Row style={{gap: 4}}><T size={10} style={{flex: 1}}>{bank.name.toUpperCase()} <T size={8}
                                                                                      color={c.muted}> | {card.name.toUpperCase()}</T></T><T
      size={8} color={c.primary}>• {t('Đang hoạt động')}</T></Row><Row style={{justifyContent: 'space-between'}}><View
    style={{
      width: 27,
      height: 23,
      borderRadius: 5,
      backgroundColor: '#f6d267',
      borderWidth: 2,
      borderColor: '#dab552'
    }}/><Icon name="wifi-outline" size={16}/></Row><T size={15} style={{letterSpacing: 2}}>•••• ••••
    •••• {card.id}</T><Row style={{justifyContent: 'space-between', gap: 4}}><T size={7}>NGUYEN HOANG HAI
    • {card.expiry}</T><T size={13} bold
                          color={c.primary}>{card.id === '4190' || card.bank === 'vpb' ? '●●' : 'VISA'}</T></Row>
  </LinearGradient>;
}

function BankOverviewCard() {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [dashboard, setDashboard] = useState<BankDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api.dashboard().then(value => {
      setDashboard(value);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  if (loading && !dashboard) return <Card><ActivityIndicator color={c.primary}/></Card>;
  if (error && !dashboard) return <Card><Info tone="error">{error}</Info><Button label={t('Thử lại')} kind="secondary"
                                                                                 onPress={load}/></Card>;
  if (!dashboard) return null;
  return <Card tint style={{gap: 12}}><Row><View style={{flex: 1}}><T size={11}
                                                                      color={c.primary}>{t('THỐNG KÊ TÍN DỤNG API')}</T><T
    size={26} bold>{money(dashboard.currentBalance, dashboard.currency, lang)}</T><T size={10}
                                                                                     color={c.muted}>{t('Dư nợ hiện tại của toàn bộ ngân hàng')}</T></View><Badge
    tone={dashboard.utilizationRate >= 80 ? 'error' : 'success'}>{dashboard.utilizationRate.toFixed(1)}%</Badge></Row><Row><Metric
    label={t('CÒN KHẢ DỤNG')} value={money(dashboard.availableCredit, dashboard.currency, lang)}
    color={c.success}/><Metric label={t('TỔNG HẠN MỨC')}
                               value={money(dashboard.totalCreditLimit, dashboard.currency, lang)}
                               color={c.text}/></Row><Row><T size={10} color={c.muted}
                                                             style={{flex: 1}}>{t('{{n}} ngân hàng · {{m}} thẻ', {
    n: dashboard.banks.length,
    m: dashboard.banks.reduce((sum, bank) => sum + bank.cardCount, 0)
  })}</T><Pressable accessibilityRole="button" onPress={() => go('credit-stats')}><T size={11}
                                                                                     color={c.primary}>{t('Chi tiết')} ›</T></Pressable></Row></Card>;
}

function ManagedCardsPreview() {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [managedCards, setManagedCards] = useState<CreditCardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api.listCards('', 0, 4).then(result => {
      setManagedCards(result.data);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  return <><Section title={t('Thẻ đã quản lý')} action={t('Xem tất cả')} onPress={() => go('cards')}/>{loading ?
    <Card><ActivityIndicator color={c.primary}/></Card> : error ?
      <Card><Info tone="error">{error}</Info><Button label={t('Thử lại')} kind="secondary"
                                                     onPress={load}/></Card> : managedCards.length ? managedCards.slice(0, 3).map(card =>
          <Pressable key={card.id} accessibilityRole="button"
                     onPress={() => go('card-edit', {id: String(card.id)})}><Card><Row><View style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: c.primary + '22',
            alignItems: 'center',
            justifyContent: 'center'
          }}><Icon name="card-outline" size={19}/></View><View style={{flex: 1}}><T size={13} bold>{card.nickname}</T><T
            size={10} color={c.muted}>{card.bankName} · •••• {card.lastFour}</T></View><Badge
            tone={card.status === 'ACTIVE' ? 'success' : card.status === 'CLOSED' ? 'error' : 'warning'}>{t(card.status === 'ACTIVE' ? 'Hoạt động' : card.status === 'CLOSED' ? 'Đã đóng' : 'Không hoạt động')}</Badge></Row><Row><Metric
            label={t('Hạn mức')} value={money(card.creditLimit, card.currency, lang)} color={c.text}/><Metric
            label={t('Dư nợ hiện tại')}
            value={money(card.currentBalance, card.currency, lang)}/></Row></Card></Pressable>) :
        <Card><T size={11} color={c.muted}>{t('Chưa có thẻ thật')}</T><T size={11}
                                                                         color={c.muted}>{t('Thêm thẻ để bắt đầu theo dõi hạn mức và sao kê.')}</T><Button
          label={t('Thêm thẻ')} kind="secondary" onPress={() => go('card-add')}/></Card>}
  </>;
}

export function Dashboard() {
  const {dialog} = useNotice();
  const t = useT();
  const {colors: c} = useTheme();
  const {session} = useAuth();
  const name = session?.user.fullName?.trim() || t('bạn');
  return <Screen title={t('Thẻ tín dụng')}>
    <Row><View style={{flex: 1, gap: 2}}><T size={11} color={c.primary}>• {t('HỒ SƠ TÀI CHÍNH ĐỒNG BỘ')}</T><T size={20}
                                                                                                               bold>{t('Chào buổi sáng, {{name}}', {name})}</T><T
      size={11} color={c.muted}>{t('Thống kê được đồng bộ từ tài khoản Kira Bank')}</T></View><Icon
      name="shield-checkmark-outline"/></Row>
    <BankOverviewCard/>
    <Section title={t('Tác vụ nhanh')} action={t('4 phím tắt')} onPress={() => go('cards')}/><Row
    style={{alignItems: 'stretch', gap: 10}}>{([{
    label: t('Thẻ của tôi'),
    icon: 'card-outline',
    target: 'cards'
  }, {label: t('Ưu đãi & Hoàn tiền'), icon: 'gift-outline', target: 'benefits'}, {
    label: t('Nên quẹt thẻ nào'),
    icon: 'sparkles-outline',
    target: 'card-recommend'
  }, {
    label: t('Điều chỉnh số dư'),
    icon: 'options-outline',
    target: 'credit-stats'
  }] as const).map(item => <Pressable key={item.label} accessibilityRole="button" onPress={() => go(item.target)}
                                      style={{
                                        flex: 1,
                                        minHeight: 96,
                                        padding: 12,
                                        backgroundColor: c.surface,
                                        borderRadius: 24,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                      }}><View style={{
    width: 40,
    height: 40,
    backgroundColor: c.elevated,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  }}><Icon name={item.icon} color={item.target === 'benefits' ? c.lavender : c.primary} size={20}/></View><T size={11}
                                                                                                             style={{textAlign: 'center'}}>{item.label}</T></Pressable>)}</Row>
    <StatementsPreview/>
    <Section title={t('Hạn mức theo Ngân hàng')} action={t('Xem thống kê')} onPress={() => go('credit-stats')}/>
    <ManagedCardsPreview/>{dialog}
  </Screen>;
}

export function MyCards() {
  const {state, update} = useDemo();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [freeze, setFreeze] = useState('');
  const [adjust, setAdjust] = useState('');
  const [limit, setLimit] = useState('');
  const [debt, setDebt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const {notify, dialog} = useNotice();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const overrides = state.creditConfig?.banks || {};
  const [adjustCard, setAdjustCard] = useState('');
  const shown = cards.filter(card => (filter === 'all' || filter === 'active' && !state.frozenCards.includes(card.id) || filter === 'frozen' && state.frozenCards.includes(card.id) || filter === card.bank) && `${card.name} ${card.id} ${banks.find(b => b.id === card.bank)?.name}`.toLowerCase().includes(query.toLowerCase()));
  return <Screen title={t('Thẻ của tôi')} back><Row><View style={{flex: 1}}><Field label={t('Tìm thẻ')}
                                                                                   placeholder={t('Tên thẻ, số thẻ, ngân hàng')}
                                                                                   value={query}
                                                                                   onChangeText={setQuery}/></View><Button
    label={t('Thêm thẻ')} icon="add"
    onPress={() => notify(t('Thêm thẻ được mô phỏng. Không liên kết thẻ thật.'))}/></Row><Chips values={[{
    label: t('Tất cả (4)'),
    value: 'all'
  }, {
    label: t('Đang hoạt động ({{n}})', {n: 4 - state.frozenCards.length}),
    value: 'active'
  }, {
    label: t('Đã tạm khóa ({{n}})', {n: state.frozenCards.length}),
    value: 'frozen'
  }, ...banks.map(b => ({label: b.name, value: b.id}))]} value={filter} onChange={setFilter}/>
    <Card tint><Row><Icon name="card-outline" size={18}/><T size={11} style={{flex: 1}}>{t('Tổng hạn mức khả dụng')}</T><Badge>{t('3 Ngân Hàng')}</Badge></Row><T
      size={26}
      bold>{money(banks.reduce((n, b) => n + (overrides[b.id]?.limit ?? b.limit) - (overrides[b.id]?.debt ?? b.debt), 0), undefined, lang)}</T><T
      size={10} color={c.muted}>{t('Tổng dư nợ hiện tại: {{debt}} • Hạn mức gộp {{limit}}', {
      debt: money(banks.reduce((n, b) => n + (overrides[b.id]?.debt ?? b.debt), 0), undefined, lang),
      limit: money(banks.reduce((n, b) => n + (overrides[b.id]?.limit ?? b.limit), 0), undefined, lang)
    })}</T></Card>
    {!shown.length ?
      <Empty title={t('Không tìm thấy thẻ')}/> : banks.filter(b => shown.some(card => card.bank === b.id)).map(b =>
        <View key={b.id} style={{gap: 12}}><Card style={{padding: 12}}><Row><Badge>{b.short}</Badge><View
          style={{flex: 1}}><T size={13} bold>{b.name} <T size={10}
                                                          color={c.muted}>{t('{{n}} Thẻ', {n: b.cards})}</T></T><T
          size={9} color={c.muted}>{t('Hạn mức chung: {{limit}} • Nợ: {{debt}}', {
          limit: money(overrides[b.id]?.limit ?? b.limit, undefined, lang),
          debt: money(overrides[b.id]?.debt ?? b.debt, undefined, lang)
        })}</T></View><Pressable accessibilityRole="button"
                                 accessibilityLabel={t('Điều chỉnh {{name}}', {name: b.name})} onPress={() => {
          setAdjustCard('');
          setAdjust(b.id);
          setLimit(String(overrides[b.id]?.limit ?? b.limit));
          setDebt(String(overrides[b.id]?.debt ?? b.debt));
          setError('');
        }} style={{padding: 10}}><Icon name="pencil-outline"
                                       size={16}/></Pressable></Row></Card>{shown.filter(card => card.bank === b.id).map(card =>
          <Card key={card.id} style={{padding: 12, gap: 12}}><PlasticCard
            card={card}/>{state.frozenCards.includes(card.id) ? <Badge tone="warning">{t('Đã tạm khóa')}</Badge> : null}<Row><View
            style={{flex: 1}}><T size={9} color={c.muted}>{t('Hạn mức riêng')}</T><T size={12}
                                                                                     bold>{money(state.creditConfig?.cards[card.id] ?? (card.id === '8829' ? 100000000 : 50000000), undefined, lang)}</T></View><View
            style={{flex: 1}}><T size={9} color={c.muted}>{t('Dư nợ hiện tại')}</T><T size={12} bold
                                                                                      color={c.primary}>{money(card.debt, undefined, lang)}</T></View></Row><Row
            style={{gap: 6}}>{[{
            label: t('Hạn mức'), icon: 'options-outline' as const, run: () => {
              setAdjustCard(card.id);
              setAdjust(b.id);
              setLimit(String(state.creditConfig?.cards[card.id] ?? (card.id === '8829' ? 100000000 : 50000000)));
              setDebt(String(b.debt));
              setReason('Điều chỉnh hạn mức thẻ');
              setError('');
            }
          }, {
            label: t('Lịch sử'),
            icon: 'time-outline' as const,
            run: () => notify((state.creditConfig?.audit.filter(a => a.target === card.id || a.target === b.id).map(a => `${a.date} • ${t(a.reason)}`).join('\n') || t('Đồng bộ sao kê +12.450.000 đ; Thanh toán dư nợ −20.000.000 đ; Hoàn tiền Shopee −650.000 đ.')))
          }, {
            label: state.frozenCards.includes(card.id) ? t('Mở khóa') : t('Tạm khóa'),
            icon: 'lock-closed-outline' as const,
            run: () => setFreeze(card.id)
          }].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.run} style={{
            flex: 1,
            flexDirection: 'row',
            gap: 4,
            minHeight: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.elevated
          }}><Icon name={item.icon} size={12}/><T size={9}>{item.label}</T></Pressable>)}</Row></Card>)}</View>)}
    <Info>{t('Bảo mật chuẩn mã hóa Glacier 256-bit • Kira Safeguard')}</Info>
    <Modal visible={!!adjust} transparent animationType="fade" onRequestClose={() => setAdjust('')}><View
      style={{flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24}}><Card><T size={20}
                                                                                                  bold>{adjustCard ? t('Điều chỉnh hạn mức thẻ • {{card}}', {card: adjustCard}) : t('Điều chỉnh {{name}}', {name: banks.find(b => b.id === adjust)?.name || ''})}</T><Field
      label={adjustCard ? t('Hạn mức thẻ riêng biệt (VND)') : t('Hạn mức chung cấp ngân hàng')} value={limit}
      onChangeText={setLimit} keyboardType="numeric"/>{!adjustCard ?
      <Field label={t('Dư nợ thực tế cần đồng bộ')} value={debt} onChangeText={setDebt} keyboardType="numeric"/> : null}<Field
      label={t('Lý do điều chỉnh')} value={reason} onChangeText={setReason}/>{error ?
      <T color={c.error}>{error}</T> : null}<Button label={t('Lưu thay đổi')} onPress={() => {
      if (!Number.isFinite(Number(limit)) || !Number.isFinite(Number(debt)) || Number(limit) <= 0 || Number(debt) < 0 || !reason.trim()) {
        setError(t('Nhập hạn mức hợp lệ, dư nợ không âm và lý do.'));
        return;
      }
      if (adjustCard && Number(limit) > (overrides[adjust]?.limit ?? banks.find(b => b.id === adjust)!.limit)) {
        setError(t('Hạn mức riêng không được vượt hạn mức chung của ngân hàng.'));
        return;
      }
      update(s => {
        const config = s.creditConfig || {banks: {}, cards: {}, audit: []};
        return {
          ...s,
          creditConfig: {
            banks: adjustCard ? config.banks : {
              ...config.banks,
              [adjust]: {limit: Number(limit), debt: Number(debt)}
            },
            cards: adjustCard ? {...config.cards, [adjustCard]: Number(limit)} : config.cards,
            audit: [...config.audit, {
              target: adjustCard || adjust,
              reason: reason.trim(),
              date: new Date().toISOString()
            }]
          }
        };
      });
      setAdjust('');
      notify(t('Đã lưu điều chỉnh trên thiết bị.'));
    }}/><Button label={t('Hủy')} kind="secondary" onPress={() => setAdjust('')}/></Card></View></Modal>
    <Dialog visible={!!freeze} title={t('Thay đổi trạng thái thẻ?')}
            message={t('Thao tác cập nhật trạng thái thẻ mẫu trên thiết bị.')} onClose={() => setFreeze('')}
            onConfirm={() => {
              update(s => ({
                ...s,
                frozenCards: s.frozenCards.includes(freeze) ? s.frozenCards.filter(id => id !== freeze) : [...s.frozenCards, freeze]
              }));
              setFreeze('');
            }}/>{dialog}
  </Screen>;
}

export function Benefits() {
  const {state, update} = useDemo();
  const [cap, setCap] = useState(String(state.cashbackCap));
  const [mcc, setMcc] = useState('');
  const [error, setError] = useState('');
  const [editingCap, setEditingCap] = useState(false);
  const {notify, dialog} = useNotice();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();

  function save() {
    const n = Number(cap);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t('Nhập hạn mức hoàn tiền lớn hơn 0.'));
      return;
    }
    update(s => ({...s, cashbackCap: n}));
    setError('');
    notify(t('Đã lưu cấu hình hoàn tiền mẫu.'));
  }

  const categories = [{
    name: t('Ẩm thực & Nhà hàng'),
    rate: '15%',
    cap: 300000,
    icon: 'restaurant-outline' as const,
    codes: state.mcc
  }, {
    name: t('Mua sắm Online & TMĐT'),
    rate: '10%',
    cap: 300000,
    icon: 'bag-handle-outline' as const,
    codes: ['5311', '5999']
  }, {name: t('Bảo hiểm & Y tế'), rate: '6%', cap: 200000, icon: 'medkit-outline' as const, codes: ['6300', '8099']}];
  const offers: [string, string, string][] = [['Shopee Mall', t('Hoàn 80.000 đ'), t('Đơn từ 400.000 đ vào mỗi Thứ 4 & Chủ Nhật')], ['GrabFood / Car', t('Giảm 25%'), t('Tối đa 50.000 đ cho chuyến xe hoặc đặt món')], ['CGV Cinema', t('Mua 1 Tặng 1'), t('Vé 2D tiêu chuẩn vào cuối tuần')], ['Starbucks', t('Nâng size miễn phí'), t('Áp dụng mọi hóa đơn đồ uống nguyên giá')]];
  return <Screen title={t('Ưu đãi & hoàn tiền')} back><Card style={{padding: 12}}><Row><Icon name="card-outline"/><View
    style={{flex: 1}}><T size={11} color={c.muted}>VPBank StepUp <T size={9} color={c.primary}>{t('Đang cấu hình')}</T></T><T
    size={14} bold>Mastercard (•••• 1204)</T></View><Icon name="chevron-down" size={16}/></Row></Card><Card><Row><T
    size={11} color={c.muted} style={{flex: 1}}>{t('HẠN MỨC HOÀN TIỀN THÁNG')}</T><Pressable accessibilityRole="button"
                                                                                             onPress={() => setEditingCap(!editingCap)}
                                                                                             style={{padding: 8}}><T
    size={11} color={c.primary}>☷ {t('Chỉnh sửa')}</T></Pressable></Row><T size={25} bold>640.000 <T size={12}
                                                                                                     color={c.muted}>/ {money(state.cashbackCap, undefined, lang)}</T></T><Row><T
    size={10} color={c.muted}
    style={{flex: 1}}>{t('Đã tích lũy ước tính ({{n}}%)', {n: Math.round(640000 / state.cashbackCap * 100)})}</T><T
    size={10}
    color={c.primary}>{t('Còn {{amount}}', {amount: money(Math.max(0, state.cashbackCap - 640000), undefined, lang)})}</T></Row><Progress
    value={640000 / state.cashbackCap * 100} color={c.lavender}/>{editingCap ?
    <Field label={t('Hạn mức hoàn tiền tháng (VND)')} value={cap} onChangeText={setCap} keyboardType="numeric"
           error={error}/> : null}</Card>
    <Section title={t('Quy tắc danh mục hoàn tiền')}/>{categories.map(g => <Card key={g.name}><Row><Icon name={g.icon}
                                                                                                         color={c.lavender}/><View
      style={{flex: 1}}><T bold>{g.name}</T><T size={12}
                                               color={c.muted}>{t('Trần {{amount}}/tháng', {amount: money(g.cap, undefined, lang)})}</T></View><Badge>{g.rate}</Badge></Row><T
      size={10} color={c.muted}>{t('Mã MCC đã gán:')}</T><Row style={{flexWrap: 'wrap', gap: 6}}>{g.codes.map(code =>
      <Badge key={code}>{code}</Badge>)}</Row></Card>)}
    <Card><T size={12} bold>{t('Thêm nhanh mã MCC')}</T><Field label={t('Các mã MCC, phân tách bằng dấu phẩy')}
                                                               placeholder="5812, 5814, 5462" value={mcc}
                                                               onChangeText={setMcc}/><Button label={t('Thêm mã MCC')}
                                                                                              kind="secondary"
                                                                                              onPress={() => {
                                                                                                const codes = mcc.split(',').map(x => x.trim()).filter(Boolean);
                                                                                                if (!codes.length || codes.some(x => !/^\d{4}$/.test(x))) {
                                                                                                  notify(t('Mỗi MCC phải có đúng 4 chữ số. Có thể thêm nhiều mã bằng dấu phẩy.'));
                                                                                                  return;
                                                                                                }
                                                                                                update(s => ({
                                                                                                  ...s,
                                                                                                  mcc: [...new Set([...s.mcc, ...codes])]
                                                                                                }));
                                                                                                setMcc('');
                                                                                              }}/></Card>
    <Section title={t('Ưu đãi độc quyền liên kết thẻ')}/><View
      style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>{offers.map(([name, offer, note], i) => <View key={name}
                                                                                                              style={{width: '48%'}}><Card
      style={{padding: 12}}><Row style={{gap: 6}}><Image
      source={[require('../assets/reference/offers-0.png'), require('../assets/reference/offers-1.png'), require('../assets/reference/offers-2.png'), require('../assets/reference/offers-3.png')][i]}
      style={{width: 32, height: 32, borderRadius: 16}}/><View style={{flex: 1}}><T size={10} bold>{name}</T><T size={9}
                                                                                                                color={i > 1 ? c.lavender : c.primary}>{offer}</T></View></Row><T
      size={9} color={c.muted}>{note}</T></Card></View>)}</View><Button label={t('Lưu cấu hình quy tắc')}
                                                                        kind="secondary" onPress={save}/><Button
      label={t('Xem lịch sử cập nhật')} kind="secondary"
      onPress={() => notify(t('Cấu hình được lưu cục bộ trên thiết bị.'))}/>{dialog}
  </Screen>;
}

export function CreditStats() {
  const [period, setPeriod] = useState('6T');
  const [card, setCard] = useState('all');
  const {notify, dialog} = useNotice();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const debt = card === 'all' ? 42850000 : card === 'platinum' ? 28400000 : card === 'cashback' ? 9800000 : 4650000;
  const history: [string, string, string][] = [[t('Nâng hạn mức tự động'), t('15/08/2024 • Điểm tín dụng AAA'), '+30.000.000 đ'], [t('Cài đặt hạn mức tháng'), t('01/08/2024 • Người dùng tự điều chỉnh'), '60.000.000 đ']];
  return <Screen title={t('Thống kê hạn mức & dư nợ')} subtitle={t('Phân tích sử dụng vốn tín dụng Kira Bank')} back>
    <Chips value={card} onChange={setCard} values={[{value: 'all', label: t('Tất cả các thẻ (3)')}, {
      value: 'platinum',
      label: 'Kira Platinum Infinite'
    }, {value: 'cashback', label: 'Kira Cashback'}, {value: 'virtual', label: 'Cyber Virtual'}]}/>
    <Card tint><Row><T bold
                       style={{flex: 1}}>{t('Hạn mức & Tỷ lệ sử dụng')}</T><Badge>{t('Điểm CIC: Tối ưu')}</Badge></Row><Row><Gauge
      value={Math.floor(debt / 150000000 * 1000) / 10}/><View style={{flex: 1, gap: 12}}><View><T size={11}
                                                                                                  color={c.muted}>{t('Dư nợ hiện tại (Đã dùng)')}</T><FitValue
      size={21} value={money(debt, undefined, lang)}/></View><View><T size={11}
                                                                      color={c.muted}>{t('Hạn mức khả dụng còn lại')}</T><FitValue
      size={17} color={c.text} value={money(150000000 - debt, undefined, lang)}/></View></View></Row><T size={11}
                                                                                                        color={c.muted}>{t('Tổng hạn mức phê duyệt: 150.000.000 đ')}</T><Progress
      value={debt / 150000000 * 100}/><T size={10} color={c.primary}>0 đ {t('Khuyên dùng: <30%')} 150 Tr</T></Card>
    <Card><T bold>{t('Biến động dư nợ 6 kỳ sao kê')}</T><T size={11} color={c.muted}>{t('So với trần hạn mức 150M')}</T><Chips
      value={period} onChange={setPeriod} values={['3T', '6T', '1N'].map(value => ({label: value, value}))}/><T
      size={12} color={c.primary}>{t('Kỳ T10: 42.85M VND   +18% so với T09')}</T><T size={10}
                                                                                    color={c.muted}>{t('Chi tiêu chạm đỉnh đợt Mega Sale 10.10 & Vé máy bay')}</T><TrendChart
      period={period}/></Card>
    <Card><T bold>{t('Cơ cấu danh mục chi tiêu')}</T><T size={11} color={c.muted}>{t('Tháng 10/2024')}</T><Allocation
      items={[{label: t('Mua sắm & Tiêu dùng'), percent: 42, value: '18.000.000 đ'}, {
        label: t('Du lịch & Đặt vé'),
        percent: 28,
        value: '12.000.000 đ'
      }, {label: t('Ăn uống & Giải trí'), percent: 18, value: '7.700.000 đ'}, {
        label: t('Dịch vụ & Hóa đơn'),
        percent: 12,
        value: '5.150.000 đ'
      }]}/></Card>
    <Card tint><Row><Icon name="calendar-outline"/><T bold
                                                      style={{flex: 1}}>{t('Dự báo chu kỳ sao kê tiếp theo')}</T><Badge>{t('Chốt sau 2 ngày')}</Badge></Row><Row><Metric
      label={t('Ngày chốt sao kê')} value="20/10/2024"/><Metric label={t('Thanh toán tối thiểu')} value="2.142.500 đ"/></Row><T
      size={11}
      color={c.muted}>{t('Đến hạn: 05/11/2024 • 5% tổng dư nợ')}</T><Info>{t('Gợi ý thông minh từ Kira AI: Thanh toán trọn vẹn 42.850.000 đ trước ngày 05/11/2024 để hưởng đặc quyền miễn lãi.')}</Info></Card>
    <Card><Row><Image source={require('../assets/reference/credit-0.png')}
                      style={{width: 80, height: 56, borderRadius: 12}}/><View style={{flex: 1}}><Badge>Platinum
      Extra</Badge><T bold>Kira Lounge Pass</T><T size={10}
                                                  color={c.muted}>{t('Mở khóa 2 phòng chờ VIP hạng thương gia')}</T></View></Row><T
      size={11} color={c.primary}>{t('Chi tiêu thêm 7.15M để kích hoạt kỳ này')}</T></Card>
    <Section title={t('Lịch sử biến động hạn mức')}/>{history.map(([title, date, amount]) => <Card
    key={title}><Row><Icon name="trending-up"/><View style={{flex: 1}}><T size={12} bold>{title}</T><T size={10}
                                                                                                       color={c.muted}>{date}</T></View><T
    size={12} color={c.primary}>{amount}</T></Row></Card>)}
    <Button label={t('Thanh toán dư nợ ngay')} icon="wallet-outline"
            onPress={() => notify(t('Thanh toán được mô phỏng, không chuyển tiền thật.'))}/><Button
    label={t('Yêu cầu nâng hạn mức tín dụng')} kind="secondary"
    onPress={() => notify(t('Đã ghi nhận yêu cầu mẫu.'))}/><T size={10} color={c.muted}
                                                              style={{textAlign: 'center'}}>{t('Bảo vệ bởi Kira Bank Zero-Liability Protection 256-bit')}</T>{dialog}
  </Screen>;
}
