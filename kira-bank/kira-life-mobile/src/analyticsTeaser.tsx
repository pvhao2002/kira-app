import React, {useCallback, useState} from 'react';
import {Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {money} from './data';
import {Insight, InsightsReport, useInvestmentApi} from './investmentApi';
import {insightMessage} from './analyticsViews';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Card, go, Row, T} from './ui';

type Item = Insight & { currency: string };

/** Up to three of the most important recent observations across currencies, linking to the full reports. Silent when loading, failing or empty. */
export function InsightsTeaser() {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [items, setItems] = useState<Item[]>([]);
  useFocusEffect(useCallback(() => {
    let active = true; // ignore a response that arrives after blur/unmount or after a newer request
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 90);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    api.getReport<InsightsReport>('insights', {fromDate: iso(from), toDate: iso(to)})
      .then(value => {
        if (!active) return;
        const all = value.currencies.flatMap(entry => entry.data.insights.map(item => ({...item, currency: entry.currency})));
        // stable sort keeps the server's WARN → INFO order within equal severity
        setItems(all.filter(item => item.severity !== 'GOOD').sort((a, b) => (a.severity === 'WARN' ? 0 : 1) - (b.severity === 'WARN' ? 0 : 1)).slice(0, 3));
      })
      .catch(() => active && setItems([]));
    return () => { active = false; };
  }, []));
  if (items.length === 0) return null;
  return <Card>
    <Row><T size={13} bold style={{flex: 1}}>{t('Nhận xét tự động')}</T>
      <Pressable accessibilityRole="link" accessibilityLabel={t('Báo cáo')} onPress={() => go('investment-analytics')} style={{padding: 4}}>
        <T size={11} color={c.primary}>{t('Báo cáo')} ›</T></Pressable></Row>
    {items.map((item, index) => <View key={index} style={{borderLeftWidth: 4, borderColor: item.severity === 'WARN' ? c.error : c.primary, paddingLeft: 8}}>
      <T size={12}>{insightMessage(t, item, value => money(value, item.currency, lang))}</T></View>)}
  </Card>;
}
