import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface CreditCardSummary {
  totalOutstandingBalance: number;
  activeCount: number;
}

export interface CreditCardDto {
  creditCardId: number;
  bankName: string;
  cardLabel: string;
  lastFour: string;
  creditLimit: number;
  outstandingBalance: number;
  cardholderName: string;
  statementDay: number;
  paymentDueDay: number;
  reminderTime: string;
  cycleStatementDone: boolean;
  cycleDuePaid: boolean;
  nextStatementLabel: string;
  nextDueLabel: string;
  daysUntilDue: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateCreditCardPayload {
  bankName: string;
  cardLabel: string;
  lastFour?: string | null;
  creditLimit: number;
  outstandingBalance: number;
  cardholderName: string;
  statementDay: number;
  paymentDueDay: number;
  reminderTime: string;
}

export interface PatchCyclePayload {
  cycleStatementDone?: boolean | null;
  cycleDuePaid?: boolean | null;
}

export interface CreditCardPaymentDto {
  paymentId: number;
  paidAt: string;
  amount: number;
  note: string | null;
  createdAt: string | null;
  statementCycleId: number | null;
}

export interface PaymentPageDto {
  content: CreditCardPaymentDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreatePaymentPayload {
  paidAt: string;
  amount: number;
  note?: string | null;
  statementCycleId?: number | null;
}

export type CashbackStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED';
export type StatementStatus = 'NOT_ISSUED' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface OverviewSummaryDto {
  totalOutstandingBalance: number;
  pendingCashbackAmount: number;
  investedCostAmount: number;
  realizedNetProfit: number;
  activeCardCount: number;
  pendingCashbackCount: number;
}

export interface CashbackRuleDto {
  cashbackRuleId: number;
  creditCardId: number;
  cardLabel: string;
  bankName: string;
  lastFour: string;
  mccCategoryId: number;
  mccCode: string;
  categoryName: string;
  cashbackRate: number;
  monthlyCapAmount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  note: string | null;
}

export interface MccCategoryDto {
  mccCategoryId: number;
  mccCode: string;
  categoryName: string;
  description: string | null;
  active: boolean;
  activeRuleCount: number;
  bestCashbackRate: number;
  rules: CashbackRuleDto[];
}

export interface CashbackTransactionDto {
  transactionId: number;
  creditCardId: number;
  cardLabel: string;
  bankName: string;
  lastFour: string;
  mccCategoryId: number | null;
  mccCode: string | null;
  mccCategoryName: string | null;
  transactionDate: string;
  customerName: string | null;
  billReference: string | null;
  description: string | null;
  spendAmount: number;
  discountRate: number;
  discountAmount: number;
  cashbackRate: number;
  monthlyCapAmount: number | null;
  expectedCashbackAmount: number;
  actualCashbackAmount: number | null;
  projectedNetProfit: number;
  realizedNetProfit: number | null;
  cashbackDueDate: string | null;
  cashbackReceivedAt: string | null;
  status: CashbackStatus;
  note: string | null;
}

export interface CashbackTransactionPageDto {
  content: CashbackTransactionDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface StatementCycleDto {
  statementCycleId: number;
  creditCardId: number;
  cardLabel: string;
  bankName: string;
  lastFour: string;
  cycleMonth: string;
  statementDate: string;
  dueDate: string;
  statementAmount: number | null;
  paidAmount: number;
  remainingAmount: number;
  statementIssuedAt: string | null;
  status: StatementStatus;
  daysUntilDue: number;
  note: string | null;
}

export interface StatementCyclePageDto {
  content: StatementCycleDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface BankCardOverviewDto {
  summary: OverviewSummaryDto;
  cards: CreditCardDto[];
  latestStatements: StatementCycleDto[];
  dueStatements: StatementCycleDto[];
  recentTransactions: CashbackTransactionDto[];
  mccCoverage: MccCategoryDto[];
}

export interface CreateCashbackTransactionPayload {
  creditCardId: number;
  mccCategoryId?: number | null;
  transactionDate: string;
  customerName?: string | null;
  billReference?: string | null;
  description?: string | null;
  spendAmount: number;
  discountRate: number;
  manualCashbackRate?: number | null;
  cashbackDueDate?: string | null;
  note?: string | null;
}

export interface CashbackRulePayload {
  creditCardId: number;
  cashbackRate: number;
  monthlyCapAmount?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
}

export interface CreateMccCategoryPayload {
  mccCode: string;
  categoryName: string;
  description?: string | null;
  rules?: CashbackRulePayload[];
}

export interface CreateStatementCyclePayload {
  cycleMonth: string;
  statementDate?: string | null;
  dueDate?: string | null;
  statementAmount?: number | null;
  statementIssuedAt?: string | null;
  note?: string | null;
}

@Injectable({providedIn: 'root'})
export class CreditCardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/gateway/cards';

