import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  Bank,
  CreditCardBankBalanceResponse,
  CreditCardBankLimit,
  CreditCardDashboard,
  PageResponse,
  InvestmentImportBatch,
  InvestmentConfirmItem,
  InvestmentConfirmResponse,
  InvestmentTransaction,
  InvestmentAiJob
} from '../../shared/models/api.models';

@Injectable({providedIn: 'root'})
export class ApiService {
  private http = inject(HttpClient);

  banks(search = '', page = 0, size = 20): Observable<PageResponse<Bank>> {
    return this.http.get<PageResponse<Bank>>('/api/v1/public/banks', {params: {search, page, size}});
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

  createInvestmentTransactionImport(accountId: number, files: File[]): Observable<InvestmentImportBatch> {
    const body = new FormData();
    files.forEach(file => body.append('files', file, file.name));
    return this.http.post<InvestmentImportBatch>(
      `/api/v1/investment/accounts/${accountId}/transaction-imports`, body);
  }

  investmentTransactionImport(accountId: number, batchId: string): Observable<InvestmentImportBatch> {
    return this.http.get<InvestmentImportBatch>(
      `/api/v1/investment/accounts/${accountId}/transaction-imports/${batchId}`);
  }

  retryInvestmentImportFile(accountId: number, batchId: string, attachmentId: number): Observable<InvestmentImportBatch> {
    return this.http.post<InvestmentImportBatch>(
      `/api/v1/investment/accounts/${accountId}/transaction-imports/${batchId}/files/${attachmentId}/retry`, {});
  }

  confirmInvestmentTransactions(accountId: number, batchId: string,
                                transactions: InvestmentConfirmItem[]): Observable<InvestmentConfirmResponse> {
    return this.http.post<InvestmentConfirmResponse>(
      `/api/v1/investment/accounts/${accountId}/transaction-imports/${batchId}/confirm`, {transactions});
  }

  investmentTransactions(accountId: number, filters: Record<string, string | number> = {}):
    Observable<PageResponse<InvestmentTransaction>> {
    return this.http.get<PageResponse<InvestmentTransaction>>(
      `/api/v1/investment/accounts/${accountId}/transactions`, {params: filters});
  }

  investmentAiJobs(adminScope: boolean, status = '', page = 0, size = 20):
    Observable<PageResponse<InvestmentAiJob>> {
    const path = adminScope ? '/api/v1/admin/investment/ai-jobs' : '/api/v1/investment/ai-jobs';
    const params: Record<string, string | number> = {page, size, sort: 'createdAt,desc'};
    if (status) params['statuses'] = status;
    return this.http.get<PageResponse<InvestmentAiJob>>(path, {params});
  }

  cancelInvestmentAiJob(attachmentId: number, adminScope: boolean): Observable<InvestmentAiJob> {
    const prefix = adminScope ? '/api/v1/admin/investment/ai-jobs' : '/api/v1/investment/ai-jobs';
    return this.http.post<InvestmentAiJob>(`${prefix}/${attachmentId}/cancel`, {});
  }

  runInvestmentAiJob(attachmentId: number, adminScope: boolean): Observable<InvestmentAiJob> {
    const prefix = adminScope ? '/api/v1/admin/investment/ai-jobs' : '/api/v1/investment/ai-jobs';
    return this.http.post<InvestmentAiJob>(`${prefix}/${attachmentId}/run`, {});
  }

  investmentAiJobContent(attachmentId: number, adminScope: boolean): Observable<Blob> {
    const prefix = adminScope ? '/api/v1/admin/investment/ai-jobs' : '/api/v1/investment/ai-jobs';
    return this.http.get(`${prefix}/${attachmentId}/content`, {responseType: 'blob'});
  }
}
