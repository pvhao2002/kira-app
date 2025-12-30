import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Card, TransactionFormData } from '@/types';
import { formatAmountForInput, parseVND } from '@/utils/currency';

interface TransactionFormProps {
  selectedCard: Card;
  onSubmit: (formData: TransactionFormData) => void;
  onCancel: () => void;
}

interface FormErrors {
  amount?: string;
  description?: string;
  recipient?: string;
}

export default function TransactionForm({ selectedCard, onSubmit, onCancel }: TransactionFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [formData, setFormData] = useState<TransactionFormData>({
    cardId: selectedCard.id,
    amount: 0,
    description: '',
    recipient: '',
  });

  const [amountText, setAmountText] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate amount
    if (!amountText.trim()) {
      newErrors.amount = 'Vui lòng nhập số tiền';
    } else {
      const amount = parseVND(amountText);
      if (amount <= 0) {
        newErrors.amount = 'Số tiền phải lớn hơn 0';
      } else if (amount > selectedCard.balance) {
        newErrors.amount = 'Số dư không đủ';
      } else if (amount > 50000000) { // 50 million VND limit
        newErrors.amount = 'Số tiền vượt quá hạn mức cho phép (50.000.000 VND)';
      }
    }

    // Validate description
    if (!formData.description.trim()) {
      newErrors.description = 'Vui lòng nhập nội dung chuyển tiền';
    } else if (formData.description.trim().length < 5) {
      newErrors.description = 'Nội dung phải có ít nhất 5 ký tự';
    } else if (formData.description.trim().length > 200) {
      newErrors.description = 'Nội dung không được vượt quá 200 ký tự';
    }

    // Validate recipient (optional but if provided, must be valid)
    if (formData.recipient && formData.recipient.trim()) {
      if (formData.recipient.trim().length < 3) {
        newErrors.recipient = 'Tên người nhận phải có ít nhất 3 ký tự';
      } else if (formData.recipient.trim().length > 100) {
        newErrors.recipient = 'Tên người nhận không được vượt quá 100 ký tự';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAmountChange = (text: string) => {
    // Remove any non-numeric characters except periods and spaces
    const cleanText = text.replace(/[^0-9.\s]/g, '');
    setAmountText(cleanText);
    
    // Update form data with parsed amount
    const amount = parseVND(cleanText);
    setFormData(prev => ({ ...prev, amount }));

    // Clear amount error when user starts typing
    if (errors.amount) {
      setErrors(prev => ({ ...prev, amount: undefined }));
    }
  };

  const handleDescriptionChange = (text: string) => {
    setFormData(prev => ({ ...prev, description: text }));
    
    // Clear description error when user starts typing
    if (errors.description) {
      setErrors(prev => ({ ...prev, description: undefined }));
    }
  };

  const handleRecipientChange = (text: string) => {
    setFormData(prev => ({ ...prev, recipient: text }));
    
    // Clear recipient error when user starts typing
    if (errors.recipient) {
      setErrors(prev => ({ ...prev, recipient: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Final validation before submission
      const finalFormData: TransactionFormData = {
        ...formData,
        amount: parseVND(amountText),
        description: formData.description.trim(),
        recipient: formData.recipient?.trim() || undefined,
      };

      await onSubmit(finalFormData);
    } catch {
      Alert.alert(
        'Lỗi',
        'Có lỗi xảy ra khi xử lý giao dịch. Vui lòng thử lại.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmountDisplay = (text: string): string => {
    if (!text) return '';
    const amount = parseVND(text);
    if (amount === 0) return text;
    return formatAmountForInput(amount);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Chuyển tiền
      </ThemedText>
      
      <ThemedText style={styles.subtitle}>
        Từ thẻ: {selectedCard.bankName} - {selectedCard.cardNumber}
      </ThemedText>

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <ThemedText style={styles.label}>
          Số tiền <ThemedText style={styles.required}>*</ThemedText>
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            { 
              backgroundColor: colors.card,
              borderColor: errors.amount ? '#F44336' : colors.border,
              color: colors.text,
            }
          ]}
          value={amountText}
          onChangeText={handleAmountChange}
          placeholder="Nhập số tiền (VND)"
          placeholderTextColor={colors.icon}
          keyboardType="numeric"
          maxLength={15}
        />
        {errors.amount && (
          <ThemedText style={styles.errorText}>{errors.amount}</ThemedText>
        )}
        {amountText && !errors.amount && (
          <ThemedText style={styles.helperText}>
            {formatAmountDisplay(amountText)} VND
          </ThemedText>
        )}
      </View>

      {/* Description Input */}
      <View style={styles.inputGroup}>
        <ThemedText style={styles.label}>
          Nội dung chuyển tiền <ThemedText style={styles.required}>*</ThemedText>
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            { 
              backgroundColor: colors.card,
              borderColor: errors.description ? '#F44336' : colors.border,
              color: colors.text,
            }
          ]}
          value={formData.description}
          onChangeText={handleDescriptionChange}
          placeholder="Nhập nội dung chuyển tiền"
          placeholderTextColor={colors.icon}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
        {errors.description && (
          <ThemedText style={styles.errorText}>{errors.description}</ThemedText>
        )}
        <ThemedText style={styles.characterCount}>
          {formData.description.length}/200
        </ThemedText>
      </View>

      {/* Recipient Input (Optional) */}
      <View style={styles.inputGroup}>
        <ThemedText style={styles.label}>
          Tên người nhận (tùy chọn)
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            { 
              backgroundColor: colors.card,
              borderColor: errors.recipient ? '#F44336' : colors.border,
              color: colors.text,
            }
          ]}
          value={formData.recipient}
          onChangeText={handleRecipientChange}
          placeholder="Nhập tên người nhận"
          placeholderTextColor={colors.icon}
          maxLength={100}
        />
        {errors.recipient && (
          <ThemedText style={styles.errorText}>{errors.recipient}</ThemedText>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
          disabled={isSubmitting}
        >
          <ThemedText style={[styles.buttonText, { color: colors.text }]}>
            Hủy
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.submitButton,
            { backgroundColor: colors.tint },
            isSubmitting && styles.disabledButton
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
            {isSubmitting ? 'Đang xử lý...' : 'Tiếp tục'}
          </ThemedText>
        </TouchableOpacity>
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
  submitButton: {
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
});