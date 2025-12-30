import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TransactionList from '@/components/TransactionList';
import CardComponent from '@/components/CardComponent';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Card, Transaction } from '@/types';
import { formatVND } from '@/utils/currency';

interface TransactionsByCardProps {
  cards: Card[];
  transactions: Transaction[];
  onTransactionPress?: (transaction: Transaction) => void;
  onCardPress?: (card: Card) => void;
}

export default function TransactionsByCard({
  cards,
  transactions,
  onTransactionPress,
  onCardPress
}: TransactionsByCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Group transactions by card
  const transactionsByCard = transactions.reduce((groups, transaction) => {
    const cardId = transaction.cardId;
    if (!groups[cardId]) {
      groups[cardId] = [];
    }
    groups[cardId].push(transaction);
    return groups;
  }, {} as { [cardId: string]: Transaction[] });

  // Filter transactions based on search query
  const filteredTransactions = (cardTransactions: Transaction[]) => {
    if (!searchQuery.trim()) return cardTransactions;
    
    const lowercaseQuery = searchQuery.toLowerCase();
    return cardTransactions.filter(transaction => 
      transaction.description.toLowerCase().includes(lowercaseQuery) ||
      transaction.reference?.toLowerCase().includes(lowercaseQuery) ||
      transaction.id.toLowerCase().includes(lowercaseQuery)
    );
  };

  // Get card statistics
  const getCardStats = (cardId: string) => {
    const cardTransactions = transactionsByCard[cardId] || [];
    const completedTransactions = cardTransactions.filter(t => t.status === 'completed');
    
    const totalIncome = completedTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = completedTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalTransactions: cardTransactions.length,
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses
    };
  };

  const renderCardSection = (card: Card) => {
    const cardTransactions = transactionsByCard[card.id] || [];
    const filteredCardTransactions = filteredTransactions(cardTransactions);
    const stats = getCardStats(card.id);
    const isExpanded = selectedCardId === card.id;

    return (
      <ThemedView key={card.id} style={styles.cardSection}>
        {/* Card Header */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => {
            setSelectedCardId(isExpanded ? null : card.id);
            onCardPress?.(card);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.cardPreview}>
            <View style={styles.cardInfo}>
              <ThemedText style={styles.cardTitle}>
                {card.bankName} - {card.cardNumber}
              </ThemedText>
              <ThemedText style={styles.cardSubtitle}>
                {card.type === 'credit' ? 'Thẻ tín dụng' : 
                 card.type === 'debit' ? 'Thẻ ghi nợ' : 'Thẻ ngân hàng'}
              </ThemedText>
            </View>
            <View style={styles.cardStats}>
              <ThemedText style={styles.transactionCount}>
                {stats.totalTransactions} giao dịch
              </ThemedText>
              <ThemedText style={[
                styles.netAmount,
                { color: stats.netAmount >= 0 ? '#4CAF50' : '#F44336' }
              ]}>
                {stats.netAmount >= 0 ? '+' : ''}{formatVND(stats.netAmount)}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.expandIcon}>
            <ThemedText style={styles.expandIconText}>
              {isExpanded ? '▼' : '▶'}
            </ThemedText>
          </View>
        </TouchableOpacity>

        {/* Expanded Card Details */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Card Component */}
            <View style={styles.cardComponentContainer}>
              <CardComponent 
                card={card} 
                style={styles.miniCard}
              />
            </View>

            {/* Card Statistics */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Thu nhập</ThemedText>
                <ThemedText style={[styles.statValue, { color: '#4CAF50' }]}>
                  +{formatVND(stats.totalIncome)}
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Chi tiêu</ThemedText>
                <ThemedText style={[styles.statValue, { color: '#F44336' }]}>
                  -{formatVND(stats.totalExpenses)}
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Ròng</ThemedText>
                <ThemedText style={[
                  styles.statValue,
                  { color: stats.netAmount >= 0 ? '#4CAF50' : '#F44336' }
                ]}>
                  {stats.netAmount >= 0 ? '+' : ''}{formatVND(stats.netAmount)}
                </ThemedText>
              </View>
            </View>

            {/* Search Bar */}
            {showSearch && (
              <View style={styles.searchContainer}>
                <TextInput
                  style={[styles.searchInput, { 
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border
                  }]}
                  placeholder="Tìm kiếm giao dịch..."
                  placeholderTextColor={colors.text + '80'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Search Toggle */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.tint }]}
                onPress={() => setShowSearch(!showSearch)}
              >
                <ThemedText style={styles.actionButtonText}>
                  {showSearch ? 'Ẩn tìm kiếm' : 'Tìm kiếm'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Transaction List */}
            <View style={styles.transactionContainer}>
              <ThemedText style={styles.transactionSectionTitle}>
                Giao dịch ({filteredCardTransactions.length})
              </ThemedText>
              
              {filteredCardTransactions.length > 0 ? (
                <TransactionList
                  transactions={filteredCardTransactions}
                  onTransactionPress={onTransactionPress}
                  emptyMessage="Không có giao dịch nào phù hợp"
                />
              ) : (
                <ThemedView style={styles.emptyTransactions}>
                  <ThemedText style={styles.emptyText}>
                    {searchQuery ? 'Không tìm thấy giao dịch phù hợp' : 'Chưa có giao dịch nào'}
                  </ThemedText>
                </ThemedView>
              )}
            </View>
          </View>
        )}
      </ThemedView>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.title}>
          Giao dịch theo thẻ
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Xem giao dịch được nhóm theo từng thẻ
        </ThemedText>
      </ThemedView>

      {cards.map(renderCardSection)}
    </ScrollView>
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  cardSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPreview: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  cardStats: {
    alignItems: 'flex-end',
  },
  transactionCount: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  netAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  expandIcon: {
    marginLeft: 12,
    padding: 4,
  },
  expandIconText: {
    fontSize: 16,
    opacity: 0.6,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardComponentContainer: {
    marginBottom: 16,
  },
  miniCard: {
    marginBottom: 0,
    transform: [{ scale: 0.9 }],
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  transactionContainer: {
    flex: 1,
  },
  transactionSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyTransactions: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});