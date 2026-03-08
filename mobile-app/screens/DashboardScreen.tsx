import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';

const P = AppPalette;
const accentGreen = '#22c55e';
const accentRed = '#ef4444';

const PERF_CARDS = [
  { label: 'Tổng trận', value: '42', unit: 'trận', sub: '+5 tuần này', icon: 'sports-soccer', trend: 'up' as const },
  { label: 'Tỷ lệ thắng', value: '68%', unit: '', sub: 'Cao hơn trung bình 12%', icon: 'emoji-events', pct: 68 },
  { label: 'Lợi nhuận', value: '+12.5tr', unit: '', sub: '+15% tháng trước', icon: 'monetization-on', trend: 'up' as const, valueColor: accentGreen },
  { label: 'Dự đoán', value: '', unit: '', icon: 'assessment', win: 28, lose: 14 },
];

const CHART_DAYS = [
  { label: 'T2', h: 48 },
  { label: 'T3', h: 96 },
  { label: 'T4', h: 64 },
  { label: 'T5', h: 128 },
  { label: 'T6', h: 80 },
  { label: 'T7', h: 56 },
  { label: 'CN', h: 128, highlight: true, tooltip: '5.2M' },
];

const ACTIVITIES = [
  { title: 'Arsenal vs Man City', sub: 'Dự đoán: Arsenal Thắng (2.10)', amount: '+500K', amountColor: accentGreen, time: '2h trước', icon: 'sports-soccer' },
  { title: 'Chelsea vs Liverpool', sub: 'Dự đoán: Tài 2.5 (1.85)', amount: '-200K', amountColor: accentRed, time: '5h trước', icon: 'sports-soccer' },
  { title: 'Thanh toán Spotify', sub: 'Thẻ VISA ****4242', amount: '-59K', amountColor: P.textSecondary, time: 'Hôm qua', icon: 'credit-card' },
  { title: 'Real Madrid vs Barca', sub: 'Dự đoán: Real Madrid (1.95)', amount: '+950K', amountColor: accentGreen, time: '1 ngày trước', icon: 'sports-soccer' },
];

