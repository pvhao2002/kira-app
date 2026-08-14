export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number
}

export interface PageResponse<T> {
  data: T[];
  meta: PageMeta
}

export interface Profile {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string[]
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: Profile
}

export interface Bank {
  id: number;
  vietqrId: number | null;
  code: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  bin: string | null;
  swiftCode: string | null;
  transferSupported: boolean;
  lookupSupported: boolean;
  website: string | null;
  hotline: string | null;
  brandColor: string;
  description: string
}

export interface Mcc {
  id: number;
  code: string;
  name: string;
  category: string;
  description: string;
  merchantType: string
}

export interface UserCreditCard {
  id: number;
  bankId: number;
  bankName: string;
  bankLogoUrl: string | null;
  nickname: string;
  lastFour: string | null;
  creditLimit: number;
  currency: string;
  statementDay: number;
  dueDay: number;
  status: string;
  note: string | null;
  version: number;
  billingCycleId: number | null;
  statementDate: string | null;
  paymentDueDate: string | null;
  statementBalance: number | null;
  minimumPayment: number | null;
  billingStatus: 'NOT_DUE' | 'NEEDS_INPUT' | 'UNPAID' | 'OVERDUE' | 'PAID';
  billingVersion: number
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
  traceId: string
}

export interface DashboardSummary {
  creditCard: {
    totalSpending: number;
    statementDebt: number;
    cashbackWaiting: number;
    cashbackReceived: number;
    discountProfit: number
  };
  investment: {
    currentBalance: number;
    availableCapital: number;
    lockedCapital: number;
    profit: number;
    reward: number;
    pendingWithdrawal: number
  }
}
