// Validation schemas for data integrity
import { User, Card, Transaction, LoginFormData, TransactionFormData, ProfileFormData, PasswordChangeFormData } from './index';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Vietnamese phone number regex (optional)
const PHONE_REGEX = /^(\+84|0)[0-9]{9,10}$/;

// Card number validation (basic format check)
const CARD_NUMBER_REGEX = /^\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/;

export const validateEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email);
};

export const validatePhoneNumber = (phone: string): boolean => {
  return PHONE_REGEX.test(phone);
};

export const validateCardNumber = (cardNumber: string): boolean => {
  return CARD_NUMBER_REGEX.test(cardNumber);
};

export const validateLoginForm = (data: LoginFormData): ValidationResult => {
  const errors: string[] = [];

  if (!data.email) {
    errors.push('Email is required');
  } else if (!validateEmail(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.password) {
    errors.push('Password is required');
  } else if (data.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateTransactionForm = (data: TransactionFormData): ValidationResult => {
  const errors: string[] = [];

  if (!data.cardId) {
    errors.push('Card selection is required');
  }

  if (!data.amount) {
    errors.push('Amount is required');
  } else if (data.amount <= 0) {
    errors.push('Amount must be greater than 0');
  } else if (data.amount > 100000000) { // 100 million VND limit
    errors.push('Amount exceeds maximum limit');
  }

  if (!data.description) {
    errors.push('Description is required');
  } else if (data.description.length < 3) {
    errors.push('Description must be at least 3 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateProfileForm = (data: ProfileFormData): ValidationResult => {
  const errors: string[] = [];

  if (!data.name) {
    errors.push('Name is required');
  } else if (data.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  if (!data.email) {
    errors.push('Email is required');
  } else if (!validateEmail(data.email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePasswordChange = (data: PasswordChangeFormData): ValidationResult => {
  const errors: string[] = [];

  if (!data.currentPassword) {
    errors.push('Current password is required');
  }

  if (!data.newPassword) {
    errors.push('New password is required');
  } else if (data.newPassword.length < 6) {
    errors.push('New password must be at least 6 characters');
  }

  if (!data.confirmPassword) {
    errors.push('Password confirmation is required');
  } else if (data.newPassword !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (data.currentPassword === data.newPassword) {
    errors.push('New password must be different from current password');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateUser = (user: Partial<User>): ValidationResult => {
  const errors: string[] = [];

  if (!user.name) {
    errors.push('Name is required');
  }

  if (!user.email) {
    errors.push('Email is required');
  } else if (!validateEmail(user.email)) {
    errors.push('Invalid email format');
  }

  if (user.isPremium === undefined) {
    errors.push('Premium status is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateCard = (card: Partial<Card>): ValidationResult => {
  const errors: string[] = [];

  if (!card.type) {
    errors.push('Card type is required');
  } else if (!['credit', 'debit', 'banking'].includes(card.type)) {
    errors.push('Invalid card type');
  }

  if (!card.bankName) {
    errors.push('Bank name is required');
  }

  if (!card.cardNumber) {
    errors.push('Card number is required');
  }

  if (!card.holderName) {
    errors.push('Card holder name is required');
  }

  if (card.balance === undefined || card.balance === null) {
    errors.push('Balance is required');
  } else if (card.balance < 0) {
    errors.push('Balance cannot be negative');
  }

  if (!card.expiryDate) {
    errors.push('Expiry date is required');
  } else if (new Date(card.expiryDate) < new Date()) {
    errors.push('Card has expired');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateTransaction = (transaction: Partial<Transaction>): ValidationResult => {
  const errors: string[] = [];

  if (!transaction.cardId) {
    errors.push('Card ID is required');
  }

  if (!transaction.type) {
    errors.push('Transaction type is required');
  } else if (!['credit', 'debit'].includes(transaction.type)) {
    errors.push('Invalid transaction type');
  }

  if (transaction.amount === undefined || transaction.amount === null) {
    errors.push('Amount is required');
  } else if (transaction.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!transaction.description) {
    errors.push('Description is required');
  }

  if (!transaction.timestamp) {
    errors.push('Timestamp is required');
  }

  if (!transaction.status) {
    errors.push('Status is required');
  } else if (!['completed', 'pending', 'failed'].includes(transaction.status)) {
    errors.push('Invalid transaction status');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Utility function to validate VND amount format
export const validateVNDAmount = (amount: number): boolean => {
  // Check if amount is a valid number and within reasonable range
  return !isNaN(amount) && amount >= 0 && amount <= 999999999999; // 999 billion VND max
};

// Utility function to validate date
export const validateDate = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj instanceof Date && !isNaN(dateObj.getTime());
};