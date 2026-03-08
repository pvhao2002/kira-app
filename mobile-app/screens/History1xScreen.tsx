import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Href } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';

const depositGreen = '#0bda5b';
const withdrawOrange = '#fa6238';

type FilterId = 'all' | 'deposit' | 'withdraw' | 'promo';
const FILTERS: { id: FilterId; label: string; icon: string }[] = [
  { id: 'all', label: 'Tất cả', icon: 'list' },
  { id: 'deposit', label: 'Nạp tiền', icon: 'account-balance-wallet' },
  { id: 'withdraw', label: 'Rút tiền', icon: 'payments' },
  { id: 'promo', label: 'Khuyến mãi', icon: 'redeem' },
];

type TxType = 'deposit' | 'withdraw' | 'promo';
type TxItem = {
  id: string;
  type: TxType;
  title: string;
  subtitle: string;
  amount: string;
  isPositive: boolean;
};
type DayGroup = { date: string; items: TxItem[] };

const MOCK_DAYS: DayGroup[] = [
  {
    date: '27.12.2025',
    items: [
      { id: '1', type: 'promo', title: 'Quy đổi tiền thưởng khuyến mãi', subtitle: '00:10 • Tài khoản chính', amount: '+2.091.128đ', isPositive: true },
    ],
  },
  {
    date: '26.12.2025',
    items: [
      { id: '2', type: 'promo', title: 'Thưởng ghi có vào tài khoản', subtitle: '00:10 • Khuyến mãi', amount: '+8.000.000đ', isPositive: true },
      { id: '3', type: 'deposit', title: 'Nạp tiền qua Techcombank', subtitle: '00:10 • GD 19325114033', amount: '+8.000.000đ', isPositive: true },
    ],
  },
  {
    date: '25.12.2025',
    items: [
      { id: '4', type: 'deposit', title: 'Nạp tiền qua Ví điện tử', subtitle: '21:51 • GD 19323400039', amount: '+3.000.000đ', isPositive: true },
      { id: '5', type: 'withdraw', title: 'Rút về Vietcombank', subtitle: '13:36 • GD 4314648441', amount: '-6.313.662đ', isPositive: false },
    ],
  },
];

function getTxIcon(type: TxType) {
  if (type === 'promo') return { name: 'redeem' as const, bg: 'rgba(168,85,247,0.2)', color: '#a855f7' };
  if (type === 'deposit') return { name: 'account-balance-wallet' as const, bg: 'rgba(11,218,91,0.1)', color: depositGreen };
  return { name: 'payments' as const, bg: 'rgba(250,98,56,0.1)', color: withdrawOrange };
}

export default function History1xScreen() {
  const P = AppPalette;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: P.background, borderBottomColor: P.headerBorder }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={P.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: P.text }]}>Lịch sử 1x</Text>
        <TouchableOpacity
          style={[styles.headerRight, { justifyContent: 'center' }]}
          onPress={() => router.push('/add-transaction' as Href)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={26} color={P.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardsRow}>
          <View style={[styles.summaryCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(11,218,91,0.1)' }]}>
                <MaterialIcons name="trending-up" size={18} color={depositGreen} />
              </View>
              <Text style={[styles.cardLabel, { color: P.textSecondary }]}>Tổng nạp</Text>
            </View>
            <Text style={[styles.cardValue, { color: P.text }]}>+18.091.128đ</Text>
            <View style={styles.cardChangeRow}>
              <MaterialIcons name="arrow-upward" size={12} color={depositGreen} />
              <Text style={[styles.cardChange, { color: depositGreen }]}>12.5% so với tháng trước</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(250,98,56,0.1)' }]}>
                <MaterialIcons name="trending-down" size={18} color={withdrawOrange} />
              </View>
              <Text style={[styles.cardLabel, { color: P.textSecondary }]}>Tổng rút</Text>
            </View>
            <Text style={[styles.cardValue, { color: P.text }]}>-6.313.662đ</Text>
            <View style={styles.cardChangeRow}>
              <MaterialIcons name="arrow-downward" size={12} color={withdrawOrange} />
              <Text style={[styles.cardChange, { color: withdrawOrange }]}>3.1% so với tháng trước</Text>
            </View>
          </View>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: P.surfaceInput, borderColor: P.border }]}>
          <MaterialIcons name="search" size={22} color={P.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: P.text }]}
            placeholder="Tìm kiếm mã giao dịch, số tiền..."
            placeholderTextColor={P.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity style={styles.filterIcon}>
            <MaterialIcons name="tune" size={22} color={P.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.chip,
                  { backgroundColor: active ? P.primary : P.surfaceInput, borderColor: active ? P.primary : P.border },
                ]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.9}
              >
                <MaterialIcons name={f.icon as 'list'} size={18} color={active ? '#fff' : P.text} />
                <Text style={[styles.chipText, { color: active ? '#fff' : P.text }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {MOCK_DAYS.map((day) => (
          <View key={day.date} style={styles.dayGroup}>
            <Text style={[styles.dayTitle, { color: P.textSecondary }]}>{day.date}</Text>
            {day.items.map((item) => {
              const iconStyle = getTxIcon(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.txRow, { borderBottomColor: P.border }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.txIconWrap, { backgroundColor: iconStyle.bg }]}>
                    <MaterialIcons name={iconStyle.name} size={22} color={iconStyle.color} />
                  </View>
                  <View style={styles.txContent}>
                    <Text style={[styles.txTitle, { color: P.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.txSub, { color: P.textSecondary }]}>{item.subtitle}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      item.isPositive ? { color: depositGreen } : { color: P.text },
                    ]}
                  >
                    {item.amount}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700', position: 'absolute', left: '50%', marginLeft: -60, width: 120, textAlign: 'center' },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  cardsRow: { flexDirection: 'row', gap: 16, padding: 16, flexWrap: 'wrap' },
  summaryCard: {
    flex: 1,
    minWidth: 158,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14, fontWeight: '500' },
  cardValue: { fontSize: 24, fontWeight: '800' },
  cardChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardChange: { fontSize: 12, fontWeight: '500' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  filterIcon: { padding: 8 },
  chipRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  dayGroup: { marginTop: 8 },
  dayTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txContent: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 16, fontWeight: '600' },
  txSub: { fontSize: 14, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  bottomPad: { height: 24 },
});
