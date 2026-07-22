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
  code: string;
  name: string;
  shortName: string;
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

export interface Card {
  id: number;
  bankId: number;
  bankName: string;
  cardName: string;
  cardCode: string;
  cardNetwork: string;
  cardTier: string;
  annualFee: number;
  currency: string;
  cashbackLimit: number;
  cashbackCondition: string;
  description: string;
  imageUrl: string
}

export interface FinderResult {
  ruleId: number;
  card: Card;
  mcc: Mcc;
  rate: number;
  estimatedCashback: number;
  cap: number | null;
  eligibleAmount: number;
  conditions: string;
  exclusions: string
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
