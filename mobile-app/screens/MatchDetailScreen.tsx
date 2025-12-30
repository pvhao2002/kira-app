import React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MatchCard } from '@/components/MatchCard';
import { BettingOddsDisplay } from '@/components/BettingOddsDisplay';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { getMatchById } from '@/services/mockData';
import { Match } from '@/types';

interface MatchDetailScreenProps {
  route: {
    params: {
      matchId: string;
    };
  };
}

export default function MatchDetailScreen({ route }: MatchDetailScreenProps) {
  const { matchId } = route.params;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const match = getMatchById(matchId);

  if (!match) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            Không tìm thấy thông tin trận đấu
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Chi tiết trận đấu
          </ThemedText>
          <ThemedText style={styles.matchTime}>
            {formatDate(match.startTime)}
          </ThemedText>
        </ThemedView>

        <View style={styles.matchCardContainer}>
          <MatchCard match={match} />
        </View>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Thông tin trận đấu
          </ThemedText>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>Giải đấu</ThemedText>
              <ThemedText style={styles.infoValue}>{match.league}</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>Sân vận động</ThemedText>
              <ThemedText style={styles.infoValue}>{match.venue}</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>Trạng thái</ThemedText>
              <ThemedText style={[styles.infoValue, { color: getStatusColor(match.status) }]}>
                {getStatusText(match.status)}
              </ThemedText>
            </View>
            {match.score && (
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Tỷ số</ThemedText>
                <ThemedText style={styles.scoreText}>
                  {match.score.home} - {match.score.away}
                </ThemedText>
              </View>
            )}
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <BettingOddsDisplay odds={match.odds} showTitle={true} compact={false} />
        </ThemedView>

        {match.prediction && (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Phân tích và dự đoán
            </ThemedText>
            <View style={[styles.predictionCard, { backgroundColor: colors.background }]}>
              <View style={styles.predictionHeader}>
                <ThemedText style={styles.predictionTitle}>Dự đoán AI</ThemedText>
                <View style={[styles.accuracyBadge, { backgroundColor: colors.tint }]}>
                  <ThemedText style={[styles.accuracyText, { color: '#FFFFFF' }]}>
                    {match.prediction.accuracy}%
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.recommendation}>
                Khuyến nghị: {match.prediction.recommendation}
              </ThemedText>
              <ThemedText style={styles.analysis}>
                {match.prediction.analysis}
              </ThemedText>
            </View>
          </ThemedView>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'live':
      return '#FF4444';
    case 'scheduled':
      return '#4CAF50';
    case 'finished':
      return '#757575';
    default:
      return '#757575';
  }
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'live':
      return 'TRỰC TIẾP';
    case 'scheduled':
      return 'SẮP DIỄN RA';
    case 'finished':
      return 'KẾT THÚC';
    default:
      return status.toUpperCase();
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
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
  matchTime: {
    fontSize: 16,
    opacity: 0.7,
  },
  matchCardContainer: {
    paddingHorizontal: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  predictionCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  predictionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  accuracyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  accuracyText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  recommendation: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  analysis: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  bottomSpacing: {
    height: 32,
  },
});