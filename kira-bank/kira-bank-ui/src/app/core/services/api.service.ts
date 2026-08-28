import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  Bank,
  CreditCardBankBalanceResponse,
  CreditCardBankLimit,
  CreditCardDashboard,
  CreditCardBenefit,
  CreditCardCashbackProgramRequest,
  PageResponse,
  InvestmentImportBatch,
  InvestmentConfirmItem,
  InvestmentConfirmResponse,
  InvestmentTransaction,
  InvestmentAiJob,
  LodgingListing,
  LodgingListingRequest,
  LodgingReferenceLocation,
  LodgingReview,
  LodgingReviewStatus,
  AddressSuggestion,
  CloudflareAccount,
  PasswordVaultModule,
  PasswordVaultAccount,
  PasswordVaultAccountRequest,
  PasswordVaultSecret,
  PasswordVaultUnlock,
  TutoringStudent,
  TutoringStudentRequest,
  TutoringWeek,
  TutoringSeriesRequest,
  TutoringExceptionAction
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

  deleteWithBody<T>(path: string, body: unknown): Observable<T> {
    return this.http.request<T>('DELETE', `/api/v1/${path}`, {body});
  }

  cloudflareAccounts(): Observable<CloudflareAccount[]> {
    return this.get<CloudflareAccount[]>('admin/cloudflare-accounts');
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

  creditCardBenefits(): Observable<CreditCardBenefit[]> {
    return this.http.get<CreditCardBenefit[]>('/api/v1/credit-card-benefits');
  }

  updateCreditCardMonthlyCashbackCap(cardId: number, monthlyCashbackCap: number,
                                     version: number | null): Observable<CreditCardBenefit> {
    return this.http.put<CreditCardBenefit>(`/api/v1/credit-card-benefits/${cardId}/monthly-cap`,
      {monthlyCashbackCap, version});
  }

  createCreditCardCashbackProgram(cardId: number,
                                  request: CreditCardCashbackProgramRequest): Observable<CreditCardBenefit> {
    return this.http.post<CreditCardBenefit>(`/api/v1/credit-card-benefits/${cardId}/programs`, request);
  }

  updateCreditCardCashbackProgram(cardId: number, programId: number,
                                  request: CreditCardCashbackProgramRequest): Observable<CreditCardBenefit> {
    return this.http.put<CreditCardBenefit>(
      `/api/v1/credit-card-benefits/${cardId}/programs/${programId}`, request);
  }

  deleteCreditCardCashbackProgram(cardId: number, programId: number, version: number): Observable<void> {
    return this.http.request<void>('DELETE',
      `/api/v1/credit-card-benefits/${cardId}/programs/${programId}`, {body: {version}});
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

  lodgings(page = 0, size = 20, search = ''): Observable<PageResponse<LodgingListing>> {
    return this.http.get<PageResponse<LodgingListing>>('/api/v1/lodgings', {params: {page, size, search}});
  }

  createLodging(request: LodgingListingRequest): Observable<LodgingListing> {
    return this.http.post<LodgingListing>('/api/v1/lodgings', request);
  }

  updateLodging(id: number, request: LodgingListingRequest): Observable<LodgingListing> {
    return this.http.put<LodgingListing>(`/api/v1/lodgings/${id}`, request);
  }

  deleteLodging(id: number): Observable<void> { return this.http.delete<void>(`/api/v1/lodgings/${id}`); }
  recalculateLodging(id: number): Observable<LodgingListing> { return this.http.post<LodgingListing>(`/api/v1/lodgings/${id}/distances/recalculate`, {}); }
  lodgingLocations(): Observable<LodgingReferenceLocation[]> { return this.http.get<LodgingReferenceLocation[]>('/api/v1/lodgings/reference-locations'); }
  lodgingAddressSuggestions(query: string): Observable<AddressSuggestion[]> { return this.http.get<AddressSuggestion[]>('/api/v1/lodgings/address-suggestions', {params: {q: query}}); }
  createLodgingLocation(body: {name: string; address: string; version: null}): Observable<LodgingReferenceLocation> { return this.http.post<LodgingReferenceLocation>('/api/v1/lodgings/reference-locations', body); }
  uploadLodgingImage(id: number, file: File): Observable<{attachmentId: number}> { const body = new FormData(); body.append('file', file, file.name); return this.http.post<{attachmentId: number}>(`/api/v1/lodgings/${id}/images`, body); }
  deleteLodgingImage(id: number, attachmentId: number): Observable<void> { return this.http.delete<void>(`/api/v1/lodgings/${id}/images/${attachmentId}`); }
  lodgingReviews(id: number): Observable<LodgingReview[]> { return this.http.get<LodgingReview[]>(`/api/v1/lodgings/${id}/reviews`); }
  reviewLodging(id: number, status: LodgingReviewStatus, reason: string | null): Observable<LodgingReview> { return this.http.put<LodgingReview>(`/api/v1/lodgings/${id}/reviews/me`, {status, reason}); }

  passwordVaultModules(search = ''): Observable<PasswordVaultModule[]> {
    return this.http.get<PasswordVaultModule[]>('/api/v1/password-vault/modules', {params: {search}});
  }
  createPasswordVaultModule(body: {name: string; websiteUrl: string | null; description: string | null; version: null}): Observable<PasswordVaultModule> {
    return this.http.post<PasswordVaultModule>('/api/v1/password-vault/modules', body);
  }
  updatePasswordVaultModule(id: number, body: {name: string; websiteUrl: string | null; description: string | null; version: number}): Observable<PasswordVaultModule> {
    return this.http.put<PasswordVaultModule>(`/api/v1/password-vault/modules/${id}`, body);
  }
  deletePasswordVaultModule(id: number, version: number): Observable<void> {
    return this.http.request<void>('DELETE', `/api/v1/password-vault/modules/${id}`, {body: {version}});
  }
  passwordVaultAccounts(moduleId: number, search = ''): Observable<PasswordVaultAccount[]> {
    return this.http.get<PasswordVaultAccount[]>(`/api/v1/password-vault/modules/${moduleId}/accounts`, {params: {search}});
  }
  createPasswordVaultAccount(moduleId: number, body: PasswordVaultAccountRequest): Observable<PasswordVaultAccount> {
    return this.http.post<PasswordVaultAccount>(`/api/v1/password-vault/modules/${moduleId}/accounts`, body);
  }
  updatePasswordVaultAccount(id: number, unlockToken: string, body: PasswordVaultAccountRequest): Observable<PasswordVaultAccount> {
    return this.http.put<PasswordVaultAccount>(`/api/v1/password-vault/accounts/${id}`, body,
      {headers: {'X-Vault-Unlock-Token': unlockToken}});
  }
  deletePasswordVaultAccount(id: number, version: number): Observable<void> {
    return this.http.request<void>('DELETE', `/api/v1/password-vault/accounts/${id}`, {body: {version}});
  }
  unlockPasswordVault(currentPassword: string): Observable<PasswordVaultUnlock> {
    return this.http.post<PasswordVaultUnlock>('/api/v1/password-vault/unlock', {currentPassword});
  }
  lockPasswordVault(unlockToken: string): Observable<void> {
    return this.http.request<void>('DELETE', '/api/v1/password-vault/unlock',
      {headers: {'X-Vault-Unlock-Token': unlockToken}});
  }
  passwordVaultSecret(id: number, unlockToken: string, body: {action: 'REVEAL' | 'COPY'; field?: 'USERNAME' | 'PASSWORD' | 'LOGIN_URL' | 'NOTE'}): Observable<PasswordVaultSecret> {
    return this.http.post<PasswordVaultSecret>(`/api/v1/password-vault/accounts/${id}/secret`, body,
      {headers: {'X-Vault-Unlock-Token': unlockToken}});
  }

  tutoringWeek(weekStart: string): Observable<TutoringWeek> {
    return this.http.get<TutoringWeek>('/api/v1/tutoring/week', {params: {weekStart}});
  }
  tutoringStudents(): Observable<TutoringStudent[]> {
    return this.http.get<TutoringStudent[]>('/api/v1/tutoring/students');
  }
  createTutoringStudent(body: TutoringStudentRequest): Observable<TutoringStudent> {
    return this.http.post<TutoringStudent>('/api/v1/tutoring/students', body);
  }
  updateTutoringStudent(id: number, body: TutoringStudentRequest): Observable<TutoringStudent> {
    return this.http.put<TutoringStudent>(`/api/v1/tutoring/students/${id}`, body);
  }
  deleteTutoringStudent(id: number, version: number): Observable<void> {
    return this.http.request<void>('DELETE', `/api/v1/tutoring/students/${id}`, {body: {version}});
  }
  createTutoringSeries(body: TutoringSeriesRequest): Observable<{id: number; version: number}> {
    return this.http.post<{id: number; version: number}>('/api/v1/tutoring/series', body);
  }
  updateTutoringSeries(id: number, body: TutoringSeriesRequest): Observable<{id: number; version: number}> {
    return this.http.put<{id: number; version: number}>(`/api/v1/tutoring/series/${id}`, body);
  }
  deleteTutoringSeries(id: number, effectiveFrom: string, version: number): Observable<void> {
    return this.http.request<void>('DELETE', `/api/v1/tutoring/series/${id}`, {body: {effectiveFrom, version}});
  }
  saveTutoringException(seriesId: number, occurrenceDate: string, action: TutoringExceptionAction,
                         movedDate: string | null, movedStartTime: string | null, movedEndTime: string | null,
                         version: number | null, confirmConflict: boolean): Observable<void> {
    return this.http.put<void>(`/api/v1/tutoring/series/${seriesId}/occurrences/${occurrenceDate}`,
      {action, movedDate, movedStartTime, movedEndTime, version, confirmConflict});
  }
  restoreTutoringException(seriesId: number, occurrenceDate: string, version: number,
                            confirmConflict: boolean): Observable<void> {
    return this.http.request<void>('DELETE',
      `/api/v1/tutoring/series/${seriesId}/occurrences/${occurrenceDate}`,
      {body: {version, confirmConflict}});
  }
}
