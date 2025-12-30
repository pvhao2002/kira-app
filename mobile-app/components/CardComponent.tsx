import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/types';
import { formatCardBalance } from '@/utils/currency';

interface CardComponentProps {
  card: Card;
  onPress?: () => void;
  style?: any;
}

const getBankColor = (bankName: string): string => {
  // Bank-specific colors for visual distinction
  const bankColors: { [key: string]: string } = {
    'Vietcombank': '#007AC2',
    'VietinBank': '#E31E24',
    'BIDV': '#1E88E5',
    'Agribank': '#4CAF50',
    'Techcombank': '#FF6B35',
    'MB Bank': '#9C27B0',
    'ACB': '#FF9800',
    'VPBank': '#795548',
    'Sacombank': '#607D8B',
    'default': '#0a7ea4'
  };
  
  return bankColors[bankName] || bankColors.default;
};

const getCardTypeIcon = (type: Card['type']): string => {
  switch (type) {
    case 'credit':
      return '💳';
    case 'debit':
      return '🏦';
    case 'banking':
      return '🏛️';
    default:
      return '💳';
  }
};

const getCardTypeName = (type: Card['type']): string => {
  switch (type) {
    case 'credit':
      return 'Thẻ tín dụng';
    case 'debit':
      return 'Thẻ ghi nợ';
    case 'banking':
      return 'Thẻ ngân hàng';
    default:
      return 'Thẻ';
  }
};

const formatExpiryDate = (date: Date): string => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${year}`;
};

export default function CardComponent({ card, onPress, style }: CardComponentProps) {
  const bankColor = getBankColor(card.bankName);

  const CardContent = () => (
    <View style={[
      styles.card, 
      { backgroundColor: bankColor },
      !card.isActive && styles.inactiveCard,
      style
    ]}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.bankInfo}>
          <ThemedText style={styles.bankName}>
            {card.bankName}
          </ThemedText>
          <ThemedText style={styles.cardType}>
            {getCardTypeIcon(card.type)} {getCardTypeName(card.type)}
          </ThemedText>
        </View>
        {!card.isActive && (
          <View style={styles.inactiveIndicator}>
            <ThemedText style={styles.inactiveText}>
              Không hoạt động
            </ThemedText>
          </View>
        )}
      </View>

      {/* Card Number */}
      <View style={styles.cardNumberContainer}>
        <ThemedText style={styles.cardNumber}>
          {card.cardNumber}
        </ThemedText>
      </View>

      {/* Card Details */}
      <View style={styles.cardDetails}>
        <View style={styles.cardDetailItem}>
          <ThemedText style={styles.cardDetailLabel}>
            Chủ thẻ
          </ThemedText>
          <ThemedText style={styles.cardHolder}>
            {card.holderName.toUpperCase()}
          </ThemedText>
        </View>
        
        <View style={styles.cardDetailItem}>
          <ThemedText style={styles.cardDetailLabel}>
            Hết hạn
          </ThemedText>
          <ThemedText style={styles.cardExpiry}>
            {formatExpiryDate(card.expiryDate)}
          </ThemedText>
        </View>
      </View>

      {/* Card Balance */}
      <View style={styles.balanceContainer}>
        <ThemedText style={styles.balanceLabel}>
          Số dư khả dụng
        </ThemedText>
        <ThemedText style={styles.balance}>
          {formatCardBalance(card.balance)}
        </ThemedText>
      </View>

      {/* Card Status Indicator */}
      <View style={styles.statusIndicator}>
        <View style={[
          styles.statusDot, 
          { backgroundColor: card.isActive ? '#4CAF50' : '#F44336' }
        ]} />
        <ThemedText style={styles.statusText}>
          {card.isActive ? 'Hoạt động' : 'Tạm khóa'}
        </ThemedText>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    minHeight: 200,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardType: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  inactiveIndicator: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inactiveText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cardNumberContainer: {
    marginBottom: 20,
  },
  cardNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardDetailItem: {
    flex: 1,
  },
  cardDetailLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHolder: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cardExpiry: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  balanceContainer: {
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  balance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },
});