import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';

type CardItem = {
  id: string;
  bankCode: string;
  bankName: string;
  limit: string;
  badge: string;
  badgeVariant: 'payment' | 'statement' | 'neutral';
  statementDate: string;
  statementStatus: string;
  dueDate: string;
  paymentStatus: 'paid' | 'unpaid' | 'pending';
  leftBorderColor?: string;
};

const MOCK_CARDS: CardItem[] = [
  {
    id: '1',
    bankCode: 'TCB',
    bankName: 'Techcombank Visa',
    limit: '200.000.000đ',
    badge: 'Còn 4 ngày TT',
    badgeVariant: 'payment',
    statementDate: '25/10',
    statementStatus: 'Đã sao kê',
    dueDate: '10/11',
    paymentStatus: 'unpaid',
    leftBorderColor: AppPalette.yellow,
  },
  {
    id: '2',
    bankCode: 'VIB',
    bankName: 'VIB Online Plus',
    limit: '50.000.000đ',
    badge: 'Còn 18 ngày SK',
    badgeVariant: 'statement',
    statementDate: '20/10',
    statementStatus: 'Đã sao kê',
    dueDate: '05/11',
    paymentStatus: 'paid',
  },
  {
    id: '3',
    bankCode: 'TPB',
    bankName: 'TPBank EVO',
    limit: '30.000.000đ',
    badge: 'Còn 5 ngày SK',
    badgeVariant: 'neutral',
    statementDate: '08/11',
    statementStatus: 'Chưa sao kê',
    dueDate: '23/11',
    paymentStatus: 'pending',
  },
];

const TOTAL_DEBT = '125.450.000đ';

function BankLogo({ code, leftBorder }: { code: string; leftBorder?: string }) {
  const gradient = leftBorder === AppPalette.yellow ? ['#dc2626', '#000'] : leftBorder === AppPalette.primary ? ['#2563eb', '#312e81'] : ['#a855f7', '#db2777'];
  return (
    <View style={[styles.bankLogo, { backgroundColor: AppPalette.surfaceInput }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: gradient[0], opacity: 0.85 }]} />
      <Text style={styles.bankLogoText}>{code}</Text>
    </View>
  );
}

function Badge({ label, variant }: { label: string; variant: CardItem['badgeVariant'] }) {
  const isPayment = variant === 'payment';
  const isStatement = variant === 'statement';
  const bg = isPayment ? AppPalette.redSoft : isStatement ? AppPalette.primarySoft : AppPalette.graySoft;
  const textColor = isPayment ? AppPalette.red : isStatement ? AppPalette.primary : AppPalette.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export default function CreditCardListScreen() {
  const P = AppPalette;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: P.background, borderBottomColor: P.headerBorder }]}>
        <Text style={[styles.headerTitle, { color: P.text }]}>Sao kê & Thanh toán</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: P.surfaceInput }]} activeOpacity={0.8}>
            <MaterialIcons name="notifications-none" size={24} color={P.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: P.surfaceInput }]} activeOpacity={0.8}>
            <MaterialIcons name="settings" size={24} color={P.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: P.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.totalCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
          <View style={styles.totalRow}>
            <MaterialIcons name="account-balance-wallet" size={20} color={P.textSecondary} />
            <Text style={[styles.totalLabel, { color: P.textSecondary }]}>Tổng dư nợ hiện tại</Text>
          </View>
          <Text style={[styles.totalValue, { color: P.text }]}>{TOTAL_DEBT}</Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: P.text }]}>Danh sách thẻ</Text>
          <TouchableOpacity activeOpacity={0.8}>
            <Text style={[styles.viewAll, { color: P.primary }]}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardList}>
          {MOCK_CARDS.map((card) => (
            <View
              key={card.id}
              style={[
                styles.card,
                { backgroundColor: P.surfaceCard, borderColor: P.border },
                card.leftBorderColor && { borderLeftWidth: 4, borderLeftColor: card.leftBorderColor },
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <BankLogo code={card.bankCode} leftBorder={card.leftBorderColor} />
                  <View>
                    <Text style={[styles.cardName, { color: P.text }]}>{card.bankName}</Text>
                    <Text style={[styles.cardLimit, { color: P.textSecondary }]}>Hạn mức: {card.limit}</Text>
                  </View>
                </View>
                <Badge label={card.badge} variant={card.badgeVariant} />
              </View>
              <View style={[styles.divider, { backgroundColor: P.border }]} />
              <View style={styles.cardDates}>
                <View style={styles.dateBlock}>
                  <Text style={[styles.dateLabel, { color: P.textSecondary }]}>Ngày sao kê</Text>
                  <Text style={[styles.dateValue, { color: P.text }]}>{card.statementDate}</Text>
                  <Text style={[styles.dateSub, { color: P.textSecondary }]}>{card.statementStatus}</Text>
                </View>
                <View style={styles.dateBlockEnd}>
                  <Text style={[styles.dateLabel, { color: P.textSecondary }]}>Hạn thanh toán</Text>
                  <Text style={[styles.dateValue, { color: P.text }]}>{card.dueDate}</Text>
                  <Text
                    style={[
                      styles.dateSub,
                      card.paymentStatus === 'unpaid' && { color: P.red, fontWeight: '700' },
                      card.paymentStatus === 'paid' && { color: P.green, fontWeight: '600' },
                      card.paymentStatus === 'pending' && { color: P.textSecondary },
                    ]}
                  >
                    {card.paymentStatus === 'unpaid' ? 'Chưa thanh toán' : card.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.addCardBtn, { backgroundColor: P.primary }]}
          activeOpacity={0.9}
          onPress={() => router.push('/add-card')}
        >
          <MaterialIcons name="add-card" size={24} color="#fff" />
          <Text style={styles.addCardText}>Thêm thẻ tín dụng mới</Text>
        </TouchableOpacity>

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
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  totalCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  totalLabel: { fontSize: 14, fontWeight: '500' },
  totalValue: { fontSize: 28, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  viewAll: { fontSize: 14, fontWeight: '600' },
  cardList: { gap: 16 },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bankLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bankLogoText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardLimit: { fontSize: 14, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, width: '100%', marginVertical: 16 },
  cardDates: { flexDirection: 'row', justifyContent: 'space-between' },
  dateBlock: {},
  dateBlockEnd: { alignItems: 'flex-end' },
  dateLabel: { fontSize: 12, marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: '600' },
  dateSub: { fontSize: 11, marginTop: 2 },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 12,
    marginTop: 24,
  },
  addCardText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bottomPad: { height: 24 },
});
