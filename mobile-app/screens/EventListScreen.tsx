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

type FilterId = 'today' | 'tomorrow' | 'premier' | 'laliga' | 'seriea';

type MarketRow = { label: string; line: string; price: string };
type Market = { id: string; title: string; icon?: 'flag'; rows: MarketRow[] };

type MatchItem = {
  id: string;
  league: string;
  leagueAccent?: string;
  round?: string;
  dateLabel: string;
  isLive: boolean;
  statusLabel?: string;
  metaRight?: string;
  homeTeam: string;
  awayTeam: string;
  scoreDisplay: string;
  scoreTag?: string;
  markets: Market[];
};

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'tomorrow', label: 'Ngày mai' },
  { id: 'premier', label: 'Premier League' },
  { id: 'laliga', label: 'La Liga' },
  { id: 'seriea', label: 'Serie A' },
];

const MOCK_MATCHES: MatchItem[] = [
  {
    id: '1',
    league: 'Premier League',
    leagueAccent: undefined,
    round: 'Vòng 34',
    dateLabel: '12/05',
    isLive: true,
    statusLabel: "TRỰC TIẾP - 32'",
    homeTeam: 'Man United',
    awayTeam: 'Chelsea',
    scoreDisplay: '2 - 1',
    scoreTag: 'H1',
    markets: [
      { id: 'hdp', title: 'Kèo chấp (HDP)', rows: [{ label: 'Ban đầu', line: '0.5', price: '0.90' }, { label: 'Trước trận', line: '0.5', price: '0.98' }] },
      { id: 'ou', title: 'Tài/Xỉu (O/U)', rows: [{ label: 'Ban đầu', line: '2.25', price: '0.95' }, { label: 'Trước trận', line: '2.5', price: '0.85' }] },
      { id: 'corner-hdp', title: 'Kèo góc', icon: 'flag', rows: [{ label: 'Ban đầu', line: '-0.5', price: '0.88' }, { label: 'Trước trận', line: '-1', price: '0.92' }] },
      { id: 'corner-ou', title: 'T/X góc', icon: 'flag', rows: [{ label: 'Ban đầu', line: '9.5', price: 'T 0.90 / X 0.92' }, { label: 'Trước trận', line: '10.5', price: 'T 0.85 / X 0.98' }] },
    ],
  },
  {
    id: '2',
    league: 'Premier League',
    round: 'Vòng 34',
    dateLabel: '22:00 - Hôm nay',
    isLive: false,
    metaRight: 'Emirates Stadium',
    homeTeam: 'Arsenal',
    awayTeam: 'Liverpool',
    scoreDisplay: 'VS',
    markets: [
      { id: 'hdp', title: 'Kèo chấp (HDP)', rows: [{ label: 'Ban đầu', line: '0', price: '0.95' }, { label: 'Trước trận', line: '0/0.5', price: '0.92' }] },
      { id: 'ou', title: 'Tài/Xỉu (O/U)', rows: [{ label: 'Ban đầu', line: '2.75', price: '0.85' }, { label: 'Trước trận', line: '3.0', price: '0.88' }] },
      { id: 'corner-hdp', title: 'Kèo góc', icon: 'flag', rows: [{ label: 'Ban đầu', line: '0', price: '0.90' }, { label: 'Trước trận', line: '-0.25', price: '0.94' }] },
      { id: 'corner-ou', title: 'T/X góc', icon: 'flag', rows: [{ label: 'Ban đầu', line: '10', price: 'T 0.88 / X 0.95' }, { label: 'Trước trận', line: '10.5', price: 'T 0.90 / X 0.92' }] },
    ],
  },
  {
    id: '3',
    league: 'La Liga',
    leagueAccent: '#eeb01c',
    dateLabel: '02:00 - 13/05',
    isLive: false,
    metaRight: 'Santiago Bernabéu',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    scoreDisplay: 'VS',
    markets: [
      { id: 'hdp', title: 'Kèo chấp (HDP)', rows: [{ label: 'Ban đầu', line: '0.5', price: '0.88' }, { label: 'Trước trận', line: '0.5', price: '0.95' }] },
      { id: 'ou', title: 'Tài/Xỉu (O/U)', rows: [{ label: 'Ban đầu', line: '3.25', price: '0.92' }, { label: 'Trước trận', line: '3.5', price: '0.90' }] },
      { id: 'corner-hdp', title: 'Kèo góc', icon: 'flag', rows: [{ label: 'Ban đầu', line: '-0.5', price: '0.85' }, { label: 'Trước trận', line: '-0.5', price: '0.90' }] },
      { id: 'corner-ou', title: 'T/X góc', icon: 'flag', rows: [{ label: 'Ban đầu', line: '9.5', price: 'T 0.92 / X 0.95' }, { label: 'Trước trận', line: '9.5', price: 'T 0.94 / X 0.90' }] },
    ],
  },
];

