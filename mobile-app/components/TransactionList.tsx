import React from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { formatVND } from '@/utils/currency';
import { Transaction } from '@/types';

interface TransactionListProps {
  transactions: Transaction[];
  onTransactionPress?: (transaction: Transaction) => void;
  showCardInfo?: boolean;
  emptyMessage?: string;
}

export default function TransactionList({ 
  transactions, 
  onTransactionPress,
  showCardInfo = false,
  emptyMessage = 'Không có giao dịch nào'
}: TransactionListProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusText = (status: Transaction['status']): string => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'pending':
        return 'Đang xử lý';
      case 'failed':
        return 'Thất bại';
      default:
        return 'Không xác định';
    }
  };

  const getStatusColor = (status: Transaction['status']): string => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    const amountColor = isCredit ? '#4CAF50' : '#F44336';
    const prefix = isCredit ? '+' : '-';

    return (
      <TouchableOpacity
        style={[styles.transactionItem, { backgroundColor: colors.background }]}
        onPress={() => onTransactionPress?.(item)}
        activeOpacity={0.7}
      >
        <View style={styles.transactionHeader}>
          <View style={styles.transactionInfo}>
            <ThemedText style={styles.transactionDescription}>
              {item.description}
            </ThemedText>
            {item.reference && (
              <ThemedText style={styles.transactionReference}>
                Ref: {item.reference}
              </ThemedText>
            )}
          </View>
          <ThemedText style={[styles.transactionAmount, { color: amountColor }]}>
            {prefix}{formatVND(item.amount)}
          </ThemedText>
        </View>
        
        <View style={styles.transactionFooter}>
          <View style={styles.transactionMeta}>
            <ThemedText style={styles.transactionId}>
              ID: {item.id}
            </ThemedText>
            <ThemedText style={styles.transactionDate}>
              {formatDate(item.timestamp)}
            </ThemedText>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) }
          ]}>
            <ThemedText style={styles.statusText}>
              {getStatusText(item.status)}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <ThemedView style={styles.emptyContainer}>
      <ThemedText style={styles.emptyText}>
        {emptyMessage}
      </ThemedText>
    </ThemedView>
  );

  if (transactions.length === 0) {
    return renderEmptyState();
  }

  return (
    <FlatList
      data={transactions}
      renderItem={renderTransaction}
      keyExtractor={(item) => item.id}
      style={styles.transactionList}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.listContainer}
    />
  );
}

const styles = StyleSheet.create({
  transactionList: {
    flex: 1,
  },
  listContainer: {
    paddingVertical: 8,
  },
  transactionItem: {
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionReference: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionMeta: {
    flex: 1,
  },
  transactionId: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
  },
});