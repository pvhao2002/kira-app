import React, { useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MatchHistoryCard } from '@/components/MatchHistoryCard';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { getFinishedMatches, getMatchesByLeague } from '@/services/mockData';
import { Match } from '@/types';

type FilterType = 'all' | 'Premier League' | 'La Liga' | 'Bundesliga' | 'Serie A' | 'Ligue 1';

export default function MatchHistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [showBettingResults, setShowBettingResults] = useState(true);

  const finishedMatches = getFinishedMatches();
  
  const getFilteredMatches = (): Match[] => {
    if (selectedFilter === 'all') {
      return finishedMatches;
    }
    return getMatchesByLeague(selectedFilter);
  };

  const filteredMatches = getFilteredMatches();

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'Premier League', label: 'Premier League' },
    { key: 'La Liga', label: 'La Liga' },
    { key: 'Bundesliga', label: 'Bundesliga' },
    { key: 'Serie A', label: 'Serie A' },
    { key: 'Ligue 1', label: 'Ligue 1' },
  ];

  const handleMatchPress = (match: Match) => {
    // TODO: Navigate to match detail screen
    console.log('Historical match pressed:', match.id);
  };

  const renderMatch = ({ item }: { item: Match }) => {
    return (
      <MatchHistoryCard 
        match={item} 
        onPress={handleMatchPress}
        showBettingResult={showBettingResults}
      />
    );
  };

  const renderFilter = ({ item }: { item: { key: FilterType; label: string } }) => {
    const isSelected = selectedFilter === item.key;
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          { 
            backgroundColor: isSelected ? colors.tint : colors.background,
            borderColor: colors.border,
          }
        ]}
        onPress={() => setSelectedFilter(item.key)}
      >
        <ThemedText 
          style={[
            styles.filterText,
            { color: isSelected ? '#FFFFFF' : colors.text }
          ]}
        >
          {item.label}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const calculateStats = () => {
    const totalMatches = filteredMatches.length;
    let correctPredictions = 0;
    let totalAccuracy = 0;

    filteredMatches.forEach(match => {
      if (match.prediction && match.score) {
        totalAccuracy += match.prediction.accuracy;
        
        // Simple logic to check if prediction was correct
        const { recommendation } = match.prediction;
        const { home, away } = match.score;
        
        if (
          (recommendation.includes('Chủ nhà thắng') && home > away) ||
          (recommendation.includes('Khách thắng') && away > home) ||
          (recommendation.includes('Hòa') && home === away) ||
          (recommendation.includes('Tài') && (home + away) > 2.5) ||
          (recommendation.includes('Xỉu') && (home + away) < 2.5)
        ) {
          correctPredictions++;
        }
      }
    });

    return {
      totalMatches,
      correctPredictions,
      successRate: totalMatches > 0 ? Math.round((correctPredictions / totalMatches) * 100) : 0,
      averageAccuracy: totalMatches > 0 ? Math.round(totalAccuracy / totalMatches) : 0,
    };
  };

  const stats = calculateStats();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Lịch sử trận đấu
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Kết quả và phân tích các trận đã kết thúc
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{stats.totalMatches}</ThemedText>
            <ThemedText style={styles.statLabel}>Trận đã kết thúc</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{stats.successRate}%</ThemedText>
            <ThemedText style={styles.statLabel}>Tỷ lệ dự đoán đúng</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{stats.averageAccuracy}%</ThemedText>
            <ThemedText style={styles.statLabel}>Độ tin cậy TB</ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.controlsContainer}>
        <View style={styles.toggleContainer}>
          <ThemedText style={styles.toggleLabel}>Hiển thị kết quả cược:</ThemedText>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: showBettingResults ? colors.tint : colors.border }
            ]}
            onPress={() => setShowBettingResults(!showBettingResults)}
          >
            <ThemedText 
              style={[
                styles.toggleText,
                { color: showBettingResults ? '#FFFFFF' : colors.text }
              ]}
            >
              {showBettingResults ? 'BẬT' : 'TẮT'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

      <ThemedView style={styles.filtersContainer}>
        <FlatList
          data={filters}
          renderItem={renderFilter}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </ThemedView>

      <FlatList
        data={filteredMatches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id}
        style={styles.matchesList}
        contentContainerStyle={styles.matchesContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              Không có trận đấu nào trong danh mục này
            </ThemedText>
          </View>
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
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
    textAlign: 'center',
  },
  controlsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  filtersContainer: {
    paddingBottom: 8,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  matchesList: {
    flex: 1,
  },
  matchesContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
  },
});