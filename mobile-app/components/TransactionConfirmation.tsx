import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Card, TransactionFormData, Transaction } from '@/types';
import { formatVND } from '@/utils/currency';

interface TransactionConfirmationProps {
  selectedCard: Card;
  transactionData: TransactionFormData;
  onConfirm: (transaction: Transaction) => void;
  onCancel: () => void;
  onEdit: () => void;
}

export default function TransactionConfirmation({ 
  selectedCard, 
  transactionData, 
  onConfirm, 
  onCancel, 
  onEdit 
}: TransactionConfirmationProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate transaction processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create transaction object
      const transaction: Transaction = {
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cardId: transactionData.cardId,
        type: 'debit',
        amount: transactionData.amount,
        currency: 'VND',
        description: transactionData.description,
        timestamp: new Date(),
        status: 'completed',
        reference: `REF${Date.now()}`,
      };

      onConfirm(transaction);
    } catch {
      Alert.alert(
        'Lỗi giao dịch',
        'Có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Xác nhận giao dịch
      </ThemedText>
      
      <ThemedText style={styles.subtitle}>
        Vui lòng kiểm tra thông tin giao dịch trước khi xác nhận
      </ThemedText>

      {/* Transaction Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
        <ThemedText type="subtitle" style={styles.summaryTitle}>
          Thông tin giao dịch
        </ThemedText>

        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Từ thẻ:</ThemedText>
          <View style={styles.summaryValueContainer}>
            <ThemedText style={styles.summaryValue}>
              {selectedCard.bankName}
            </ThemedText>
            <ThemedText style={[styles.summarySubValue, { fontFamily: 'monospace' }]}>
              {selectedCard.cardNumber}
            </ThemedText>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Số tiền:</ThemedText>
          <ThemedText style={[styles.summaryValue, styles.amountValue]}>
            {formatVND(transactionData.amount)}
          </ThemedText>
        </View>

        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Nội dung:</ThemedText>
          <ThemedText style={[styles.summaryValue, styles.descriptionValue]}>
            {transactionData.description}
          </ThemedText>
        </View>

        {transactionData.recipient && (
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Người nhận:</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {transactionData.recipient}
            </ThemedText>
          </View>
        )}

        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Thời gian:</ThemedText>
          <ThemedText style={styles.summaryValue}>
            {formatDateTime(new Date())}
          </ThemedText>
        </View>

        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Phí giao dịch:</ThemedText>
          <ThemedText style={[styles.summaryValue, { color: '#4CAF50' }]}>
            Miễn phí
          </ThemedText>
        </View>
      </View>

      {/* Balance Information */}
      <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
        <View style={styles.balanceRow}>
          <ThemedText style={styles.balanceLabel}>Số dư hiện tại:</ThemedText>
          <ThemedText style={styles.balanceValue}>
            {formatVND(selectedCard.balance)}
          </ThemedText>
        </View>
        
        <View style={styles.balanceRow}>
          <ThemedText style={styles.balanceLabel}>Số dư sau giao dịch:</ThemedText>
          <ThemedText style={[
            styles.balanceValue,
            { color: selectedCard.balance - transactionData.amount >= 0 ? '#4CAF50' : '#F44336' }
          ]}>
            {formatVND(selectedCard.balance - transactionData.amount)}
          </ThemedText>
        </View>
      </View>

      {/* Warning if balance is low */}
      {selectedCard.balance - transactionData.amount < 100000 && (
        <View style={[styles.warningCard, { backgroundColor: '#FFF3E0' }]}>
          <ThemedText style={[styles.warningText, { color: '#F57C00' }]}>
            ⚠️ Cảnh báo: Số dư sau giao dịch sẽ thấp hơn 100.000 VND
          </ThemedText>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
          disabled={isProcessing}
        >
          <ThemedText style={[styles.buttonText, { color: colors.text }]}>
            Hủy
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.editButton, { backgroundColor: colors.card, borderColor: colors.tint }]}
          onPress={onEdit}
          disabled={isProcessing}
        >
          <ThemedText style={[styles.buttonText, { color: colors.tint }]}>
            Sửa
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.confirmButton,
            { backgroundColor: colors.tint },
            isProcessing && styles.disabledButton
          ]}
          onPress={handleConfirm}
          disabled={isProcessing}
        >
          <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
            {isProcessing ? 'Đang xử lý...' : 'Xác nhận'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <ThemedText style={styles.securityText}>
          🔒 Giao dịch được bảo mật bằng công nghệ mã hóa 256-bit
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    color: 'rgba(0,0,0,0.7)',
  },
  summaryValueContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  summaryValue: {
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
  },
  summarySubValue: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'right',
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
  balanceCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
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
  cancelButton: {
    borderWidth: 1,
  },
  editButton: {
    borderWidth: 1,
  },
  confirmButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  securityNotice: {
    alignItems: 'center',
    marginTop: 8,
  },
  securityText: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
});