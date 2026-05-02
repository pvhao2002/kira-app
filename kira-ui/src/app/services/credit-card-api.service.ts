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
}
