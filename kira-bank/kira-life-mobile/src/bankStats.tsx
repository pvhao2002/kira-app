import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, Share, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {dateLabel, money} from './data';
import {BankBalanceAdjustmentResponse, BankDashboard, BankDebt, bankErrorMessage, useBankApi} from './bankApi';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, Field, go, Icon, Info, Metric, Row, Screen, Section, T} from './ui';

function BankRow({bank}: { bank: BankDebt }) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Card><Row><View style={{flex: 1}}><T size={15} bold>{bank.bankName}</T><T size={10}
                                                                                    color={c.muted}>{t('{{n}} thẻ đang quản lý', {n: bank.cardCount})}</T></View><Badge>{bank.utilizationRate.toFixed(1)}%</Badge></Row><Row><Metric
    label={t('HẠN MỨC CHUNG')} value={money(bank.totalCreditLimit, bank.currency, lang)} color={c.text}/><Metric
    label={t('DƯ NỢ HIỆN TẠI')} value={money(bank.currentBalance, bank.currency, lang)}/></Row><Row><Metric
    label={t('DƯ NỢ SAO KÊ')} value={money(bank.statementDebt, bank.currency, lang)}/><Metric label={t('CÒN KHẢ DỤNG')}
                                                                                              value={money(bank.availableCredit, bank.currency, lang)}
                                                                                              color={c.success}/></Row><View
    style={{gap: 7}}><Row><T size={10} color={c.muted} style={{flex: 1}}>{t('Mức sử dụng hạn mức')}</T><T size={10}
                                                                                                          color={bank.utilizationRate >= 80 ? c.error : c.primary}
                                                                                                          bold>{bank.utilizationRate.toFixed(1)}%</T></Row><View
    style={{height: 7, backgroundColor: c.elevated, borderRadius: 8, overflow: 'hidden'}}><View style={{
    width: `${Math.min(100, Math.max(0, bank.utilizationRate))}%`,
    height: 7,
    backgroundColor: bank.utilizationRate >= 80 ? c.error : c.primary
  }}/></View></View>{bank.cards.map(card => <Pressable key={card.id} accessibilityRole="button"
                                                       onPress={() => go('card-edit', {id: String(card.id)})} style={{
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: c.border
  }}><Row><Icon name="card-outline" size={16} color={c.primary}/><View style={{flex: 1}}><T size={11}
                                                                                            bold>{card.nickname}</T><T
    size={10} color={c.muted}>•••• {card.lastFour} · {card.status}</T></View><T size={11}
                                                                                color={c.primary}>{money(card.statementDebt, card.currency, lang)}</T></Row></Pressable>)}<Button
    label={t('Điều chỉnh số dư ngân hàng')} kind="secondary" icon="options-outline"
    onPress={() => go('bank-balance', {id: String(bank.bankId)})}/></Card>;
}

function DebtTrend({trend, months, onMonthsChange}: {
  trend: BankDashboard['trend'];
  months: 3 | 6 | 12;
  onMonthsChange: (months: 3 | 6 | 12) => void
}) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const currencies = [...new Set(trend.map(item => item.currency))];
  if (!trend.length) return null;
  return <Card><Section title={t('Xu hướng sao kê')}/><T size={10}
                                                         color={c.muted}>{t('Dư nợ sao kê theo tháng')}</T><Chips
    value={String(months)} onChange={value => onMonthsChange(Number(value) as 3 | 6 | 12)}
    values={[{value: '3', label: t('3 tháng')}, {value: '6', label: t('6 tháng')}, {
      value: '12',
      label: t('12 tháng')
    }]}/>{currencies.map(currency => {
    const items = trend.filter(item => item.currency === currency);
    const max = Math.max(1, ...items.map(item => item.statementDebt));
    return <View key={currency} style={{gap: 8, paddingTop: 10}}><T size={12} bold>{currency}</T>{items.map(item =>
      <View key={`${currency}-${item.month}`} style={{gap: 4}}><Row><T size={10} color={c.muted}
                                                                       style={{flex: 1}}>{item.month}</T><T size={10}
                                                                                                            color={c.primary}
                                                                                                            bold>{money(item.statementDebt, currency, lang)}</T></Row><View
        style={{height: 8, backgroundColor: c.elevated, borderRadius: 8, overflow: 'hidden'}}><View style={{
        width: `${Math.min(100, Math.max(0, item.statementDebt / max * 100))}%`,
        height: 8,
        backgroundColor: c.primary
      }}/></View><T size={9}
                    color={c.muted}>{t('Dư nợ còn lại')}: {money(item.remainingDebt, currency, lang)}</T></View>)}
    </View>;
  })}</Card>;
}