export default function EventListScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('today');
  const [search, setSearch] = useState('');
  const P = AppPalette;
  const leagues = Array.from(new Set(MOCK_MATCHES.map((m) => m.league)));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: P.background, borderBottomColor: P.headerBorder }]}>
        <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: P.surfaceInput }]} activeOpacity={0.8}>
          <MaterialIcons name="notifications-none" size={24} color={P.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: P.text }]}>Sự kiện bóng đá</Text>
        <TouchableOpacity style={[styles.avatarBtn, { backgroundColor: P.surfaceInput }]} activeOpacity={0.8}>
          <MaterialIcons name="person" size={22} color={P.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: P.background }]}>
        <View style={[styles.searchBar, { backgroundColor: P.surfaceInput }]}>
          <MaterialIcons name="search" size={20} color={P.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: P.text }]}
            placeholder="Tìm đội, giải đấu..."
            placeholderTextColor={P.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={[styles.chipWrap, { backgroundColor: P.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? P.primary : P.surfaceInput,
                    borderColor: active ? P.primary : P.border,
                  },
                ]}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.9}
              >
                <Text style={[styles.chipText, { color: active ? P.text : P.textSecondary }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: P.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {leagues.map((leagueName, leagueIndex) => {
          const matches = MOCK_MATCHES.filter((m) => m.league === leagueName);
          const accent = matches[0]?.leagueAccent ?? P.primary;
          const isFirstLeague = leagueIndex === 0;
          return (
            <View key={leagueName} style={styles.leagueBlock}>
              <View style={[styles.leagueHeader, isFirstLeague ? styles.leagueHeaderFirst : styles.leagueHeaderNext]}>
                <View style={[styles.leagueBar, { backgroundColor: accent }]} />
                <Text style={[styles.leagueTitle, { color: P.text }]}>{leagueName}</Text>
                {matches[0]?.round && (
                  <View style={[styles.roundBadge, { backgroundColor: P.primarySoft }]}>
                    <Text style={[styles.roundBadgeText, { color: P.primary }]}>{matches[0].round}</Text>
                  </View>
                )}
              </View>

              {matches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  style={[styles.card, { backgroundColor: P.surfaceCard, borderColor: P.border }]}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/event-detail?id=${match.id}` as Href)}
                >
                  <View style={[styles.metaRow, { borderBottomColor: P.border }]}>
                    <View style={styles.metaLeft}>
                      <MaterialIcons
                        name={match.isLive ? 'calendar-today' : 'schedule'}
                        size={14}
                        color={P.textSecondary}
                      />
                      <Text style={[styles.metaText, { color: P.textSecondary }]}>{match.dateLabel}</Text>
                    </View>
                    {match.isLive ? (
                      <View style={styles.liveBadge}>
                        <MaterialIcons name="fiber-manual-record" size={12} color={P.primary} />
                        <Text style={[styles.liveText, { color: P.primary }]}>{match.statusLabel}</Text>
                      </View>
                    ) : (
                      match.metaRight != null && (
                        <Text style={[styles.metaText, { color: P.textSecondary }]}>{match.metaRight}</Text>
                      )
                    )}
                  </View>

                  <View style={styles.teamsRow}>
                    <View style={styles.teamCol}>
                      <View style={[styles.teamLogo, { backgroundColor: '#fff' }]}>
                        <Text style={styles.teamLogoText}>{match.homeTeam.charAt(0)}</Text>
                      </View>
                      <Text style={[styles.teamName, { color: P.text }]}>{match.homeTeam}</Text>
                    </View>
                    <View style={styles.scoreCol}>
                      <View style={[styles.scoreBox, { backgroundColor: P.scoreBoxBg }]}>
                        <Text
                          style={[
                            styles.scoreText,
                            { color: match.scoreDisplay === 'VS' ? P.textSecondary : P.text },
                          ]}
                        >
                          {match.scoreDisplay}
                        </Text>
                      </View>
                      {match.scoreTag != null && (
                        <Text style={[styles.scoreTag, { color: P.textSecondary }]}>{match.scoreTag}</Text>
                      )}
                    </View>
                    <View style={styles.teamCol}>
                      <View style={[styles.teamLogo, { backgroundColor: '#fff' }]}>
                        <Text style={styles.teamLogoText}>{match.awayTeam.charAt(0)}</Text>
                      </View>
                      <Text style={[styles.teamName, { color: P.text }]}>{match.awayTeam}</Text>
                    </View>
                  </View>

                  <View style={styles.marketGrid}>
                    {match.markets.map((m) => (
                      <View
                        key={m.id}
                        style={[styles.marketCard, { backgroundColor: P.surfaceInput, borderColor: P.border }]}
                      >
                        <View style={[styles.marketHeader, { borderBottomColor: P.border }]}>
                          {m.icon != null && <MaterialIcons name="flag" size={12} color={P.textSecondary} />}
                          <Text style={[styles.marketTitle, { color: P.textSecondary }]}>{m.title}</Text>
                        </View>
                        {m.rows.map((r) => (
                          <View key={r.label} style={styles.marketRow}>
                            <Text style={[styles.marketLabel, { color: P.textSecondary }]}>{r.label}</Text>
                            <View style={styles.marketValues}>
                              <Text style={[styles.marketLine, { color: P.text }]}>{r.line}</Text>
                              <View style={[styles.priceBadge, { backgroundColor: P.primarySoft }]}>
                                <Text style={[styles.priceText, { color: P.primary }]}>{r.price}</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
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
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
    textAlign: 'center',
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    paddingLeft: 16,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  chipWrap: { paddingVertical: 8 },
  chipRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  leagueBlock: { marginBottom: 8 },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  leagueHeaderFirst: { paddingTop: 24 },
  leagueHeaderNext: { paddingTop: 16 },
  leagueBar: { width: 4, height: 20, borderRadius: 2, marginRight: 8 },
  leagueTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  roundBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roundBadgeText: { fontSize: 11, fontWeight: '600' },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveText: { fontSize: 12, fontWeight: '700' },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamCol: { flex: 1, alignItems: 'center', gap: 8 },
  teamLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoText: { fontSize: 18, fontWeight: '700', color: '#1c252e' },
  teamName: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  scoreCol: { minWidth: 80, alignItems: 'center', gap: 4 },
  scoreBox: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scoreText: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  scoreTag: { fontSize: 11 },
  marketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  marketCard: {
    width: '47%',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  marketTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  marketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  marketLabel: { fontSize: 10 },
  marketValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketLine: { fontSize: 12, fontWeight: '700' },
  priceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priceText: { fontSize: 11, fontWeight: '700' },
  bottomPad: { height: 24 },
});