export default function DashboardScreen() {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: P.background }]}>
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <View style={[styles.logoIcon, { backgroundColor: P.primary }]}>
                <MaterialIcons name="sports-soccer" size={22} color="#fff" />
              </View>
              <Text style={[styles.logoText, { color: P.text }]}>KiraManager</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: P.surfaceInput }]}>
                <MaterialIcons name="notifications-none" size={24} color={P.text} />
                <View style={[styles.notifDot, { backgroundColor: accentRed }]} />
              </TouchableOpacity>
              <View style={[styles.avatar, { backgroundColor: P.surfaceInput }]}>
                <MaterialIcons name="person" size={24} color={P.textSecondary} />
              </View>
            </View>
          </View>
          <Text style={[styles.welcomeTitle, { color: P.text }]}>Chào mừng trở lại!</Text>
          <Text style={[styles.welcomeSub, { color: P.textSecondary }]}>Dưới đây là hiệu suất tài chính của bạn.</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: P.surfaceInput }]} activeOpacity={0.8}>
              <MaterialIcons name="add" size={20} color={P.text} />
              <Text style={[styles.actionBtnText, { color: P.text }]}>Thêm trận</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: P.primary }]} activeOpacity={0.8}>
              <MaterialIcons name="payments" size={20} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Giao dịch</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <MaterialIcons name="analytics" size={20} color={P.primary} />
            <Text style={[styles.sectionTitle, { color: P.textSecondary }]}>Hiệu suất Football</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.perfScroll}>
            {PERF_CARDS.map((c) => (
              <View key={c.label} style={[styles.perfCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
                <View style={styles.perfCardHead}>
                  <Text style={[styles.perfLabel, { color: P.textSecondary }]}>{c.label}</Text>
                  <MaterialIcons name={c.icon as 'sports-soccer'} size={20} color={P.textSecondary} />
                </View>
                {c.win != null ? (
                  <View style={styles.perfWinLose}>
                    <View>
                      <Text style={[styles.perfWinNum, { color: accentGreen }]}>{c.win}</Text>
                      <Text style={[styles.perfWinLabel, { color: P.textSecondary }]}>Thắng</Text>
                    </View>
                    <View>
                      <Text style={[styles.perfLoseNum, { color: accentRed }]}>{c.lose}</Text>
                      <Text style={[styles.perfLoseLabel, { color: P.textSecondary }]}>Thua</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.perfValueRow}>
                      <Text style={[styles.perfValue, { color: c.valueColor ?? P.text }]}>{c.value}</Text>
                      {c.unit ? <Text style={[styles.perfUnit, { color: P.textSecondary }]}>{c.unit}</Text> : null}
                    </View>
                    {c.pct != null ? (
                      <View style={[styles.progressBg, { backgroundColor: P.surfaceInput }]}>
                        <View style={[styles.progressFill, { width: `${c.pct}%`, backgroundColor: P.primary }]} />
                      </View>
                    ) : null}
                    {c.sub ? (
                      c.trend ? (
                        <View style={styles.perfSubRow}>
                          <MaterialIcons name="trending-up" size={12} color={accentGreen} />
                          <Text style={[styles.perfSub, { color: accentGreen }]}>{c.sub}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.perfSub, { color: P.textSecondary, marginTop: 6 }]}>{c.sub}</Text>
                      )
                    ) : null}
                  </>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <MaterialIcons name="credit-card" size={20} color={P.orange} />
            <Text style={[styles.sectionTitle, { color: P.textSecondary }]}>Tài chính & Thẻ</Text>
          </View>
          <View style={[styles.debtCard, { backgroundColor: P.surfaceInput }]}>
            <View style={styles.debtCardHead}>
              <View>
                <Text style={[styles.debtLabel, { color: P.textSecondary }]}>Tổng dư nợ thẻ tín dụng</Text>
                <Text style={[styles.debtValue, { color: P.text }]}>45.200.000 <Text style={{ color: P.primary }}>đ</Text></Text>
              </View>
              <View style={[styles.warningIcon, { backgroundColor: 'rgba(249,115,22,0.2)' }]}>
                <MaterialIcons name="warning" size={24} color={P.orange} />
              </View>
            </View>
            <View style={styles.cardTags}>
              <View style={[styles.cardTag, { backgroundColor: P.graySoft }]}><Text style={[styles.cardTagText, { color: P.text }]}>VISA ...4242</Text></View>
              <View style={[styles.cardTag, { backgroundColor: P.graySoft }]}><Text style={[styles.cardTagText, { color: P.text }]}>MC ...8821</Text></View>
            </View>
          </View>
          <View style={[styles.statementCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
            <View style={styles.statementRow}>
              <View>
                <Text style={[styles.statementLabel, { color: P.textSecondary }]}>Kỳ sao kê tiếp theo</Text>
                <Text style={[styles.statementValue, { color: P.text }]}>Ngày 25/10</Text>
              </View>
              <View style={styles.statementRight}>
                <Text style={[styles.statementDays, { color: P.primary }]}>05</Text>
                <Text style={[styles.statementDaysLabel, { color: P.textSecondary }]}>Ngày còn lại</Text>
              </View>
            </View>
            <View style={[styles.progressBg, { backgroundColor: P.surfaceInput, marginVertical: 12 }]}>
              <View style={[styles.progressFill, { width: '85%', backgroundColor: P.orange }]} />
            </View>
            <View style={styles.statementFooter}>
              <Text style={[styles.statementFooterText, { color: P.textSecondary }]}>Đã dùng: 85% hạn mức</Text>
              <Text style={[styles.statementFooterText, { color: P.textSecondary }]}>Hạn mức: 50.000.000đ</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitleMain, { color: P.text }]}>Biểu đồ lợi nhuận</Text>
            <View style={[styles.badge, { backgroundColor: P.surfaceInput }]}>
              <Text style={[styles.badgeText, { color: P.textSecondary }]}>7 ngày qua</Text>
            </View>
          </View>
          <View style={[styles.chartCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
            <View style={styles.chartBars}>
              {CHART_DAYS.map((d) => (
                <View key={d.label} style={styles.chartCol}>
                  {d.tooltip ? (
                    <View style={[styles.chartTooltip, { backgroundColor: P.surfaceInput }]}>
                      <Text style={[styles.chartTooltipText, { color: P.text }]}>{d.tooltip}</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.chartBar,
                      { height: d.h, backgroundColor: d.highlight ? P.primary : P.surfaceInput },
                    ]}
                  />
                  <Text style={[styles.chartLabel, { color: d.highlight ? P.text : P.textSecondary }]}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitleMain, { color: P.text }]}>Hoạt động gần đây</Text>
            <TouchableOpacity><Text style={[styles.seeAll, { color: P.primary }]}>Xem tất cả</Text></TouchableOpacity>
          </View>
          <View style={styles.activityList}>
            {ACTIVITIES.map((a, i) => (
              <View key={i} style={[styles.activityItem, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
                <View style={[styles.activityIcon, { backgroundColor: P.surfaceInput }]}>
                  <MaterialIcons name={a.icon as 'sports-soccer'} size={24} color={P.textSecondary} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, { color: P.text }]}>{a.title}</Text>
                  <Text style={[styles.activitySub, { color: P.textSecondary }]}>{a.sub}</Text>
                </View>
                <View style={styles.activityRight}>
                  <Text style={[styles.activityAmount, { color: a.amountColor }]}>{a.amount}</Text>
                  <Text style={[styles.activityTime, { color: P.textSecondary }]}>{a.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: P.textSecondary }]}>© 2024 KiraManager. All rights reserved.</Text>
        </View>
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: AppPalette.surfaceCard },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  welcomeSub: { fontSize: 14, marginBottom: 24 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  section: { marginTop: 24, paddingHorizontal: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleMain: { fontSize: 18, fontWeight: '700' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  perfScroll: { flexDirection: 'row', gap: 16, paddingRight: 24 },
  perfCard: { minWidth: 160, padding: 16, borderRadius: 16, borderWidth: 1 },
  perfCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  perfLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  perfValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  perfValue: { fontSize: 24, fontWeight: '800' },
  perfUnit: { fontSize: 10 },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  perfSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  perfSub: { fontSize: 10, fontWeight: '500' },
  perfWinLose: { flexDirection: 'row', gap: 24 },
  perfWinNum: { fontSize: 20, fontWeight: '800' },
  perfWinLabel: { fontSize: 10, marginTop: 2 },
  perfLoseNum: { fontSize: 20, fontWeight: '800' },
  perfLoseLabel: { fontSize: 10, marginTop: 2 },
  debtCard: { padding: 20, borderRadius: 16, marginBottom: 16 },
  debtCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  debtLabel: { fontSize: 12, marginBottom: 4 },
  debtValue: { fontSize: 24, fontWeight: '800' },
  warningIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTags: { flexDirection: 'row', gap: 8 },
  cardTag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  cardTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statementCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
  statementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statementLabel: { fontSize: 12, marginBottom: 4 },
  statementValue: { fontSize: 18, fontWeight: '700' },
  statementRight: { alignItems: 'flex-end' },
  statementDays: { fontSize: 24, fontWeight: '800' },
  statementDaysLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statementFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  statementFooterText: { fontSize: 10 },
  chartCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 8 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartTooltip: { position: 'absolute', top: -28, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chartTooltipText: { fontSize: 10, fontWeight: '700' },
  chartBar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8, minHeight: 8 },
  chartLabel: { fontSize: 10, marginTop: 8 },
  seeAll: { fontSize: 14, fontWeight: '600' },
  activityList: { gap: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, borderRadius: 16, borderWidth: 1 },
  activityIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityContent: { flex: 1, minWidth: 0 },
  activityTitle: { fontSize: 14, fontWeight: '700' },
  activitySub: { fontSize: 11, marginTop: 2 },
  activityRight: { alignItems: 'flex-end' },
  activityAmount: { fontSize: 14, fontWeight: '700' },
  activityTime: { fontSize: 10, marginTop: 2 },
  footer: { marginTop: 32, paddingHorizontal: 24, alignItems: 'center' },
  footerText: { fontSize: 10 },
  bottomPad: { height: 24 },
});
