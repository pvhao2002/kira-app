import {CreditCardDashboard} from './api.models';

export interface OverviewGroup<T> { total: number; items: T[] }
export interface OverviewDue {
  id: number; cardId: number; bankName: string; nickname: string; lastFour: string | null;
  dueDate: string | null; remainingAmount: number | null; currency: string;
}
export interface OverviewCredit {
  updatedAt: string;
  summary: Pick<CreditCardDashboard, 'totalCreditLimit' | 'currentBalance' | 'availableCredit' | 'utilizationRate' | 'currency'> & {bankCount: number; cardCount: number};
  overdue: OverviewGroup<OverviewDue>; dueToday: OverviewGroup<OverviewDue>;
  dueSoon: OverviewGroup<OverviewDue>; needsInput: OverviewGroup<OverviewDue>;
}
export interface OverviewImport { batchId: string; accountId: number; accountName: string; status: string }
export interface OverviewDailyFlow { date: string; deposits: number; withdrawals: number }
export interface OverviewCurrencyFlow {
  currency: string; deposits: number; withdrawals: number; bonuses: number; netDeposits: number;
  daily: OverviewDailyFlow[];
}
export interface OverviewInvestments {
  updatedAt: string; days: number; fromDate: string; toDate: string; activeAccounts: number;
  currencies: OverviewCurrencyFlow[]; review: OverviewGroup<OverviewImport>; failed: OverviewGroup<OverviewImport>;
}
export interface OverviewLesson {
  seriesId: number; date: string; startTime: string; endTime: string; studentName: string; subject: string; fee: number;
}
export interface OverviewTutoring {
  updatedAt: string; weekStart: string; weekEnd: string; lessonCount: number; totalHours: number; totalFee: number;
  upcoming: OverviewGroup<OverviewLesson>;
  conflicts: OverviewGroup<{date: string; startTime: string; description: string}>;
}
export interface OverviewNotification { id: number; title: string; createdAt: string; readAt: string | null }
