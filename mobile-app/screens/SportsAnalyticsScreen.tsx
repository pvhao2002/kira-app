import React from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MatchCard } from '@/components/MatchCard';
import { MatchHistoryCard } from '@/components/MatchHistoryCard';
import { LiveMatchIndicator } from '@/components/LiveMatchIndicator';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { getAllMatches, getLiveMatches, getUpcomingMatches, getFinishedMatches } from '@/services/mockData';
import { Match } from '@/types';

export default function SportsAnalyticsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const allMatches = getAllMatches();
  const liveMatches = getLiveMatches();
  const upcomingMatches = getUpcomingMatches();
  const finishedMatches = getFinishedMatches().slice(0, 3); // Show only recent 3 matches

  const handleMatchPress = (match: Match) => {
    // TODO: Navigate to match detail screen
    // navigation.navigate('MatchDetail', { matchId: match.id });
    console.log('Match pressed:', match.id);
  };

  const handleViewAllHistory = () => {
    // TODO: Navigate to match history screen
    // navigation.navigate('MatchHistory');
    console.log('View all history pressed');
  };

  const renderMatch = ({ item }: { item: Match }) => {
    return (
      <MatchCard 
        match={item} 
        onPress={handleMatchPress}
      />
    );
  };

  const renderHistoryMatch = ({ item }: { item: Match }) => {
    return (
      <MatchHistoryCard 
        match={item} 
        onPress={handleMatchPress}
        showBettingResult={true}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Phân tích thể thao
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Dự đoán và phân tích các trận đấu bóng đá
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>85%</ThemedText>
            <ThemedText style={styles.statLabel}>Độ chính xác</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{allMatches.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Trận đã dự đoán</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>15</ThemedText>
            <ThemedText style={styles.statLabel}>Giải đấu</ThemedText>
          </View>
        </View>
      </ThemedView>

      {liveMatches.length > 0 && (
        <ThemedView style={styles.liveSection}>
          <View style={styles.liveSectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Trận đấu trực tiếp
            </ThemedText>
            <LiveMatchIndicator isLive={true} size="medium" />
          </View>
          <FlatList
            data={liveMatches}
            renderItem={renderMatch}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </ThemedView>
      )}

      <ThemedView style={styles.matchesHeader}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Trận đấu sắp tới
        </ThemedText>
      </ThemedView>

      <FlatList
        data={upcomingMatches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id}
        style={styles.matchesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          finishedMatches.length > 0 ? (
            <View style={styles.historySection}>
              <View style={styles.historySectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Kết quả gần đây
                </ThemedText>
                <TouchableOpacity onPress={handleViewAllHistory}>
                  <ThemedText style={[styles.viewAllText, { color: colors.tint }]}>
                    Xem tất cả
                  </ThemedText>
                </TouchableOpacity>
              </View>
              {finishedMatches.map((match) => (
                <MatchHistoryCard
                  key={match.id}
                  match={match}
                  onPress={handleMatchPress}
                  showBettingResult={true}
                />
              ))}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  statsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  liveSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  liveSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  horizontalList: {
    paddingRight: 16,
  },
  matchesHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  matchesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historySection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  historySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
});