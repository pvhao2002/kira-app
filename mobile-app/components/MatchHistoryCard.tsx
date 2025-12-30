import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Match } from '@/types';

interface MatchHistoryCardProps {
  match: Match;
  onPress?: (match: Match) => void;
  showBettingResult?: boolean;
}

export function MatchHistoryCard({ match, onPress, showBettingResult = false }: MatchHistoryCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getResultColor = (homeScore: number, awayScore: number, isHome: boolean): string => {
    if (homeScore === awayScore) return '#FFA500'; // Orange for draw
    if ((homeScore > awayScore && isHome) || (awayScore > homeScore && !isHome)) {
      return '#4CAF50'; // Green for win
    }
    return '#FF4444'; // Red for loss
  };

  const getResultText = (homeScore: number, awayScore: number): string => {
    if (homeScore === awayScore) return 'HÒA';
    return homeScore > awayScore ? 'THẮNG' : 'THUA';
  };

  const getBettingResultText = (match: Match): string => {
    if (!match.prediction || !match.score) return '';
    
    const { recommendation } = match.prediction;
    const { home, away } = match.score;
    
    // Simple betting result logic based on recommendation
    if (recommendation.includes('Chủ nhà thắng') && home > away) {
      return 'THẮNG CƯỢC';
    } else if (recommendation.includes('Khách thắng') && away > home) {
      return 'THẮNG CƯỢC';
    } else if (recommendation.includes('Hòa') && home === away) {
      return 'THẮNG CƯỢC';
    } else if (recommendation.includes('Tài') && (home + away) > 2.5) {
      return 'THẮNG CƯỢC';
    } else if (recommendation.includes('Xỉu') && (home + away) < 2.5) {
      return 'THẮNG CƯỢC';
    } else {
      return 'THUA CƯỢC';
    }
  };

  const getBettingResultColor = (resultText: string): string => {
    return resultText === 'THẮNG CƯỢC' ? '#4CAF50' : '#FF4444';
  };

  const CardContent = () => (
    <View style={[styles.card, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.leagueInfo}>
          <ThemedText style={styles.league}>{match.league}</ThemedText>
          <ThemedText style={styles.venue}>{match.venue}</ThemedText>
        </View>
        <View style={styles.dateInfo}>
          <ThemedText style={styles.date}>{formatDate(match.startTime)}</ThemedText>
          <ThemedText style={styles.time}>{formatTime(match.startTime)}</ThemedText>
        </View>
      </View>

      <View style={styles.matchInfo}>
        <View style={styles.teamSection}>
          <View style={styles.team}>
            <ThemedText style={styles.teamLogo}>{match.homeTeam.logo}</ThemedText>
            <ThemedText style={styles.teamName}>{match.homeTeam.name}</ThemedText>
          </View>
          
          <View style={styles.scoreSection}>
            {match.score ? (
              <>
                <View style={styles.scoreContainer}>
                  <ThemedText style={styles.score}>
                    {match.score.home} - {match.score.away}
                  </ThemedText>
                </View>
                <View style={[
                  styles.resultBadge, 
                  { backgroundColor: getResultColor(match.score.home, match.score.away, true) }
                ]}>
                  <ThemedText style={styles.resultText}>
                    {getResultText(match.score.home, match.score.away)}
                  </ThemedText>
                </View>
              </>
            ) : (
              <ThemedText style={styles.noScore}>Chưa có kết quả</ThemedText>
            )}
          </View>
          
          <View style={styles.team}>
            <ThemedText style={styles.teamLogo}>{match.awayTeam.logo}</ThemedText>
            <ThemedText style={styles.teamName}>{match.awayTeam.name}</ThemedText>
          </View>
        </View>
      </View>

      {match.prediction && (
        <View style={styles.predictionSection}>
          <View style={styles.predictionInfo}>
            <ThemedText style={styles.predictionLabel}>Dự đoán:</ThemedText>
            <ThemedText style={styles.predictionValue}>
              {match.prediction.recommendation}
            </ThemedText>
            <View style={[styles.accuracyBadge, { backgroundColor: colors.tint }]}>
              <ThemedText style={[styles.accuracyText, { color: '#FFFFFF' }]}>
                {match.prediction.accuracy}%
              </ThemedText>
            </View>
          </View>
          
          {showBettingResult && match.score && (
            <View style={styles.bettingResult}>
              <ThemedText 
                style={[
                  styles.bettingResultText,
                  { color: getBettingResultColor(getBettingResultText(match)) }
                ]}
              >
                {getBettingResultText(match)}
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={() => onPress(match)} activeOpacity={0.7}>
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leagueInfo: {
    flex: 1,
  },
  league: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  venue: {
    fontSize: 12,
    opacity: 0.6,
  },
  dateInfo: {
    alignItems: 'flex-end',
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    opacity: 0.6,
  },
  matchInfo: {
    marginBottom: 16,
  },
  teamSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  team: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    fontSize: 24,
    marginBottom: 6,
  },
  teamName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  scoreSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scoreContainer: {
    marginBottom: 8,
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  noScore: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  predictionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  predictionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  predictionLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  predictionValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  accuracyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  accuracyText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bettingResult: {
    alignItems: 'flex-end',
  },
  bettingResultText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});