import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AiModel, ApiLogDetail, ApiLogRow, BreakdownRow, ComparisonMatch, Dashboard, Filters, HistoryRow,
  LoginResponse, MarketPerformanceRow, MatchDetail, MatchRow, MatchSettlement, ModelPerformanceRow, MonteCarloReport,
  Page, PickSettlement, ReviewItem, PredictionDetail, PredictionRow, PromptTemplate, Provider, User,
} from './models';

export const API = '/api/v1';

type ParamValue = string | number | boolean | null | undefined;

/** Drops empty values so the backend sees only filters the user actually set. */
export function toParams(values: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values) as [string, ParamValue][]) {
    if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
  }
  return params;
}

export interface Paging { page?: number; size?: number; sort?: string; }

/** The single place the web client talks to matchmind-api. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Auth & users
  login(username: string, password: string) {
    return this.http.post<LoginResponse>(`${API}/auth/login`, { username, password });
  }
  logout() { return this.http.post<void>(`${API}/auth/logout`, {}); }
  me() { return this.http.get<User>(`${API}/auth/me`); }
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<void>(`${API}/auth/change-password`, { currentPassword, newPassword });
  }
  users() { return this.http.get<User[]>(`${API}/users`); }
  createUser(body: { username: string; password: string; role: string }) { return this.http.post<User>(`${API}/users`, body); }
  updateUser(id: string, body: { role?: string; status?: string }) { return this.http.patch<User>(`${API}/users/${id}`, body); }
  resetPassword(id: string, newPassword: string) {
    return this.http.post<void>(`${API}/users/${id}/reset-password`, { newPassword });
  }

  // Dashboard & reports
  dashboard(f: Filters, tz: string) {
    return this.http.get<Dashboard>(`${API}/dashboard`, { params: toParams({ ...f, tz }) });
  }
  modelPerformance(f: Filters) {
    return this.http.get<ModelPerformanceRow[]>(`${API}/reports/model-performance`, { params: toParams({ ...f }) });
  }
  breakdown(f: Filters, by: 'market' | 'league' | 'type' | 'stage' | 'model') {
    return this.http.get<BreakdownRow[]>(`${API}/reports/breakdown`, { params: toParams({ ...f, by }) });
  }
  predictionHistory(f: Filters, p: Paging) {
    return this.http.get<Page<HistoryRow>>(`${API}/reports/prediction-history`, { params: toParams({ ...f, ...p }) });
  }
  exportHistory(f: Filters, format: 'csv' | 'xlsx', sort?: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API}/reports/prediction-history/export`, {
      params: toParams({ ...f, format, sort }), responseType: 'blob', observe: 'response',
    });
  }
  marketPerformance(f: Filters) {
    return this.http.get<MarketPerformanceRow[]>(`${API}/reports/market-performance`, { params: toParams({ ...f }) });
  }
  modelComparison(f: Filters, minModels: number, p: Paging) {
    return this.http.get<Page<ComparisonMatch>>(`${API}/reports/model-comparison`, { params: toParams({ ...f, minModels, ...p }) });
  }
  monteCarlo(f: Filters, p: Paging) {
    return this.http.get<MonteCarloReport>(`${API}/reports/monte-carlo`, { params: toParams({ ...f, ...p }) });
  }

  // Matches & predictions
  matches(q: { search?: string; status?: string; league?: string; providerId?: string; from?: string; to?: string } & Paging) {
    return this.http.get<Page<MatchRow>>(`${API}/matches`, { params: toParams(q) });
  }
  leagues() { return this.http.get<string[]>(`${API}/matches/leagues`); }
  match(id: string) { return this.http.get<MatchDetail>(`${API}/matches/${id}`); }
  predictions(f: Filters, p: Paging) {
    return this.http.get<Page<PredictionRow>>(`${API}/predictions`, { params: toParams({ ...f, ...p }) });
  }
  prediction(id: string) { return this.http.get<PredictionDetail>(`${API}/predictions/${id}`); }

  // Settlement (admin)
  needsReview() { return this.http.get<ReviewItem[]>(`${API}/settlements/needs-review`); }
  settleMatch(matchId: string) { return this.http.post<MatchSettlement>(`${API}/settlements/matches/${matchId}`, {}); }
  recalculatePick(pickId: string, reason: string) {
    return this.http.post<PickSettlement>(`${API}/settlements/picks/${pickId}/recalculate`, { reason });
  }
  overridePick(pickId: string, result: string, reason: string) {
    return this.http.post<PickSettlement>(`${API}/settlements/picks/${pickId}/override`, { result, reason });
  }

  // AI models & providers
  models(providerId?: string) { return this.http.get<AiModel[]>(`${API}/models`, { params: toParams({ providerId }) }); }
  model(id: string) { return this.http.get<AiModel>(`${API}/models/${id}`); }
  providers() { return this.http.get<Provider[]>(`${API}/providers`); }

  // Prompts
  prompts() { return this.http.get<PromptTemplate[]>(`${API}/prompts`); }
  updatePrompt(id: string, body: { content: string; description: string | null; active: boolean; expectedVersion: number }) {
    return this.http.put<PromptTemplate>(`${API}/prompts/${id}`, body);
  }
  createPrompt(body: { name: string; templateType: string; content: string; description: string | null }) {
    return this.http.post<PromptTemplate>(`${API}/prompts`, body);
  }

  // API logs
  apiLogs(q: { providerId?: string; status?: string; endpoint?: string; search?: string; from?: string; to?: string } & Paging) {
    return this.http.get<Page<ApiLogRow>>(`${API}/api-logs`, { params: toParams(q) });
  }
  apiLogEndpoints() { return this.http.get<string[]>(`${API}/api-logs/endpoints`); }
  apiLog(id: string) { return this.http.get<ApiLogDetail>(`${API}/api-logs/${id}`); }
}
