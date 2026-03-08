import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';

const cardBg = '#1a2632';
const P = AppPalette;

const MARKET_ROWS = [
  { label: 'Handicap', opening: '-0.5', preMatch: '-0.75', barColor: P.orange },
  { label: 'O/U', opening: '2.75', preMatch: '3.0', barColor: '#3b82f6' },
  { label: '1X2 (Home)', opening: '1.95', preMatch: '1.90', barColor: P.green },
  { label: 'Corner', opening: '9.5', preMatch: '10.0', barColor: P.primary, isHighlight: true },
];

const STAT_CARDS: { title: string; icon: string; rows: { stat: string; value: string }[] }[] = [
  { title: 'FT_SCORE', icon: 'scoreboard', rows: [{ stat: 'Home Goals', value: '2' }, { stat: 'Away Goals', value: '1' }] },
  { title: 'HT_SCORE', icon: 'timer', rows: [{ stat: 'Home HT', value: '1' }, { stat: 'Away HT', value: '0' }] },
  { title: 'GOAL', icon: 'sports-soccer', rows: [{ stat: 'Total Goals', value: '3' }, { stat: 'Over 2.5', value: 'Yes' }] },
  { title: 'CORNER', icon: 'flag', rows: [{ stat: 'Home', value: '5' }, { stat: 'Away', value: '2' }] },
  { title: 'H2_FT_SCORE', icon: 'history', rows: [{ stat: 'Home Wins', value: '4' }, { stat: 'Away Wins', value: '2' }] },
  { title: 'H2_HT_SCORE', icon: 'schedule', rows: [{ stat: 'Leading HT', value: '3' }, { stat: 'Draw HT', value: '3' }] },
  { title: 'H2_GOAL', icon: 'timeline', rows: [{ stat: 'Avg Goals', value: '2.8' }, { stat: 'BTTS', value: '4/6' }] },
  { title: 'H2_CORNER', icon: 'flag', rows: [{ stat: 'Avg Corners', value: '10.2' }, { stat: 'Over 9.5', value: '60%' }] },
];

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const homeTeam = 'Man City';
  const awayTeam = 'Arsenal';
  const scoreHome = 2;
  const scoreAway = 1;
  const isLive = true;
  const liveLabel = '75:00 Live';
  const league = 'Premier League';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: P.background, borderBottomColor: P.headerBorder }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={P.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: P.text }]} numberOfLines={1}>Chi tiết sự kiện bóng đá</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <MaterialIcons name="more-vert" size={24} color={P.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.matchBlock}>
          <View style={styles.teamsRow}>
            <View style={styles.teamCol}>
              <View style={[styles.teamLogo, { backgroundColor: P.surfaceInput }]}>
                <Text style={[styles.teamLogoText, { color: P.text }]}>{homeTeam.split(' ').map(w => w[0]).join('')}</Text>
              </View>
              <Text style={[styles.teamName, { color: P.text }]}>{homeTeam}</Text>
            </View>
            <View style={styles.scoreBlock}>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreNum, { color: P.text }]}>{scoreHome}</Text>
                <Text style={[styles.scoreDash, { color: P.textSecondary }]}>-</Text>
                <Text style={[styles.scoreNum, { color: P.text }]}>{scoreAway}</Text>
              </View>
              {isLive && (
                <View style={[styles.liveBadge, { backgroundColor: P.redSoft }]}>
                  <View style={[styles.liveDot, { backgroundColor: P.red }]} />
                  <Text style={[styles.liveText, { color: P.red }]}>{liveLabel}</Text>
                </View>
              )}
              <Text style={[styles.leagueLabel, { color: P.textSecondary }]}>{league}</Text>
            </View>
            <View style={styles.teamCol}>
              <View style={[styles.teamLogo, { backgroundColor: P.surfaceInput }]}>
                <Text style={[styles.teamLogoText, { color: P.text }]}>{awayTeam.split(' ').map(w => w[0]).join('')}</Text>
              </View>
              <Text style={[styles.teamName, { color: P.text }]}>{awayTeam}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: P.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: P.border }]}>
            <Text style={[styles.sectionTitle, { color: P.text }]}>Market Odds</Text>
            <MaterialIcons name="trending-up" size={22} color={P.textSecondary} />
          </View>
          <View style={[styles.tableHeader, { backgroundColor: P.graySoft }]}>
            <Text style={[styles.th, { color: P.textSecondary }]}>Market</Text>
            <Text style={[styles.thCenter, { color: P.textSecondary }]}>Opening</Text>
            <Text style={[styles.thCenter, { color: P.textSecondary }]}>Pre-match</Text>
          </View>
          {MARKET_ROWS.map((row) => (
            <View
              key={row.label}
              style={[
                styles.tableRow,
                { borderTopColor: P.border },
                row.isHighlight && { backgroundColor: P.primarySoft },
              ]}
            >
              <View style={styles.tdMarket}>
                {row.isHighlight ? (
                  <MaterialIcons name="flag" size={16} color={P.primary} />
                ) : (
                  <View style={[styles.bar, { backgroundColor: row.barColor }]} />
                )}
                <Text style={[styles.tdLabel, { color: P.text }]}>{row.label}</Text>
              </View>
              <Text style={[styles.tdCenter, { color: P.textSecondary }]}>{row.opening}</Text>
              <Text style={[styles.tdCenter, { color: row.isHighlight ? P.primary : P.text }]}>{row.preMatch}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsGrid}>
          {STAT_CARDS.map((card) => (
            <View key={card.title} style={[styles.statCard, { backgroundColor: cardBg, borderColor: P.border }]}>
              <View style={[styles.statCardHeader, { borderBottomColor: P.border }]}>
                <Text style={[styles.statCardTitle, { color: P.text }]}>{card.title}</Text>
                <MaterialIcons name={card.icon as 'scoreboard'} size={16} color={P.textSecondary} />
              </View>
              <View style={[styles.statCardSubhead, { backgroundColor: P.graySoft }]}>
                <Text style={[styles.statCardSubheadText, { color: P.textSecondary }]}>Stat</Text>
                <Text style={[styles.statCardSubheadText, { color: P.textSecondary }]}>Count</Text>
              </View>
              {card.rows.map((r) => (
                <View key={r.stat} style={[styles.statCardRow, { borderTopColor: P.border }]}>
                  <Text style={[styles.statCardStat, { color: P.text }]} numberOfLines={1}>{r.stat}</Text>
                  <Text style={[styles.statCardValue, { color: r.value === 'Yes' ? P.green : P.text }]}>{r.value}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={[styles.analysisCard, { backgroundColor: cardBg, borderColor: P.border }]}>
          <Text style={[styles.analysisTitle, { color: P.text }]}>Analysis & Notes</Text>
          <View style={styles.analysisContent}>
            <View style={[styles.analysisBar, { backgroundColor: P.primary }]} />
            <Text style={[styles.analysisText, { color: P.textSecondary }]}>
              Man City is dominating possession in the final third. High probability of corners in the next 10 minutes. Market trend suggests Over 9.5 corners is favorable.
            </Text>
          </View>
          <TouchableOpacity style={styles.addNoteBtn} activeOpacity={0.8}>
            <MaterialIcons name="edit-note" size={18} color={P.primary} />
            <Text style={[styles.addNoteText, { color: P.primary }]}>Add Personal Note</Text>
          </TouchableOpacity>
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  matchBlock: { marginBottom: 24 },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamCol: { flex: 1, alignItems: 'center', gap: 12 },
  teamLogo: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  teamLogoText: { fontSize: 18, fontWeight: '800' },
  teamName: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  scoreBlock: { alignItems: 'center', paddingHorizontal: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreNum: { fontSize: 28, fontWeight: '800' },
  scoreDash: { fontSize: 24, fontWeight: '700' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  leagueLabel: { fontSize: 12, marginTop: 8, color: AppPalette.textSecondary },
  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  th: { flex: 1, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  thCenter: { flex: 1, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1 },
  tdMarket: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { width: 4, height: 12, borderRadius: 2 },
  tdLabel: { fontSize: 14, fontWeight: '700' },
  tdCenter: { flex: 1, fontSize: 14, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  statCard: { width: '47%', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1 },
  statCardTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: AppPalette.text },
  statCardSubhead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6 },
  statCardSubheadText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1 },
  statCardStat: { flex: 1, fontSize: 12 },
  statCardValue: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  analysisCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  analysisTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  analysisContent: { flexDirection: 'row', gap: 12 },
  analysisBar: { width: 4, borderRadius: 2 },
  analysisText: { flex: 1, fontSize: 14, lineHeight: 22 },
  addNoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  addNoteText: { fontSize: 14, fontWeight: '700' },
  bottomPad: { height: 24 },
});
