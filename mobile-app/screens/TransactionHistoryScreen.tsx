import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TransactionList from '@/components/TransactionList';
import TransactionsByCard from '@/components/TransactionsByCard';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { formatVND } from '@/utils/currency';
import { Transaction, Card } from '@/types';
import { mockTransactions, mockCards } from '@/services/mockData';

export default function TransactionHistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(mockTransactions);
  const [activeFilter, setActiveFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  const handleFilterChange = (filter: 'all' | 'credit' | 'debit') => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setFilteredTransactions(mockTransactions);
    } else {
      setFilteredTransactions(mockTransactions.filter(t => t.type === filter));
    }
  };

  const handleTransactionPress = (transaction: Transaction) => {
    // TODO: Navigate to transaction detail screen
    console.log('Transaction pressed:', transaction.id);
  };

  const handleCardPress = (card: Card) => {
    // TODO: Navigate to card detail screen or perform card action
    console.log('Card pressed:', card.id);
  };

  // Calculate summary statistics
  const monthlyIncome = mockTransactions
    .filter(t => t.type === 'credit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const monthlyExpenses = mockTransactions
    .filter(t => t.type === 'debit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Lịch sử giao dịch
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Xem tất cả các giao dịch của bạn
        </ThemedText>
      </ThemedView>

      {/* View Mode Toggle */}
      <ThemedView style={styles.viewModeContainer}>
        <View style={styles.viewModeButtons}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'list' && { backgroundColor: colors.tint }
            ]}
            onPress={() => setViewMode('list')}
          >
            <ThemedText style={[
              styles.viewModeButtonText,
              viewMode === 'list' && { color: '#FFFFFF' }
            ]}>
              📋 Danh sách
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'cards' && { backgroundColor: colors.tint }
            ]}
            onPress={() => setViewMode('cards')}
          >
            <ThemedText style={[
              styles.viewModeButtonText,
              viewMode === 'cards' && { color: '#FFFFFF' }
            ]}>
              💳 Theo thẻ
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

      {viewMode === 'list' ? (
        <>
          <ThemedView style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryLabel}>Thu nhập tháng này</ThemedText>
                <ThemedText style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  +{formatVND(monthlyIncome)}
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryLabel}>Chi tiêu tháng này</ThemedText>
                <ThemedText style={[styles.summaryValue, { color: '#F44336' }]}>
                  -{formatVND(monthlyExpenses)}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          <ThemedView style={styles.filterContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Giao dịch gần đây
            </ThemedText>
            <View style={styles.filterButtons}>
              <TouchableOpacity 
                style={[
                  styles.filterButton, 
                  activeFilter === 'all' && { backgroundColor: colors.tint }
                ]}
                onPress={() => handleFilterChange('all')}
              >
                <ThemedText style={[
                  styles.filterButtonText,
                  activeFilter === 'all' && { color: '#FFFFFF' }
                ]}>
                  Tất cả
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterButton,
                  activeFilter === 'credit' && { backgroundColor: colors.tint }
                ]}
                onPress={() => handleFilterChange('credit')}
              >
                <ThemedText style={[
                  styles.filterButtonText,
                  activeFilter === 'credit' && { color: '#FFFFFF' }
                ]}>
                  Thu nhập
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterButton,
                  activeFilter === 'debit' && { backgroundColor: colors.tint }
                ]}
                onPress={() => handleFilterChange('debit')}
              >
                <ThemedText style={[
                  styles.filterButtonText,
                  activeFilter === 'debit' && { color: '#FFFFFF' }
                ]}>
                  Chi tiêu
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>

          <TransactionList
            transactions={filteredTransactions}
            onTransactionPress={handleTransactionPress}
            emptyMessage="Không có giao dịch nào phù hợp với bộ lọc"
          />
        </>
      ) : (
        <TransactionsByCard
          cards={mockCards}
          transactions={mockTransactions}
          onTransactionPress={handleTransactionPress}
          onCardPress={handleCardPress}
        />
      )}
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
  viewModeContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  viewModeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  viewModeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryContainer: {
    padding: 16,
    paddingTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterContainer: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});