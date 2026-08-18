import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  Bank,
  CreditCardBankBalanceResponse,
  CreditCardBankLimit,
  CreditCardDashboard,
  DashboardSummary,
  Mcc,
  PageResponse
} from '../../shared/models/api.models';

@Injectable({providedIn: 'root'})
export class ApiService {
  private http = inject(HttpClient);

  banks(search = '', page = 0, size = 20): Observable<PageResponse<Bank>> {
    return this.http.get<PageResponse<Bank>>('/api/v1/public/banks', {params: {search, page, size}});
  }

  mccs(search = ''): Observable<PageResponse<Mcc>> {
    return this.http.get<PageResponse<Mcc>>('/api/v1/public/mccs', {params: {search}});
  }

  page<T>(path: string, page = 0, size = 20, search = ''): Observable<PageResponse<T>> {
    return this.http.get<PageResponse<T>>(`/api/v1/${path}`, {params: {page, size, search}});
  }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`/api/v1/${path}`);
  }

  post<T>(path: string, body: unknown, idempotent = false): Observable<T> {
    return this.http.post<T>(`/api/v1/${path}`, body, {headers: idempotent ? {'Idempotency-Key': crypto.randomUUID()} : undefined});
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`/api/v1/${path}`, body);
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<T>(`/api/v1/${path}`, body);
  }

  summary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/v1/dashboards/summary');
  }

  creditCardDashboard(): Observable<CreditCardDashboard> {
    return this.http.get<CreditCardDashboard>('/api/v1/dashboards/credit-cards');
  }

  creditCardBankLimits(): Observable<CreditCardBankLimit[]> {
    return this.http.get<CreditCardBankLimit[]>('/api/v1/credit-card-bank-limits');
  }

  updateCreditCardBankLimit(bankId: number, creditLimit: number, version: number): Observable<CreditCardBankLimit> {
    return this.http.put<CreditCardBankLimit>(`/api/v1/credit-card-bank-limits/${bankId}`, {creditLimit, version});
  }

  updateCreditCardBankBalance(bankId: number, currentBalance: number, reason: string,
                              version: number): Observable<CreditCardBankBalanceResponse> {
    return this.http.put<CreditCardBankBalanceResponse>(`/api/v1/credit-card-bank-balances/${bankId}`,
      {currentBalance, reason, version});
  }
}
