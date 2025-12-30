// Core data models for Vietnamese Sports Finance App

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isPremium: boolean;
  createdAt: Date;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifications: boolean;
  biometricAuth: boolean;
  language: 'vi' | 'en';
  currency: 'VND';
}

export interface Card {
  id: string;
  type: 'credit' | 'debit' | 'banking';
  bankName: string;
  cardNumber: string; // masked for security
  holderName: string;
  balance: number;
  currency: 'VND';
  expiryDate: Date;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  cardId: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: 'VND';
  description: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  league: string;
  venue: string;
  startTime: Date;
  status: 'scheduled' | 'live' | 'finished';
  score?: Score;
  odds: BettingOdds;
  prediction?: MatchPrediction;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  country: string;
}

export interface Score {
  home: number;
  away: number;
}

export interface BettingOdds {
  handicap: number[];
  overUnder: number[];
  oneXTwo: number[];
  corners: number[];
}

export interface MatchPrediction {
  accuracy: number;
  recommendation: string;
  analysis: string;
}

// Utility types for API responses and form data
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form data types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface TransactionFormData {
  cardId: string;
  amount: number;
  description: string;
  recipient?: string;
}

export interface ProfileFormData {
  name: string;
  email: string;
  avatar?: string;
}

export interface PasswordChangeFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Sports: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  CardManagement: undefined;
  TransactionDetail: { transactionId: string };
};

export type TransactionStackParamList = {
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: string };
};

export type SportsStackParamList = {
  SportsAnalytics: undefined;
  MatchDetail: { matchId: string };
  BettingHistory: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
};

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Theme types
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  error: string;
  warning: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    fontWeight: {
      normal: string;
      medium: string;
      bold: string;
    };
  };
}