export function BankStats() {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [dashboard, setDashboard] = useState<BankDashboard | null>(null);
  const [selected, setSelected] = useState('all');
  const [trendMonths, setTrendMonths] = useState<3 | 6 | 12>(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api.dashboard(trendMonths).then(result => {
      setDashboard(result);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t, trendMonths]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  const banks = dashboard?.banks || [];
  const shown = selected === 'all' ? banks : banks.filter(bank => String(bank.bankId) === selected);

  async function shareCsv() {
    if (!shown.length) {
      setError(t('Không có ngân hàng để xuất.'));
      return;
    }
    const header = ['bank_id', 'bank_name', 'card_count', 'currency', 'credit_limit', 'statement_debt', 'current_balance', 'available_credit', 'utilization_rate'];
    const lines = shown.map(bank => [bank.bankId, bank.bankName, bank.cardCount, bank.currency, bank.totalCreditLimit, bank.statementDebt, bank.currentBalance, bank.availableCredit, bank.utilizationRate].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
    try {
      await Share.share({title: t('Xuất thống kê ngân hàng'), message: [header.join(','), ...lines].join('\n')});
    } catch {
      setError(t('Không thể chia sẻ dữ liệu trên thiết bị này.'));
    }
  }

  if (loading && !dashboard) return <Screen title={t('Thống kê ngân hàng')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={t('Thống kê ngân hàng')} subtitle={t('Tổng hợp hạn mức, dư nợ và khả dụng theo từng ngân hàng')}
                 back>
    {error ? <Info tone="error">{error}</Info> : null}
    {!dashboard ?
      <Empty title={t('Chưa có dữ liệu ngân hàng')} description={t('Hãy thêm thẻ thật để bắt đầu theo dõi thống kê.')}
             action={t('Quản lý thẻ')} onPress={() => go('cards-manage')}/> : <>
        <Card tint><Row><View style={{flex: 1}}><T size={11} color={c.primary}>{t('TỔNG QUAN TÍN DỤNG')}</T><T size={28}
                                                                                                               bold>{money(dashboard.currentBalance, dashboard.currency, lang)}</T><T
          size={10} color={c.muted}>{t('Dư nợ hiện tại của toàn bộ ngân hàng')}</T></View><Badge
          tone={dashboard.utilizationRate >= 80 ? 'error' : 'success'}>{dashboard.utilizationRate.toFixed(1)}%</Badge></Row><Row><Metric
          label={t('TỔNG HẠN MỨC')} value={money(dashboard.totalCreditLimit, dashboard.currency, lang)} color={c.text}/><Metric
          label={t('CÒN KHẢ DỤNG')} value={money(dashboard.availableCredit, dashboard.currency, lang)}
          color={c.success}/></Row><Row><Metric label={t('DƯ NỢ SAO KÊ')}
                                                value={money(dashboard.totalStatementDebt, dashboard.currency, lang)}/><Metric
          label={t('NGÂN HÀNG / THẺ')}
          value={`${banks.length} / ${banks.reduce((sum, bank) => sum + bank.cardCount, 0)}`}/></Row><Info>{t('Số liệu được tính theo cấp ngân hàng để không nhân đôi hạn mức chung khi một ngân hàng có nhiều thẻ.')}</Info></Card>
        <DebtTrend trend={dashboard.trend || []} months={trendMonths} onMonthsChange={setTrendMonths}/>
        <Section title={t('LỌC THEO NGÂN HÀNG')}/><Chips value={selected} onChange={setSelected} values={[{
        value: 'all',
        label: t('Tất cả')
      }, ...banks.map(bank => ({value: String(bank.bankId), label: bank.bankName}))]}/><Button
        label={t('Chia sẻ CSV ngân hàng')} kind="secondary" icon="download-outline" onPress={shareCsv}
        disabled={!shown.length}/>
        {shown.length ? shown.map(bank => <BankRow key={bank.bankId} bank={bank}/>) :
          <Empty title={t('Chưa có ngân hàng')}
                 description={t('Chưa có thẻ hoặc hạn mức được quản lý trên tài khoản này.')}/>}
        <Button label={t('Quản lý thẻ')} icon="card-outline" onPress={() => go('cards-manage')}/>
      </>}
  </Screen>;
}

export function BankBalanceHistory({id}: { id: string }) {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const bankId = Number(id);
  const [history, setHistory] = useState<BankBalanceAdjustmentResponse[]>([]);
  const [bankName, setBankName] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.listBankBalanceHistory(bankId), api.dashboard()]).then(([items, dashboard]) => {
      setHistory(items);
      const bank = dashboard.banks.find(item => item.bankId === bankId);
      setBankName(bank?.bankName || t('Ngân hàng'));
      setCurrency(bank?.currency || items[0]?.currency || 'VND');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [bankId, t]);
  return <Screen title={t('Lịch sử điều chỉnh số dư')} subtitle={bankName || t('Ngân hàng')} back>{error ?
    <Info tone="error">{error}</Info> : null}{loading ?
    <ActivityIndicator color={c.primary}/> : history.length ? history.map(item => <Card key={item.id}><Row><View
        style={{flex: 1}}><T size={13} bold>{t('Phiên bản số dư #{{n}}', {n: item.balanceVersion})}</T><T size={10}
                                                                                                          color={c.muted}>{dateLabel(item.createdAt)}</T></View><Badge
        tone={item.adjustmentAmount >= 0 ? 'success' : 'warning'}>{item.adjustmentAmount >= 0 ? '+' : ''}{money(item.adjustmentAmount, currency, lang)}</Badge></Row><Row><Metric
        label={t('TRƯỚC ĐIỀU CHỈNH')} value={money(item.previousBalance, currency, lang)} color={c.muted}/><Metric
        label={t('SAU ĐIỀU CHỈNH')} value={money(item.newBalance, currency, lang)} color={c.primary}/></Row><T size={10}
                                                                                                               color={c.muted}>{t('Lý do')}: {item.reason}</T></Card>) :
      <Empty title={t('Chưa có lịch sử điều chỉnh')}
             description={t('Các lần thay đổi số dư sẽ xuất hiện ở đây.')}/>}<Info>{t('Lịch sử là append-only; mỗi bản ghi gắn với một version số dư riêng.')}</Info></Screen>;
}

export function BankBalanceEditor({id}: { id: string }) {
  const api = useBankApi();
  const t = useT();
  const {colors: c} = useTheme();
  const bankId = Number(id);
  const [bank, setBank] = useState<BankDebt | null>(null);
  const [balance, setBalance] = useState('');
  const [reason, setReason] = useState('');
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.dashboard().then(result => {
      const found = result.banks.find(item => item.bankId === bankId);
      if (found) {
        setBank(found);
        setBalance(String(found.currentBalance));
        setVersion(found.balanceVersion);
      } else setError(t('Không tìm thấy ngân hàng.'));
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [bankId, t]);

  async function save() {
    const amount = Number(balance);
    if (!bank || !Number.isFinite(amount) || amount < 0 || !reason.trim()) {
      setError(t('Nhập số dư không âm và lý do điều chỉnh.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.updateBankBalance(bank.bankId, amount, reason.trim(), version);
      router.back();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title={t('Điều chỉnh số dư')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={t('Điều chỉnh số dư')} subtitle={bank?.bankName || t('Ngân hàng')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={t('Lưu điều chỉnh')} icon="checkmark-circle-outline" onPress={save}
                                             loading={saving}/></View></Row>}>
    {error ? <Info tone="error">{error}</Info> : null}{bank ? <><Card tint><T size={11}
                                                                              color={c.primary}>{t('SỐ DƯ CẤP NGÂN HÀNG')}</T><T
    size={21} bold>{money(bank.currentBalance, bank.currency)}</T><T size={10}
                                                                     color={c.muted}>{t('Phiên bản số dư hiện tại')}: {version}</T><Field
    label={t('Số dư mới')} value={balance} onChangeText={value => setBalance(value.replace(/[^0-9.]/g, ''))}
    keyboardType="decimal-pad"/><Field label={t('Lý do bắt buộc')} value={reason} onChangeText={setReason}
                                       placeholder={t('Ví dụ: Đối soát sao kê tháng này')}
                                       multiline/><Info>{t('Điều chỉnh được lưu thành lịch sử bất biến và không làm thay đổi hạn mức tín dụng.')}</Info></Card><Button
    label={t('Xem lịch sử điều chỉnh')} kind="secondary" icon="time-outline"
    onPress={() => go('bank-balance-history', {id})}/></> : <Empty title={t('Không tìm thấy ngân hàng')}/>}
  </Screen>;
}
