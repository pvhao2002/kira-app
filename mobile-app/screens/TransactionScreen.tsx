import React, { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Card, TransactionFormData, Transaction } from '@/types';
import TransactionForm from '@/components/TransactionForm';
import TransactionConfirmation from '@/components/TransactionConfirmation';
import TransactionSuccess from '@/components/TransactionSuccess';

interface TransactionScreenProps {
  selectedCard: Card;
  onClose: () => void;
  onTransactionComplete: (transaction: Transaction) => void;
  onViewHistory: () => void;
}

type TransactionStep = 'form' | 'confirmation' | 'success';

export default function TransactionScreen({ 
  selectedCard, 
  onClose, 
  onTransactionComplete,
  onViewHistory 
}: TransactionScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [currentStep, setCurrentStep] = useState<TransactionStep>('form');
  const [transactionData, setTransactionData] = useState<TransactionFormData | null>(null);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);

  const handleFormSubmit = (formData: TransactionFormData) => {
    setTransactionData(formData);
    setCurrentStep('confirmation');
  };

  const handleFormCancel = () => {
    Alert.alert(
      'Hủy giao dịch',
      'Bạn có chắc chắn muốn hủy giao dịch này?',
      [
        { text: 'Tiếp tục', style: 'cancel' },
        { text: 'Hủy giao dịch', style: 'destructive', onPress: onClose },
      ]
    );
  };

  const handleConfirmationConfirm = (transaction: Transaction) => {
    setCompletedTransaction(transaction);
    setCurrentStep('success');
    onTransactionComplete(transaction);
  };

  const handleConfirmationCancel = () => {
    Alert.alert(
      'Hủy giao dịch',
      'Bạn có chắc chắn muốn hủy giao dịch này?',
      [
        { text: 'Tiếp tục', style: 'cancel' },
        { text: 'Hủy giao dịch', style: 'destructive', onPress: onClose },
      ]
    );
  };

  const handleConfirmationEdit = () => {
    setCurrentStep('form');
  };

  const handleSuccessDone = () => {
    onClose();
  };

  const handleSuccessViewHistory = () => {
    onViewHistory();
    onClose();
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'form':
        return (
          <TransactionForm
            selectedCard={selectedCard}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        );
      
      case 'confirmation':
        if (!transactionData) return null;
        return (
          <TransactionConfirmation
            selectedCard={selectedCard}
            transactionData={transactionData}
            onConfirm={handleConfirmationConfirm}
            onCancel={handleConfirmationCancel}
            onEdit={handleConfirmationEdit}
          />
        );
      
      case 'success':
        if (!completedTransaction) return null;
        return (
          <TransactionSuccess
            transaction={completedTransaction}
            onDone={handleSuccessDone}
            onViewHistory={handleSuccessViewHistory}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderCurrentStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});