  summary(): Observable<CreditCardSummary> {
    return this.http.get<CreditCardSummary>(`${this.base}/summary`);
  }

  list(): Observable<CreditCardDto[]> {
    return this.http.get<CreditCardDto[]>(this.base);
  }

  get(creditCardId: number): Observable<CreditCardDto> {
    return this.http.get<CreditCardDto>(`${this.base}/${creditCardId}`);
  }

  create(body: CreateCreditCardPayload): Observable<CreditCardDto> {
    return this.http.post<CreditCardDto>(this.base, body);
  }

  patchCycle(creditCardId: number, body: PatchCyclePayload): Observable<void> {
    return this.http.patch<void>(`${this.base}/${creditCardId}/cycle`, body);
  }

  payments(creditCardId: number, page: number, size: number): Observable<PaymentPageDto> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<PaymentPageDto>(`${this.base}/${creditCardId}/payments`, {params});
  }

  addPayment(creditCardId: number, body: CreatePaymentPayload): Observable<CreditCardPaymentDto> {
    return this.http.post<CreditCardPaymentDto>(`${this.base}/${creditCardId}/payments`, body);
  }

  deletePayment(creditCardId: number, paymentId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${creditCardId}/payments/${paymentId}`);
  }

  deleteCard(creditCardId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${creditCardId}`);
  }

  updateCard(creditCardId: number, body: Partial<CreateCreditCardPayload>): Observable<CreditCardDto> {
    return this.http.patch<CreditCardDto>(`${this.base}/${creditCardId}`, body);
  }

  overview(month?: string): Observable<BankCardOverviewDto> {
    const params = month ? new HttpParams().set('month', month) : undefined;
    return this.http.get<BankCardOverviewDto>(`${this.base}/overview`, {params});
  }

  cashbackTransactions(filters: {
    cardId?: number | null;
    mccCategoryId?: number | null;
    status?: string | null;
    from?: string | null;
    to?: string | null;
    page?: number;
    size?: number;
  } = {}): Observable<CashbackTransactionPageDto> {
    let params = new HttpParams()
      .set('page', String(filters.page ?? 0))
      .set('size', String(filters.size ?? 20));
    if (filters.cardId) params = params.set('cardId', String(filters.cardId));
    if (filters.mccCategoryId) params = params.set('mccCategoryId', String(filters.mccCategoryId));
    if (filters.status) params = params.set('status', filters.status);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http.get<CashbackTransactionPageDto>(`${this.base}/cashback-transactions`, {params});
  }

  createCashbackTransaction(body: CreateCashbackTransactionPayload): Observable<CashbackTransactionDto> {
    return this.http.post<CashbackTransactionDto>(`${this.base}/cashback-transactions`, body);
  }

  receiveCashback(transactionId: number, actualCashbackAmount: number, receivedAt: string): Observable<CashbackTransactionDto> {
    return this.http.post<CashbackTransactionDto>(`${this.base}/cashback-transactions/${transactionId}/receive`, {
      actualCashbackAmount,
      receivedAt,
    });
  }

  cancelCashback(transactionId: number): Observable<CashbackTransactionDto> {
    return this.http.post<CashbackTransactionDto>(`${this.base}/cashback-transactions/${transactionId}/cancel`, {});
  }

  statementCycles(filters: {
    cardId?: number | null;
    status?: string | null;
    month?: string | null;
    page?: number;
    size?: number;
  } = {}): Observable<StatementCyclePageDto> {
    let params = new HttpParams()
      .set('page', String(filters.page ?? 0))
      .set('size', String(filters.size ?? 20));
    if (filters.cardId) params = params.set('cardId', String(filters.cardId));
    if (filters.status) params = params.set('status', filters.status);
    if (filters.month) params = params.set('month', filters.month);
    return this.http.get<StatementCyclePageDto>(`${this.base}/statement-cycles`, {params});
  }

  createStatementCycle(creditCardId: number, body: CreateStatementCyclePayload): Observable<StatementCycleDto> {
    return this.http.post<StatementCycleDto>(`${this.base}/${creditCardId}/statement-cycles`, body);
  }

  updateStatementCycle(creditCardId: number, cycleId: number, body: Partial<CreateStatementCyclePayload>): Observable<StatementCycleDto> {
    return this.http.patch<StatementCycleDto>(`${this.base}/${creditCardId}/statement-cycles/${cycleId}`, body);
  }

  mccCategories(activeOnly = true): Observable<MccCategoryDto[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<MccCategoryDto[]>(`${this.base}/mcc-categories`, {params});
  }

  createMccCategory(body: CreateMccCategoryPayload): Observable<MccCategoryDto> {
    return this.http.post<MccCategoryDto>(`${this.base}/mcc-categories`, body);
  }

  deactivateMccCategory(categoryId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/mcc-categories/${categoryId}`);
  }
}
