import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import CardComponent from '@/components/CardComponent';
import TransactionScreen from '@/screens/TransactionScreen';
import { Card, Transaction } from '@/types';

export default function CardManagementScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [selectedCardId, setSelectedCardId] = useState<string>('card-1');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  // Mock card data - in a real app, this would come from a service/API
  const mockCards: Card[] = [
    {
      id: 'card-1',
      type: 'debit',
      bankName: 'Vietcombank',
      cardNumber: '**** **** **** 1234',
      holderName: 'Nguyen Van A',
      balance: 15750000,
      currency: 'VND',
      expiryDate: new Date(2026, 11, 31), // December 2026
      isActive: true,
    },
    {
      id: 'card-2',
      type: 'credit',
      bankName: 'Techcombank',
      cardNumber: '**** **** **** 5678',
      holderName: 'Nguyen Van A',
      balance: 8500000,
      currency: 'VND',
      expiryDate: new Date(2025, 8, 30), // September 2025
      isActive: true,
    },
    {
      id: 'card-3',
      type: 'banking',
      bankName: 'BIDV',
      cardNumber: '**** **** **** 9012',
      holderName: 'Nguyen Van A',
      balance: 2300000,
      currency: 'VND',
      expiryDate: new Date(2024, 5, 30), // June 2024 (expired)
      isActive: false,
    },
  ];

  const selectedCard = mockCards.find(card => card.id === selectedCardId) || mockCards[0];

  const handleCardSelect = (cardId: string) => {
    setSelectedCardId(cardId);
  };

  const handleTransactionPress = () => {
    setShowTransactionModal(true);
  };

  const handleTopUpPress = () => {
    // TODO: Navigate to top-up screen
    console.log('Navigate to top-up screen');
  };

  const handleTransactionComplete = (transaction: Transaction) => {
    // Add the new transaction to recent transactions
    setRecentTransactions(prev => [transaction, ...prev.slice(0, 4)]);
    
    // Update the selected card balance (in a real app, this would come from the backend)
    // For now, we'll just log it
    console.log('Transaction completed:', transaction);
  };

  const handleCloseTransactionModal = () => {
    setShowTransactionModal(false);
  };

  const handleViewTransactionHistory = () => {
    // TODO: Navigate to transaction history screen
    console.log('Navigate to transaction history');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Quản lý thẻ
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Xem và quản lý các thẻ tài chính của bạn
          </ThemedText>
        </ThemedView>

        {/* Primary Card Display */}
        <ThemedView style={styles.primaryCardContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Thẻ chính
          </ThemedText>
          
          <CardComponent 
            card={selectedCard} 
            onPress={() => console.log('Card pressed:', selectedCard.id)}
          />
        </ThemedView>

        {/* Other Cards */}
        {mockCards.length > 1 && (
          <ThemedView style={styles.otherCardsContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Thẻ khác ({mockCards.length - 1})
            </ThemedText>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalCardScroll}
            >
              {mockCards
                .filter(card => card.id !== selectedCardId)
                .map((card) => (
                  <CardComponent
                    key={card.id}
                    card={card}
                    onPress={() => handleCardSelect(card.id)}
                    style={styles.horizontalCard}
                  />
                ))}
            </ScrollView>
          </ThemedView>
        )}

        {/* Quick Actions */}
        <ThemedView style={styles.actionsContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Thao tác nhanh
          </ThemedText>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.tint }]}
              onPress={handleTransactionPress}
              activeOpacity={0.8}
            >
              <ThemedText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                💸 Chuyển tiền
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.tint }]}
              onPress={handleTopUpPress}
              activeOpacity={0.8}
            >
              <ThemedText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                💰 Nạp tiền
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        {/* Card Information */}
        <ThemedView style={styles.infoContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Thông tin thẻ
          </ThemedText>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Loại thẻ:</ThemedText>
              <ThemedText style={styles.infoValue}>
                {selectedCard.type === 'credit' ? 'Thẻ tín dụng' : 
                 selectedCard.type === 'debit' ? 'Thẻ ghi nợ' : 'Thẻ ngân hàng'}
              </ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Ngân hàng:</ThemedText>
              <ThemedText style={styles.infoValue}>{selectedCard.bankName}</ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Trạng thái:</ThemedText>
              <ThemedText style={[
                styles.infoValue, 
                { color: selectedCard.isActive ? '#4CAF50' : '#F44336' }
              ]}>
                {selectedCard.isActive ? 'Hoạt động' : 'Tạm khóa'}
              </ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Số thẻ:</ThemedText>
              <ThemedText style={[styles.infoValue, { fontFamily: 'monospace' }]}>
                {selectedCard.cardNumber}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <ThemedView style={styles.recentTransactionsContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Giao dịch gần đây
            </ThemedText>
            
            {recentTransactions.slice(0, 3).map((transaction) => (
              <View key={transaction.id} style={[styles.transactionItem, { backgroundColor: colors.card }]}>
                <View style={styles.transactionInfo}>
                  <ThemedText style={styles.transactionDescription}>
                    {transaction.description}
                  </ThemedText>
                  <ThemedText style={styles.transactionTime}>
                    {transaction.timestamp.toLocaleString('vi-VN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </ThemedText>
                </View>
                <View style={styles.transactionAmount}>
                  <ThemedText style={[
                    styles.transactionAmountText,
                    { color: transaction.type === 'credit' ? '#4CAF50' : '#F44336' }
                  ]}>
                    {transaction.type === 'credit' ? '+' : '-'}{transaction.amount.toLocaleString('vi-VN')} VND
                  </ThemedText>
                  <View style={[
                    styles.transactionStatus,
                    { backgroundColor: transaction.status === 'completed' ? '#4CAF50' : '#FF9800' }
                  ]}>
                    <ThemedText style={styles.transactionStatusText}>
                      {transaction.status === 'completed' ? 'Thành công' : 'Đang xử lý'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}
            
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={handleViewTransactionHistory}
            >
              <ThemedText style={[styles.viewAllText, { color: colors.tint }]}>
                Xem tất cả giao dịch →
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </ScrollView>

      {/* Transaction Modal */}
      <Modal
        visible={showTransactionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseTransactionModal}
      >
        <TransactionScreen
          selectedCard={selectedCard}
          onClose={handleCloseTransactionModal}
          onTransactionComplete={handleTransactionComplete}
          onViewHistory={handleViewTransactionHistory}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
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
  primaryCardContainer: {
    marginBottom: 24,
  },
  otherCardsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  horizontalCardScroll: {
    paddingLeft: 4,
  },
  horizontalCard: {
    width: 280,
    marginRight: 16,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    textAlign: 'right',
    flex: 1,
  },
  recentTransactionsContainer: {
    marginBottom: 24,
  },
  transactionItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  transactionStatusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  viewAllButton: {
    padding: 12,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
});