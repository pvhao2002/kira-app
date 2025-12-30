import React from 'react';
import { render } from '@testing-library/react-native';
import TransactionList from '../TransactionList';
import { Transaction } from '@/types';

// Mock the currency utility
jest.mock('@/utils/currency', () => ({
  formatVND: (amount: number) => `${amount.toLocaleString('vi-VN')} VND`,
}));

// Mock the themed components
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return {
    ThemedText: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return {
    ThemedView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

// Mock the color scheme hook
jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

// Mock the theme constants
jest.mock('@/constants/theme', () => ({
  Colors: {
    light: {
      background: '#FFFFFF',
      text: '#000000',
      border: '#E0E0E0',
    },
  },
}));

const mockTransactions: Transaction[] = [
  {
    id: 'TXN001',
    cardId: 'CARD001',
    type: 'credit',
    amount: 2000000,
    currency: 'VND',
    description: 'Lương tháng 12',
    timestamp: new Date('2024-12-01T10:00:00'),
    status: 'completed',
    reference: 'SAL202412001',
  },
  {
    id: 'TXN002',
    cardId: 'CARD001',
    type: 'debit',
    amount: 150000,
    currency: 'VND',
    description: 'Mua sắm tại Vinmart',
    timestamp: new Date('2024-12-02T14:30:00'),
    status: 'completed',
    reference: 'PUR202412002',
  },
];

describe('TransactionList', () => {
  it('renders transaction list correctly', () => {
    const { getByText } = render(
      <TransactionList transactions={mockTransactions} />
    );

    // Check if transactions are rendered
    expect(getByText('Lương tháng 12')).toBeTruthy();
    expect(getByText('Mua sắm tại Vinmart')).toBeTruthy();
    
    // Check if transaction IDs are displayed
    expect(getByText('ID: TXN001')).toBeTruthy();
    expect(getByText('ID: TXN002')).toBeTruthy();
    
    // Check if references are displayed
    expect(getByText('Ref: SAL202412001')).toBeTruthy();
    expect(getByText('Ref: PUR202412002')).toBeTruthy();
  });

  it('displays empty message when no transactions', () => {
    const { getByText } = render(
      <TransactionList 
        transactions={[]} 
        emptyMessage="Không có giao dịch nào"
      />
    );

    expect(getByText('Không có giao dịch nào')).toBeTruthy();
  });

  it('shows correct status for different transaction statuses', () => {
    const transactionsWithDifferentStatuses: Transaction[] = [
      {
        ...mockTransactions[0],
        status: 'completed',
      },
      {
        ...mockTransactions[1],
        status: 'pending',
      },
      {
        ...mockTransactions[0],
        id: 'TXN003',
        status: 'failed',
      },
    ];

    const { getByText } = render(
      <TransactionList transactions={transactionsWithDifferentStatuses} />
    );

    expect(getByText('Hoàn thành')).toBeTruthy();
    expect(getByText('Đang xử lý')).toBeTruthy();
    expect(getByText('Thất bại')).toBeTruthy();
  });
});