import { HttpClient, HttpParams, HttpResponse, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, forkJoin } from 'rxjs';
import {
  AccountImageImport, AccountLedger,
  AiModel, ApiLogDetail, ApiLogRow, BreakdownRow, CalibrationReport, ComparisonCoverage, ComparisonMatch, Dashboard, Filters, HistoryRow,
  LoginResponse, MarketPerformanceRow, MatchDetail, MatchRow, MatchSettlement, ModelPerformanceRow, MonteCarloReport,
  Page, PickSettlement, ReviewItem, PredictionDetail, PredictionRow, PromptTemplate, Provider, User, UserAuditRow,
  AdminResultRequest, AgentPrompt, PromptVersion, PromptVersionSummary, ResultResponse, SettlementPromptInput,
  PredictionIngestResponse, IssuedKey, KeyScope, ProviderKey, FixtureMergeRequest, FixtureBackfillResult, LeagueAlias, LeagueAliasRequest, AdminReasonRequest,
  FixtureSuggestion, FixtureView, TypeCompareBy, TypeComparisonRow,
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

  accountTransactionsResource(page: () => number, size: number) {
    return httpResource<AccountLedger>(() => ({ url: API + '/account/transactions', params: toParams({ page: page(), size }) }));
  }

  /** One import for the whole batch: the API returns one importId and one prompt. */
  uploadAccountImages(files: File[]) {
    const body = new FormData();
    for (const file of files) body.append('file', file);
    return this.http.post<AccountImageImport>(API + '/account/images', body);
  }

  // Reactive reads (httpResource). Call from an injection context (field initializer). They run again when the
  // signals they read change, cancel the superseded request and expose status()/error(); view with core/resource.ts.
  leaguesResource(enabled: () => boolean = () => true) { return httpResource<string[]>(() => (enabled() ? `${API}/matches/leagues` : undefined)); }
  /** `includeArchived` also lists archived providers; `enabled` false sends nothing. */
  providersResource(includeArchived = false, enabled: () => boolean = () => true) {
    return httpResource<Provider[]>(() => (enabled() ? { url: `${API}/providers`, params: toParams({ includeArchived: includeArchived || undefined }) } : undefined));
  }
  apiLogEndpointsResource() { return httpResource<string[]>(() => `${API}/api-logs/endpoints`); }
  /** Default list hides archived and merged models; `includeArchived` shows them too. */
  modelsResource(enabled: () => boolean = () => true, includeArchived: () => boolean = () => false) {
    return httpResource<AiModel[]>(() => (enabled() ? { url: `${API}/models`, params: toParams({ includeArchived: includeArchived() || undefined }) } : undefined));
  }
  matchResource(id: () => string) { return httpResource<MatchDetail>(() => `${API}/matches/${encodeURIComponent(id())}`); }
  /** A model with its breakdowns and latest predictions, loaded together; any failure fails the whole view. */
  modelOverviewResource(id: () => string) {
    return rxResource({
      params: id,
      stream: ({ params: modelId }) => {
        const f = { modelId };
        return forkJoin({
          model: this.http.get<AiModel>(`${API}/models/${encodeURIComponent(modelId)}`),
          market: this.breakdown(f, 'market'),
          type: this.breakdown(f, 'type'),
          recent: this.predictions(f, { page: 0, size: 15, sort: 'predictedAt,desc' }),
        });
      },
    });
  }
  /** One model's results by market and by league under the given filters (modelId included). */
  modelBreakdownResource(f: () => Filters) {
    return rxResource({
      params: f,
      stream: ({ params }) => forkJoin({ market: this.breakdown(params, 'market'), league: this.breakdown(params, 'league') }),
    });
  }
  /** Idle (no request) while `f` returns undefined, e.g. until the filter bar has reported its first filters. */
  dashboardResource(f: () => Filters | undefined, tz: string) {
    return httpResource<Dashboard>(() => { const x = f(); return x ? { url: `${API}/dashboard`, params: toParams({ ...x, tz }) } : undefined; });
  }
  recentPredictionsResource(f: () => Filters | undefined, size = 10) {
    return httpResource<Page<PredictionRow>>(() => {
      const x = f();
      return x ? { url: `${API}/predictions`, params: toParams({ ...x, page: 0, size, sort: 'predictedAt,desc' }) } : undefined;
    });
  }
  /** `status` '' lists everyone, else only ACTIVE or DISABLED accounts. */
  usersResource(enabled: () => boolean = () => true, status: () => string = () => '') {
    return httpResource<User[]>(() => (enabled() ? { url: `${API}/users`, params: toParams({ status: status() }) } : undefined));
  }
  promptsResource() { return httpResource<PromptTemplate[]>(() => `${API}/prompts`); }
  needsReviewResource() { return httpResource<ReviewItem[]>(() => `${API}/settlements/needs-review`); }
  predictionResource(id: () => string) { return httpResource<PredictionDetail>(() => `${API}/predictions/${encodeURIComponent(id())}`); }

  // Auth & users
  login(username: string, password: string) {
    return this.http.post<LoginResponse>(`${API}/auth/login`, { username, password });
  }
  logout() { return this.http.post<void>(`${API}/auth/logout`, {}); }
  me() { return this.http.get<User>(`${API}/auth/me`); }
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<void>(`${API}/auth/change-password`, { currentPassword, newPassword });
  }
  createUser(body: { username: string; password: string; role: string; mustChangePassword?: boolean }) {
    return this.http.post<User>(`${API}/users`, body);
  }
  updateUser(id: string, body: { role?: string; status?: string }) { return this.http.patch<User>(`${API}/users/${id}`, body); }
  resetPassword(id: string, newPassword: string, mustChangePassword = false) {
    return this.http.post<void>(`${API}/users/${id}/reset-password`, { newPassword, mustChangePassword });
  }
  /** Ends every session of the user on every device; `logout()` ends only this one. */
  logoutAll() { return this.http.post<void>(`${API}/auth/logout-all`, {}); }
  /** Sliding renewal: swap the stored token for the new one before `expiresAt`. A 401 means the session is over. */
  refreshToken() { return this.http.post<LoginResponse>(`${API}/auth/refresh`, {}); }
  /** Admin: sets the HttpOnly cookie that signs this session in to /monitor (Grafana). */
  monitorSession() { return this.http.post<void>(`${API}/auth/monitor-session`, {}); }
  /** Admin: a random 16-character password for the create-user and reset forms. Nothing is stored server-side. */
  generatePassword() { return this.http.post<{ password: string }>(`${API}/users/generate-password`, {}); }
  /** Admin: clear the failed-login lockout of a user. */
  unlockUser(id: string) { return this.http.post<void>(`${API}/users/${id}/unlock`, {}); }
  /** Admin: who changed which account (role, status, password reset, unlock). */
  userAudit(q: { userId?: string } & Paging) { return this.http.get<Page<UserAuditRow>>(`${API}/users/audit`, { params: toParams(q) }); }

  // Dashboard & reports
  modelPerformance(f: Filters) {
    return this.http.get<ModelPerformanceRow[]>(`${API}/reports/model-performance`, { params: toParams({ ...f }) });
  }
  breakdown(f: Filters, by: 'market' | 'league' | 'type' | 'stage' | 'model') {
    return this.http.get<BreakdownRow[]>(`${API}/reports/breakdown`, { params: toParams({ ...f, by }) });
  }
  typeComparison(f: Filters, by: TypeCompareBy) {
    return this.http.get<TypeComparisonRow[]>(`${API}/reports/type-comparison`, { params: toParams({ ...f, by }) });
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
  calibration(f: Filters) {
    return this.http.get<CalibrationReport>(`${API}/reports/calibration`, { params: toParams({ ...f }) });
  }
  modelComparison(f: Filters, minModels: number, p: Paging) {
    return this.http.get<Page<ComparisonMatch>>(`${API}/reports/model-comparison`, { params: toParams({ ...f, minModels, ...p }) });
  }
  modelComparisonCoverage(f: Filters) {
    return this.http.get<ComparisonCoverage[]>(`${API}/reports/model-comparison/coverage`, { params: toParams({ ...f }) });
  }
  monteCarlo(f: Filters, p: Paging) {
    return this.http.get<MonteCarloReport>(`${API}/reports/monte-carlo`, { params: toParams({ ...f, ...p }) });
  }

  // Matches & predictions
  matches(q: { search?: string; status?: string; league?: string; providerId?: string; from?: string; to?: string;
    overdue?: boolean; includeArchived?: boolean } & Paging) {
    return this.http.get<Page<MatchRow>>(`${API}/matches`, { params: toParams(q) });
  }
  /** resultScope: `result` applies to the top pick (TOP, default) or to any pick (ANY). */
  predictions(f: Filters, p: Paging, resultScope?: 'TOP' | 'ANY') {
    return this.http.get<Page<PredictionRow>>(`${API}/predictions`, { params: toParams({ ...f, ...p, resultScope }) });
  }

  // Archive, rename and merge (admin; every write needs a reason)
  models(q: { providerId?: string; includeArchived?: boolean }) { return this.http.get<AiModel[]>(`${API}/models`, { params: toParams(q) }); }
  /** Archived rows stay stored but leave every list, dropdown and figure unless `includeArchived=true`. */
  setArchived(kind: 'providers' | 'models' | 'matches', id: string, archived: boolean, reason: string) {
    return this.http.post<unknown>(`${API}/${kind}/${encodeURIComponent(id)}/${archived ? 'archive' : 'unarchive'}`, { reason });
  }
  /** Blank `displayName` restores the provider-supplied name. */
  renameModel(id: string, displayName: string, reason: string) {
    return this.http.patch<AiModel>(`${API}/models/${encodeURIComponent(id)}`, { displayName, reason });
  }
  mergeModel(id: string, targetModelId: string, reason: string) {
    return this.http.post<AiModel>(`${API}/models/${encodeURIComponent(id)}/merge`, { targetModelId, reason });
  }
  unmergeModel(id: string, reason: string) { return this.http.post<AiModel>(`${API}/models/${encodeURIComponent(id)}/unmerge`, { reason }); }

  // Fixtures: one real game across providers (admin writes need a reason)
  fixtureSuggestions(p: Paging) { return this.http.get<Page<FixtureSuggestion>>(`${API}/fixtures/suggestions`, { params: toParams({ ...p }) }); }
  /** Moves the matches and their fixture siblings into one fixture; results are not touched. */
  mergeMatches(matchIds: string[], reason: string) {
    return this.http.post<FixtureView>(`${API}/fixtures/merge`, { matchIds, reason } satisfies FixtureMergeRequest);
  }
  /** Links every match without a fixture (one-off, idempotent). */
  backfillFixtures() { return this.http.post<FixtureBackfillResult>(`${API}/fixtures/backfill`, {}); }
  /** Takes the match out of its fixture; returns the match detail. */
  unlinkMatch(id: string, reason: string) { return this.http.post<MatchDetail>(`${API}/matches/${encodeURIComponent(id)}/unlink`, { reason }); }

  // League aliases (UX-086): admin writes need a reason
  leagueAliases() { return this.http.get<LeagueAlias[]>(`${API}/leagues/aliases`); }
  addLeagueAlias(body: LeagueAliasRequest) { return this.http.post<LeagueAlias>(`${API}/leagues/aliases`, body); }
  removeLeagueAlias(id: string, reason: string) {
    return this.http.post<void>(`${API}/leagues/aliases/${encodeURIComponent(id)}/remove`, { reason } satisfies AdminReasonRequest);
  }

  // Providers and their API keys (admin)
  createProvider(body: { code: string; name: string; description?: string | null }) { return this.http.post<Provider>(`${API}/providers`, body); }
  /** A status change needs `reason`; the code never changes. */
  updateProvider(id: string, body: { name?: string; description?: string | null; status?: 'ACTIVE' | 'DISABLED'; reason?: string }) {
    return this.http.patch<Provider>(`${API}/providers/${encodeURIComponent(id)}`, body);
  }
  providerKeys(id: string) { return this.http.get<ProviderKey[]>(`${API}/providers/${encodeURIComponent(id)}/keys`); }
  issueKey(id: string, label: string, scopes: KeyScope[]) {
    return this.http.post<IssuedKey>(`${API}/providers/${encodeURIComponent(id)}/keys`, { label: label || null, scopes });
  }
  /** A new key with the same scopes; the old one keeps working until revoked. */
  rotateKey(id: string, keyRowId: string) {
    return this.http.post<IssuedKey>(`${API}/providers/${encodeURIComponent(id)}/keys/${encodeURIComponent(keyRowId)}/rotate`, {});
  }
  revokeKey(id: string, keyRowId: string, reason: string) {
    return this.http.post<void>(`${API}/providers/${encodeURIComponent(id)}/keys/${encodeURIComponent(keyRowId)}/revoke`, { reason });
  }
  setKeyScopes(id: string, keyRowId: string, scopes: KeyScope[], reason: string) {
    return this.http.put<ProviderKey>(`${API}/providers/${encodeURIComponent(id)}/keys/${encodeURIComponent(keyRowId)}/scopes`, { scopes, reason });
  }

  // Settlement (admin)
  settleMatch(matchId: string) { return this.http.post<MatchSettlement>(`${API}/settlements/matches/${matchId}`, {}); }
  recalculatePick(pickId: string, reason: string) {
    return this.http.post<PickSettlement>(`${API}/settlements/picks/${pickId}/recalculate`, { reason });
  }
  overridePick(pickId: string, result: string, reason: string) {
    return this.http.post<PickSettlement>(`${API}/settlements/picks/${pickId}/override`, { result, reason });
  }

  /** Admin only: the JSON body an agent printed because it could not reach the API, sent as is. */
  importPrediction(json: string, provider: string, model: string, modelVersion: string) {
    return this.http.post<PredictionIngestResponse>(`${API}/predictions/import`, json, {
      params: toParams({ provider, model, modelVersion }), headers: { 'Content-Type': 'application/json' },
    });
  }

  // Prompts
  prompts() { return this.http.get<PromptTemplate[]>(`${API}/prompts`); }
  /**
   * The prompt with the API URL and sheet link filled in, and for admins the legacy shared key while one is set. Never
   * stored or shown, only copied. `sharedKey` false always leaves the key placeholder (for a per-provider key).
   */
  promptForAgent(id: string, sharedKey = true) {
    return this.http.get<AgentPrompt>(`${API}/prompts/${id}/for-agent`, { params: toParams({ sharedKey: sharedKey ? undefined : false }) });
  }
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
  apiLog(id: string) { return this.http.get<ApiLogDetail>(`${API}/api-logs/${id}`); }

  // Match results, review and prompt history
  /** Admin: enter or correct a match result; FINISHED or CANCELLED settles the pending picks. */
  enterMatchResult(matchId: string, body: AdminResultRequest) {
    return this.http.post<ResultResponse>(`${API}/matches/${matchId}/result`, body);
  }
  /** Picks needing review, optionally of one match or one prediction. */
  needsReview(q: { matchId?: string; predictionId?: string } = {}) {
    return this.http.get<ReviewItem[]>(`${API}/settlements/needs-review`, { params: toParams(q) });
  }
  /** Admin: recalculate every pick of the match that needs review, with one reason. */
  recalculateMatch(matchId: string, reason: string) {
    return this.http.post<PickSettlement[]>(`${API}/settlements/matches/${matchId}/recalculate`, { reason });
  }
  settlementPromptInput(matchId: string) {
    return this.http.get<SettlementPromptInput>(`${API}/settlements/matches/${matchId}/prompt-input`);
  }
  promptVersions(id: string) { return this.http.get<PromptVersionSummary[]>(`${API}/prompts/${id}/versions`); }
  promptVersion(id: string, version: number) { return this.http.get<PromptVersion>(`${API}/prompts/${id}/versions/${version}`); }
  /** Admin: saves an old version again as the newest one. */
  restorePromptVersion(id: string, version: number, expectedVersion: number) {
    return this.http.post<PromptTemplate>(`${API}/prompts/${id}/versions/${version}/restore`, { expectedVersion });
  }
}
