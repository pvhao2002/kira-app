import React, { useState } from 'react';
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

type StatCard = { id: string; label: string; value: string; tag: string; pct: number; barColor: string };
const STAT_CARDS: StatCard[] = [
  { id: 'ft', label: 'FT SCORE', value: '72%', tag: 'High', pct: 72, barColor: AppPalette.primary },
  { id: 'corner', label: 'CORNER', value: '65%', tag: 'Avg', pct: 65, barColor: AppPalette.orange },
  { id: 'goal', label: 'GOAL', value: '81%', tag: 'Top', pct: 81, barColor: AppPalette.green },
  { id: 'h2', label: 'H2 STATS', value: '58%', tag: '', pct: 58, barColor: AppPalette.yellow },
];

type FilterId = 'all' | 'today' | 'win' | 'lose';
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'win', label: 'Thắng' },
  { id: 'lose', label: 'Thua' },
];

type ResultStatus = 'win' | 'lose' | 'pending' | 'exact';
type PredRow = { label: string; pred: string; actual: string; ok?: boolean };
type PredictionItem = {
  id: string;
  league: string;
  time: string;
  status: ResultStatus;
  match: string;
  goals: string;
  corners: string;
  hdc: string;
  ou: string;
  rows: PredRow[];
};

const MOCK_PREDICTIONS: PredictionItem[] = [
  {
    id: '1',
    league: 'Premier League',
    time: '19:30 - 12/05',
    status: 'win',
    match: 'Man Utd vs Chelsea',
    goals: '2 - 1',
    corners: '12',
    hdc: '-0.25',
    ou: '2.75',
    rows: [
      { label: 'FT_SCORE', pred: '2-1', actual: '2-1', ok: true },
      { label: 'HT_SCORE', pred: '1-0', actual: '1-0', ok: true },
      { label: 'GOAL', pred: 'O 2.5', actual: '3', ok: true },
      { label: 'CORNER', pred: 'U 9.5', actual: '12', ok: false },
      { label: 'H2_FT', pred: '2-1', actual: '2-1', ok: true },
      { label: 'H2_HT', pred: '--', actual: '--' },
      { label: 'H2_GOAL', pred: 'O 1.5', actual: '2', ok: true },
      { label: 'H2_CNR', pred: 'U 5', actual: '4', ok: true },
    ],
  },
  {
    id: '2',
    league: 'Premier League',
    time: '21:45 - 11/05',
    status: 'lose',
    match: 'Arsenal vs Liverpool',
    goals: '0 - 2',
    corners: '8',
    hdc: '-0.5',
    ou: '3.0',
    rows: [
      { label: 'FT_SCORE', pred: '1-1', actual: '0-2', ok: false },
      { label: 'HT_SCORE', pred: '0-0', actual: '0-1', ok: false },
      { label: 'GOAL', pred: 'U 2.5', actual: '2', ok: true },
      { label: 'CORNER', pred: 'O 9.5', actual: '8', ok: false },
    ],
  },
  {
    id: '3',
    league: 'La Liga',
    time: '20:00 - Hôm nay',
    status: 'pending',
    match: 'Real Madrid vs Barcelona',
    goals: '--',
    corners: '--',
    hdc: '-0.5',
    ou: '3.25',
    rows: [
      { label: 'FT_SCORE', pred: '3-1', actual: '--' },
      { label: 'GOAL', pred: 'O 3.5', actual: '--' },
      { label: 'CORNER', pred: 'O 9.5', actual: '--' },
      { label: 'H2_GOAL', pred: 'O 1.5', actual: '--' },
    ],
  },
  {
    id: '4',
    league: 'Serie A',
    time: '22:00 - 10/05',
    status: 'exact',
    match: 'Juventus vs AC Milan',
    goals: '0 - 0',
    corners: '4',
    hdc: '-0.25',
    ou: '2.25',
    rows: [
      { label: 'FT_SCORE', pred: '0-0', actual: '0-0', ok: true },
      { label: 'HT_SCORE', pred: '0-0', actual: '0-0', ok: true },
      { label: 'GOAL', pred: 'U 2.5', actual: '0', ok: true },
    ],
  },
];

const STAT_ICONS: Record<string, string> = {
  ft: 'scoreboard',
  corner: 'flag',
  goal: 'sports-soccer',
  h2: 'timer',
};

