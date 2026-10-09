import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {money} from './data';
import {AdminInvestmentSummary, errorMessage, useInvestmentApi} from './investmentApi';
import {useAuth} from './auth';
import {Stat, Stats} from './analyticsParts';
import {dictionary, useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Button, Card, Chips, Empty, Info, Row, Screen, T} from './ui';

const extra: Record<string, string> = {
  'Tổng hợp đầu tư toàn hệ thống': 'Platform investment summary',
  'Tổng nạp, rút và thưởng đã hoàn tất của toàn hệ thống theo từng loại tiền.': 'Platform-wide completed deposits, withdrawals and bonuses per currency.',
  'Người dùng có giao dịch': 'Users with activity', 'Top người dùng theo khối lượng': 'Top users by volume',
  'Màn hình này chỉ dành cho Admin.': 'This screen is for admins only.',
};
for (const [key, value] of Object.entries(extra)) if (!(key in dictionary)) dictionary[key] = value;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function AdminInvestmentSummaryScreen() {
  const {session} = useAuth();
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [months, setMonths] = useState(12);
  const [currency, setCurrency] = useState('');
  const [data, setData] = useState<AdminInvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const isAdmin = session?.user.roles.includes('ADMIN') ?? false;
  const load = useCallback(() => {
    if (!isAdmin) return;
    const now = new Date();
    const id = ++request.current; // only the latest request may update the screen
    setLoading(true);
    setError('');
    api.getAdminSummary({fromDate: iso(new Date(now.getFullYear(), now.getMonth() - months + 1, 1)), toDate: iso(now)}).then(value => {
      if (id !== request.current) return;
      setData(value);
      setCurrency(current => value.currencies.some(item => item.currency === current) ? current : value.currencies[0]?.currency ?? '');
    }).catch(e => id === request.current && setError(t(errorMessage(e)))).finally(() => id === request.current && setLoading(false));
  }, [months, isAdmin, t]);
  useEffect(load, [load]);
  if (!isAdmin) return <Screen title={t('Tổng hợp đầu tư toàn hệ thống')} back><Empty title={t('Màn hình này chỉ dành cho Admin.')}/></Screen>;
  const selected = data?.currencies.find(item => item.currency === currency) ?? data?.currencies[0];
  const fmt = (value: number) => money(value, selected?.currency ?? 'VND', lang);
  const tone = (value: number) => value < 0 ? c.error : c.success;
  return <Screen title={t('Tổng hợp đầu tư toàn hệ thống')} subtitle={t('Tổng nạp, rút và thưởng đã hoàn tất của toàn hệ thống theo từng loại tiền.')} back>
    <Chips value={String(months)} onChange={value => setMonths(Number(value))} values={[3, 6, 12, 24].map(m => ({value: String(m), label: t(`${m} tháng`)}))}/>
    {data && data.currencies.length > 1 ? <Chips value={selected?.currency ?? ''} onChange={setCurrency} values={data.currencies.map(item => ({value: item.currency, label: item.currency}))}/> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : error ? <Card><Info tone="error">{error}</Info><Button label={t('Thử lại')} kind="secondary" onPress={load}/></Card> :
      !selected ? <Empty title={t('Không có giao dịch hoàn tất trong khoảng này.')}/> : <Card>
        <Stats>
          <Stat label={t('Người dùng có giao dịch')} value={String(selected.totals.users)}/>
          <Stat label={t('Tài khoản hoạt động')} value={String(selected.totals.accounts)}/>
          <Stat label={t('Số giao dịch')} value={String(selected.totals.transactions)}/>
          <Stat label={t('Lãi/lỗ')} value={fmt(selected.totals.net)} color={tone(selected.totals.net)}/>
          <Stat label={t('Nạp')} value={fmt(selected.totals.deposits)}/>
          <Stat label={t('Rút')} value={fmt(selected.totals.withdrawals)}/>
          <Stat label={t('Thưởng')} value={fmt(selected.totals.bonuses)}/>
        </Stats>
        <T size={11} bold>{t('Theo tháng')}</T>
        {selected.months.map(m => <Row key={m.month}><T size={11} style={{flex: 1}}>{m.month} · {m.transactions}</T><T size={11} bold color={tone(m.net)}>{fmt(m.net)}</T></Row>)}
        <T size={11} bold>{t('Top người dùng theo khối lượng')}</T>
        {selected.topUsers.map(u => <View key={u.userId} style={{borderTopWidth: 1, borderColor: c.border, paddingTop: 4}}>
          <Row><T size={11} bold style={{flex: 1}}>{u.fullName}</T><T size={11} bold color={tone(u.net)}>{fmt(u.net)}</T></Row>
          <T size={10} color={c.muted}>{u.email} · {u.transactions} · {t('Nạp')} {fmt(u.deposits)} · {t('Rút')} {fmt(u.withdrawals)}</T></View>)}
      </Card>}
  </Screen>;
}
