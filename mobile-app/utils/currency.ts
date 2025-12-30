// Vietnamese currency formatting utilities

/**
 * Formats a number as Vietnamese Dong (VND) currency
 * Uses periods as thousand separators as per Vietnamese convention
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the VND symbol (default: true)
 * @param showDecimals - Whether to show decimal places (default: false for VND)
 * @returns Formatted currency string
 */
export const formatVND = (
  amount: number,
  showSymbol: boolean = true,
  showDecimals: boolean = false
): string => {
  // Handle edge cases
  if (isNaN(amount)) {
    return showSymbol ? '0 VND' : '0';
  }

  // Handle negative amounts
  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);

  // Format the number with periods as thousand separators
  let formattedAmount: string;
  
  if (showDecimals) {
    // Round to 2 decimal places for display
    const rounded = Math.round(absoluteAmount * 100) / 100;
    formattedAmount = rounded.toFixed(2);
  } else {
    // Round to nearest whole number for VND (no decimals typically used)
    formattedAmount = Math.round(absoluteAmount).toString();
  }

  // Add thousand separators (periods for Vietnamese format)
  formattedAmount = formattedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Add negative sign if needed
  if (isNegative) {
    formattedAmount = '-' + formattedAmount;
  }

  // Add currency symbol
  if (showSymbol) {
    formattedAmount += ' VND';
  }

  return formattedAmount;
};

/**
 * Formats a number as compact VND (using K, M, B suffixes)
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the VND symbol (default: true)
 * @returns Compact formatted currency string
 */
export const formatVNDCompact = (
  amount: number,
  showSymbol: boolean = true
): string => {
  if (isNaN(amount)) {
    return showSymbol ? '0 VND' : '0';
  }

  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);

  let formattedAmount: string;
  
  if (absoluteAmount >= 1000000000) {
    // Billions
    formattedAmount = (absoluteAmount / 1000000000).toFixed(1) + 'B';
  } else if (absoluteAmount >= 1000000) {
    // Millions
    formattedAmount = (absoluteAmount / 1000000).toFixed(1) + 'M';
  } else if (absoluteAmount >= 1000) {
    // Thousands
    formattedAmount = (absoluteAmount / 1000).toFixed(1) + 'K';
  } else {
    formattedAmount = absoluteAmount.toString();
  }

  // Remove unnecessary .0
  formattedAmount = formattedAmount.replace('.0', '');

  // Add negative sign if needed
  if (isNegative) {
    formattedAmount = '-' + formattedAmount;
  }

  // Add currency symbol
  if (showSymbol) {
    formattedAmount += ' VND';
  }

  return formattedAmount;
};

/**
 * Parses a VND formatted string back to a number
 * @param formattedAmount - The formatted currency string
 * @returns The numeric value
 */
export const parseVND = (formattedAmount: string): number => {
  if (!formattedAmount) {
    return 0;
  }

  // Remove VND symbol and spaces
  let cleanAmount = formattedAmount.replace(/VND/g, '').trim();
  
  // Handle negative amounts
  const isNegative = cleanAmount.startsWith('-');
  if (isNegative) {
    cleanAmount = cleanAmount.substring(1);
  }

  // Remove periods (thousand separators)
  cleanAmount = cleanAmount.replace(/\./g, '');

  // Parse to number
  const parsed = parseFloat(cleanAmount);
  
  if (isNaN(parsed)) {
    return 0;
  }

  return isNegative ? -parsed : parsed;
};

/**
 * Validates if a string is a valid VND format
 * @param formattedAmount - The formatted currency string to validate
 * @returns True if valid VND format
 */
export const isValidVNDFormat = (formattedAmount: string): boolean => {
  if (!formattedAmount) {
    return false;
  }

  // Basic VND format regex: optional minus, digits with optional periods, optional VND
  const vndRegex = /^-?\d{1,3}(\.\d{3})*(\s?VND)?$/;
  return vndRegex.test(formattedAmount.trim());
};

/**
 * Formats transaction amount with appropriate color coding context
 * @param amount - The transaction amount
 * @param type - Transaction type ('credit' or 'debit')
 * @returns Object with formatted amount and suggested color
 */
export const formatTransactionAmount = (
  amount: number,
  type: 'credit' | 'debit'
): {
  formatted: string;
  color: 'green' | 'red';
  prefix: string;
} => {
  const formatted = formatVND(Math.abs(amount));
  const color = type === 'credit' ? 'green' : 'red';
  const prefix = type === 'credit' ? '+' : '-';

  return {
    formatted,
    color,
    prefix
  };
};

/**
 * Formats card balance for display
 * @param balance - The card balance
 * @returns Formatted balance string
 */
export const formatCardBalance = (balance: number): string => {
  return formatVND(balance, true, false);
};

/**
 * Formats amount for input fields (without VND symbol)
 * @param amount - The amount to format
 * @returns Formatted amount without currency symbol
 */
export const formatAmountForInput = (amount: number): string => {
  return formatVND(amount, false, false);
};

/**
 * Utility to get Vietnamese number words (for check writing, etc.)
 * Basic implementation for common amounts
 */
const vietnameseNumbers = {
  0: 'không',
  1: 'một',
  2: 'hai', 
  3: 'ba',
  4: 'bốn',
  5: 'năm',
  6: 'sáu',
  7: 'bảy',
  8: 'tám',
  9: 'chín',
  10: 'mười',
  100: 'trăm',
  1000: 'nghìn',
  1000000: 'triệu',
  1000000000: 'tỷ'
};

/**
 * Converts a number to Vietnamese words (basic implementation)
 * @param amount - The amount to convert
 * @returns Vietnamese words representation
 */
export const numberToVietnameseWords = (amount: number): string => {
  if (amount === 0) return 'không đồng';
  
  // This is a simplified implementation
  // A full implementation would handle all Vietnamese number rules
  if (amount < 10) {
    return `${vietnameseNumbers[amount as keyof typeof vietnameseNumbers]} đồng`;
  }
  
  // For now, return a placeholder for complex numbers
  return `${formatVND(amount, false)} đồng`;
};