import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Transaction } from '@/types';
import { formatVND } from '@/utils/currency';

interface TransactionSuccessProps {
  transaction: Transaction;
  onDone: () => void;
  onViewHistory: () => void;
}

export default function TransactionSuccess({ 
  transaction, 
  onDone, 
  onViewHistory 
}: TransactionSuccessProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <ThemedView style={styles.container}>
      {/* Success Icon */}
      <View style={styles.iconContainer}>
        <View style={[styles.successIcon, { backgroundColor: '#4CAF50' }]}>
          <ThemedText style={styles.checkmark}>✓</ThemedText>
        </View>
      </View>

      {/* Success Message */}
      <ThemedText type="title" style={styles.title}>
        Giao dịch thành công!
      </ThemedText>
      
      <ThemedText style={styles.subtitle}>
        Giao dịch của bạn đã được xử lý thành công
      </ThemedText>

      {/* Transaction Details Card */}
      <View style={[styles.detailsCard, { backgroundColor: colors.card }]}>
        <ThemedText type="subtitle" style={styles.detailsTitle}>
          Chi tiết giao dịch
        </ThemedText>

        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Mã giao dịch:</ThemedText>
          <ThemedText style={[styles.detailValue, { fontFamily: 'monospace' }]}>
            {transaction.reference}
          </ThemedText>
        </View>

        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Số tiền:</ThemedText>
          <ThemedText style={[styles.detailValue, styles.amountValue]}>
            -{formatVND(transaction.amount)}
          </ThemedText>
        </View>

        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Nội dung:</ThemedText>
          <ThemedText style={[styles.detailValue, styles.descriptionValue]}>
            {transaction.description}
          </ThemedText>
        </View>

        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Thời gian:</ThemedText>
          <ThemedText style={styles.detailValue}>
            {formatDateTime(transaction.timestamp)}
          </ThemedText>
        </View>

        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Trạng thái:</ThemedText>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <ThemedText style={[styles.detailValue, { color: '#4CAF50' }]}>
              Thành công
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Additional Information */}
      <View style={[styles.infoCard, { backgroundColor: '#E8F5E8' }]}>
        <ThemedText style={[styles.infoText, { color: '#2E7D32' }]}>
          💡 Giao dịch đã được ghi nhận vào lịch sử. Bạn có thể xem chi tiết trong mục &quot;Lịch sử giao dịch&quot;.
        </ThemedText>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, { borderColor: colors.tint }]}
          onPress={onViewHistory}
        >
          <ThemedText style={[styles.buttonText, { color: colors.tint }]}>
            Xem lịch sử
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton, { backgroundColor: colors.tint }]}
          onPress={onDone}
        >
          <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
            Hoàn tất
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Receipt Option */}
      <TouchableOpacity style={styles.receiptButton}>
        <ThemedText style={[styles.receiptText, { color: colors.tint }]}>
          📄 Tải biên lai giao dịch
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  checkmark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 32,
    textAlign: 'center',
  },
  detailsCard: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    color: 'rgba(0,0,0,0.7)',
  },
  detailValue: {
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  descriptionValue: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  infoCard: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  receiptButton: {
    padding: 12,
  },
  receiptText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});