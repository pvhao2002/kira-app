import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BettingOddsDisplay } from '@/components/BettingOddsDisplay';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Match } from '@/types';

interface MatchCardProps {
  match: Match;
  onPress?: (match: Match) => void;
}

export function MatchCard({ match, onPress }: MatchCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  const CardContent = () => (
    <View style={[styles.matchCard, { backgroundColor: colors.background }]}>
      <View style={styles.matchHeader}>
        <View style={styles.leagueInfo}>
          <ThemedText style={styles.leagueName}>{match.league}</ThemedText>
          <ThemedText style={styles.venue}>{match.venue}</ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(match.status) }]}>
          <ThemedText style={styles.statusText}>
            {getStatusText(match.status)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.teamsContainer}>
        <View style={styles.team}>
          <ThemedText style={styles.teamLogo}>{match.homeTeam.logo}</ThemedText>
          <ThemedText style={styles.teamName}>{match.homeTeam.name}</ThemedText>
          <ThemedText style={styles.teamCountry}>{match.homeTeam.country}</ThemedText>
        </View>
        
        <View style={styles.vsContainer}>
          {match.status === 'finished' && match.score ? (
            <View style={styles.scoreContainer}>
              <ThemedText style={styles.scoreText}>
                {match.score.home} - {match.score.away}
              </ThemedText>
              <ThemedText style={styles.finalText}>KẾT THÚC</ThemedText>
            </View>
          ) : match.status === 'live' && match.score ? (
            <View style={styles.scoreContainer}>
              <ThemedText style={styles.scoreText}>
                {match.score.home} - {match.score.away}
              </ThemedText>
              <ThemedText style={[styles.liveText, { color: getStatusColor('live') }]}>
                TRỰC TIẾP
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedText style={styles.vsText}>VS</ThemedText>
              <ThemedText style={styles.matchTime}>
                {formatDate(match.startTime)}
              </ThemedText>
            </>
          )}
        </View>
        
        <View style={styles.team}>
          <ThemedText style={styles.teamLogo}>{match.awayTeam.logo}</ThemedText>
          <ThemedText style={styles.teamName}>{match.awayTeam.name}</ThemedText>
          <ThemedText style={styles.teamCountry}>{match.awayTeam.country}</ThemedText>
        </View>
      </View>

      <BettingOddsDisplay odds={match.odds} showTitle={false} compact={true} />

      {match.prediction && (
        <View style={styles.predictionContainer}>
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
  matchCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  venue: {
    fontSize: 12,
    opacity: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  team: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    fontSize: 32,
    marginBottom: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  teamCountry: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
  vsContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  matchTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  finalText: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: '600',
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  predictionContainer: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  accuracyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  recommendation: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  analysis: {
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 16,
  },
});