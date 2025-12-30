import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BettingOdds } from '@/types';

interface BettingOddsDisplayProps {
  odds: BettingOdds;
  showTitle?: boolean;
  compact?: boolean;
}

export function BettingOddsDisplay({ odds, showTitle = true, compact = false }: BettingOddsDisplayProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatOdds = (oddsArray: number[]): string => {
    return oddsArray.map(odd => odd.toFixed(2)).join(' - ');
  };

  const getMarketLabel = (market: string): string => {
    const labels: { [key: string]: string } = {
      oneXTwo: '1X2',
      overUnder: 'Tài/Xỉu',
      handicap: 'Handicap',
      corners: 'Phạt góc',
    };
    return labels[market] || market;
  };

  const getMarketDescription = (market: string): string => {
    const descriptions: { [key: string]: string } = {
      oneXTwo: 'Chủ nhà thắng - Hòa - Khách thắng',
      overUnder: 'Tài (Over) - Xỉu (Under)',
      handicap: 'Chấp trên - Chấp dưới',
      corners: 'Tài phạt góc - Xỉu phạt góc',
    };
    return descriptions[market] || '';
  };

  const markets = [
    { key: 'oneXTwo', values: odds.oneXTwo },
    { key: 'overUnder', values: odds.overUnder },
    { key: 'handicap', values: odds.handicap },
    { key: 'corners', values: odds.corners },
  ];

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {showTitle && (
          <ThemedText style={styles.compactTitle}>Tỷ lệ cược</ThemedText>
        )}
        <View style={styles.compactRow}>
          {markets.map((market) => (
            <View key={market.key} style={[styles.compactOddItem, { backgroundColor: colors.background }]}>
              <ThemedText style={styles.compactOddLabel}>
                {getMarketLabel(market.key)}
              </ThemedText>
              <ThemedText style={styles.compactOddValue}>
                {formatOdds(market.values)}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showTitle && (
        <ThemedText style={styles.title}>Tỷ lệ cược chi tiết</ThemedText>
      )}
      
      <View style={styles.marketsContainer}>
        {markets.map((market) => (
          <View key={market.key} style={[styles.marketCard, { backgroundColor: colors.background }]}>
            <View style={styles.marketHeader}>
              <ThemedText style={styles.marketLabel}>
                {getMarketLabel(market.key)}
              </ThemedText>
              <ThemedText style={styles.marketDescription}>
                {getMarketDescription(market.key)}
              </ThemedText>
            </View>
            
            <View style={styles.oddsRow}>
              {market.values.map((odd, index) => (
                <View key={index} style={[styles.oddButton, { borderColor: colors.border }]}>
                  <ThemedText style={styles.oddValue}>
                    {odd.toFixed(2)}
                  </ThemedText>
                  {market.key === 'oneXTwo' && (
                    <ThemedText style={styles.oddSubLabel}>
                      {index === 0 ? 'Chủ' : index === 1 ? 'Hòa' : 'Khách'}
                    </ThemedText>
                  )}
                  {market.key === 'overUnder' && (
                    <ThemedText style={styles.oddSubLabel}>
                      {index === 0 ? 'Tài' : 'Xỉu'}
                    </ThemedText>
                  )}
                  {market.key === 'handicap' && (
                    <ThemedText style={styles.oddSubLabel}>
                      {index === 0 ? 'Trên' : 'Dưới'}
                    </ThemedText>
                  )}
                  {market.key === 'corners' && (
                    <ThemedText style={styles.oddSubLabel}>
                      {index === 0 ? 'Tài' : 'Xỉu'}
                    </ThemedText>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  marketsContainer: {
    gap: 12,
  },
  marketCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  marketHeader: {
    marginBottom: 12,
  },
  marketLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  marketDescription: {
    fontSize: 12,
    opacity: 0.6,
  },
  oddsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  oddButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F8F9FA',
  },
  oddValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  oddSubLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  // Compact styles
  compactContainer: {
    marginBottom: 16,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  compactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactOddItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  compactOddLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  compactOddValue: {
    fontSize: 12,
    fontWeight: '600',
  },
});