export default function PredictionHistoryScreen() {
  const [filter, setFilter] = useState<FilterId>('all');

  const P = AppPalette;
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: P.background, borderBottomColor: P.border }]}>
        <Text style={[styles.headerTitle, { color: P.text }]}>Kết quả</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8}>
            <MaterialIcons name="filter-list" size={24} color={P.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8}>
            <MaterialIcons name="more-vert" size={24} color={P.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          {STAT_CARDS.map((s) => (
            <View
              key={s.id}
              style={[styles.statCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}
            >
              <MaterialIcons
                name={STAT_ICONS[s.id] as 'scoreboard'}
                size={32}
                color={P.textSecondary}
                style={{ opacity: 0.3, position: 'absolute', right: 8, top: 8 }}
              />
              <Text style={[styles.statLabel, { color: P.textSecondary }]}>{s.label}</Text>
              <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: P.text }]}>{s.value}</Text>
                {s.tag ? <Text style={[styles.statTag, { color: P.green }]}>{s.tag}</Text> : null}
              </View>
              <View style={[styles.progressBg, { backgroundColor: P.graySoft }]}>
                <View style={[styles.progressFill, { width: `${s.pct}%`, backgroundColor: s.barColor }]} />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? P.primary : P.surfaceCard,
                    borderColor: active ? P.primary : P.border,
                  },
                ]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.9}
              >
                <Text style={[styles.chipText, { color: active ? P.text : P.textSecondary }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.list}>
          {MOCK_PREDICTIONS.map((item) => (
            <View
              key={item.id}
              style={[styles.card, { backgroundColor: P.surfaceCard, borderColor: P.border }]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardMeta}>
                  <MaterialIcons name="emoji-events" size={16} color={P.textSecondary} />
                  <Text style={[styles.cardMetaText, { color: P.textSecondary }]}>
                    {item.league} • {item.time}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    item.status === 'win' && { backgroundColor: P.greenSoft, borderColor: 'rgba(34,197,94,0.2)' },
                    item.status === 'lose' && { backgroundColor: P.redSoft, borderColor: 'rgba(239,68,68,0.2)' },
                    item.status === 'pending' && { backgroundColor: 'rgba(100,116,139,0.2)', borderColor: 'rgba(100,116,139,0.2)' },
                    item.status === 'exact' && { backgroundColor: P.greenSoft, borderColor: 'rgba(34,197,94,0.2)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      item.status === 'win' && { color: P.green },
                      item.status === 'lose' && { color: P.red },
                      item.status === 'pending' && { color: P.textSecondary },
                      item.status === 'exact' && { color: P.green },
                    ]}
                  >
                    {item.status === 'win' ? 'Thắng' : item.status === 'lose' ? 'Thua' : item.status === 'pending' ? 'Đang chờ' : 'Chính xác'}
                  </Text>
                </View>
              </View>

              <View style={styles.matchRow}>
                <View style={[styles.matchLogo, { backgroundColor: P.graySoft }]} />
                <Text style={[styles.matchTitle, { color: P.text }]} numberOfLines={1}>{item.match}</Text>
              </View>

              <View style={styles.quickGrid}>
                <View style={[styles.quickCell, { backgroundColor: P.graySoft, borderColor: P.border }]}>
                  <Text style={[styles.quickLabel, { color: P.textSecondary }]}>Bàn thắng</Text>
                  <View style={styles.quickValueRow}>
                    <MaterialIcons name="sports-soccer" size={14} color={P.primary} />
                    <Text style={[styles.quickValue, { color: P.text }]}>{item.goals}</Text>
                  </View>
                </View>
                <View style={[styles.quickCell, { backgroundColor: P.graySoft, borderColor: P.border }]}>
                  <Text style={[styles.quickLabel, { color: P.textSecondary }]}>Phạt góc</Text>
                  <View style={styles.quickValueRow}>
                    <Text style={[styles.quickValue, { color: P.text }]}>{item.corners}</Text>
                    <MaterialIcons name="flag" size={14} color={P.orange} />
                  </View>
                </View>
                <View style={[styles.quickCell, { backgroundColor: P.graySoft, borderColor: P.border }]}>
                  <Text style={[styles.quickLabel, { color: P.textSecondary }]}>HDC</Text>
                  <Text style={[styles.quickValue, { color: P.text }]}>{item.hdc}</Text>
                </View>
                <View style={[styles.quickCell, { backgroundColor: P.graySoft, borderColor: P.border }]}>
                  <Text style={[styles.quickLabel, { color: P.textSecondary }]}>Tài/Xỉu</Text>
                  <Text style={[styles.quickValue, { color: P.text }]}>{item.ou}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: P.border }]} />

              <View style={styles.predGrid}>
                {item.rows.map((r) => (
                  <View
                    key={r.label}
                    style={[
                      styles.predRow,
                      { backgroundColor: P.graySoft },
                      r.ok === true && { borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' },
                      r.ok === false && { borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
                    ]}
                  >
                    <Text style={[styles.predLabel, { color: P.textSecondary }]}>{r.label}</Text>
                    <View style={styles.predValues}>
                      <Text style={[styles.predPred, { color: P.primary }]}>{r.pred}</Text>
                      <Text style={[styles.predActual, { color: P.text }]}>{r.actual}</Text>
                      {r.ok === true && <Text style={styles.predOk}>✓</Text>}
                      {r.ok === false && <Text style={styles.predFail}>✕</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
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
  headerBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  statCard: {
    width: 160,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statTag: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  progressBg: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  chipRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, gap: 12, paddingTop: 8 },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMetaText: { fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchLogo: { width: 56, height: 56, borderRadius: 8 },
  matchTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCell: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', color: AppPalette.textSecondary },
  quickValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickValue: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, width: '100%' },
  predGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  predRow: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
  },
  predLabel: { fontSize: 11 },
  predValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  predPred: { fontSize: 11, fontWeight: '700' },
  predActual: { fontSize: 11 },
  predOk: { fontSize: 12, color: AppPalette.green, fontWeight: '700' },
  predFail: { fontSize: 12, color: AppPalette.red, fontWeight: '700' },
  bottomPad: { height: 24 },
});
