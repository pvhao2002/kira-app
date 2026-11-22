// Typed contracts of matchmind-api (see docs/API_DOCUMENTATION.md). Instants are ISO-8601 UTC strings.

export type Market = '1X2' | 'AH' | 'OU' | 'CORNER_AH' | 'CORNER_OU';
export type PredictionType = 'PRE_MATCH' | 'LIVE';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'POSTPONED';
export type SettlementResult = 'WIN' | 'LOSS' | 'HALF_WIN' | 'HALF_LOSS' | 'PUSH' | 'VOID' | 'PENDING';
export type Role = 'ADMIN' | 'VIEWER';

export const MARKETS: Market[] = ['1X2', 'AH', 'OU', 'CORNER_AH', 'CORNER_OU'];
export const RESULTS: SettlementResult[] = ['WIN', 'HALF_WIN', 'PUSH', 'HALF_LOSS', 'LOSS', 'VOID', 'PENDING'];
export const MATCH_STATUSES: MatchStatus[] = ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED'];

export interface PageMeta { page: number; size: number; totalElements: number; totalPages: number; }
export interface Page<T> { data: T[]; meta: PageMeta; }

export interface ApiError {
  status: number; code: string; message: string; fieldErrors?: Record<string, string>; traceId?: string;
}

export interface User {
  id: string; username: string; role: Role; status: 'ACTIVE' | 'DISABLED';
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
  /** UX-059: the next sign-in must change the password first (every other call is 403 PASSWORD_CHANGE_REQUIRED). */
  mustChangePassword?: boolean;
  /** UX-043: the user has too many failed sign-ins from some IP; an admin can unlock (`POST /users/{id}/unlock`). */
  loginLocked?: boolean;
}
export interface LoginResponse { accessToken: string; expiresAt: string; user: User; }

/** Shared query filters of predictions, dashboard and reports (`to` is exclusive). */
export interface Filters {
  from?: string; to?: string;
  /** Predictions list only: bounds on the match kick-off time (`to` exclusive), where from/to bound the prediction time. */
  kickoffFrom?: string; kickoffTo?: string; league?: string; modelId?: string; providerId?: string;
  type?: PredictionType | ''; market?: Market | ''; matchId?: string; search?: string; result?: SettlementResult | '';
  /** `true` also counts archived providers, models and matches. */
  includeArchived?: boolean;
  /** Aggregates only (UX-046): `latest` (default) counts the latest prediction per fixture, model, type and minute. */
  countPolicy?: CountPolicy;
}
export type CountPolicy = 'latest' | 'all';

export interface Provider {
  id: string; code: string; name: string; models: number; predictions: number; lastCallbackAt: string | null; createdAt: string;
  archivedAt?: string | null;
  description?: string | null; status?: 'ACTIVE' | 'DISABLED'; disabledAt?: string | null; disabledReason?: string | null;
  /** Per-provider API keys not revoked. */
  activeKeys?: number;
}

export type KeyScope = 'PREDICTIONS' | 'SETTLE_REQUEST' | 'RESULTS';
/** A provider API key as listed: never the secret or its hash. */
export interface ProviderKey {
  id: string; keyId: string; label: string | null; scopes: KeyScope[]; status: 'ACTIVE' | 'REVOKED';
  createdAt: string; lastUsedAt: string | null; revokedAt: string | null;
}
/** Issue / rotate response: `apiKey` (mmk_...) is returned this once only. */
export interface IssuedKey { id: string; keyId: string; label: string | null; apiKey: string; scopes: KeyScope[]; createdAt: string; }

export interface AiModel {
  id: string; providerId: string; providerName: string; name: string; version: string; description: string | null;
  status: 'ACTIVE' | 'DISABLED'; totalPredictions: number; settledPicks: number; wins: number; losses: number;
  pendingPicks: number; winRate: number | null; lastPredictionAt: string | null; createdAt: string; updatedAt: string;
  /** UX-018 fixed stake of 1 per pick; units and roi are null when staked = 0. */
  units: number | null; staked: number; roi: number | null;
  /** What to show: the admin's rename, else `name` (the provider-supplied key). */
  displayName?: string; archivedAt?: string | null; mergedIntoId?: string | null;
}

export interface MatchRow {
  archivedAt?: string | null;
  id: string; externalMatchId: string; providerId: string; providerName: string; league: string; homeTeam: string;
  awayTeam: string; startTime: string; status: MatchStatus; finalHomeScore: number | null; finalAwayScore: number | null;
  finalHomeCorners: number | null; finalAwayCorners: number | null; htHomeScore: number | null; htAwayScore: number | null;
  htHomeCorners: number | null; htAwayCorners: number | null; resultUpdatedAt: string | null;
  predictionCount: number; modelCount: number; createdAt: string; updatedAt: string;
  /** Kick-off more than 3 h ago and still SCHEDULED or LIVE: the result is due. */
  overdue: boolean;
  /** The fixture (one real game across providers) this match is linked to; null before the backfill. */
  fixtureId?: string | null;
}

/** One match row of a fixture. */
export interface FixtureMember {
  matchId: string; providerId: string; providerName: string; externalMatchId: string; league: string; homeTeam: string;
  awayTeam: string; startTime: string; status: MatchStatus; finalHomeScore: number | null; finalAwayScore: number | null;
  archivedAt: string | null;
}
/** GET /matches/{id} `fixture` and the POST /fixtures/merge response. */
export interface FixtureView {
  id: string; members: FixtureMember[];
  /** Non-archived FINISHED members disagree on the final score. */
  resultMismatch: boolean;
}
/** One side of a suggested merge: the first member of a fixture (an unlinked match is its own fixture). */
export interface FixtureSuggestionSide {
  fixtureId: string; matchId: string; providerName: string; externalMatchId: string; league: string; homeTeam: string;
  awayTeam: string; startTime: string; status: MatchStatus;
}
export interface FixtureSuggestion {
  a: FixtureSuggestionSide; b: FixtureSuggestionSide; reason: 'SAME_TEAMS' | 'SIMILAR_NAMES';
  /** 1 for the same normalised teams, else the trigram similarity of the team names (0.5–1). */
  score: number;
}
export interface FixtureMergeRequest extends AdminReasonRequest { matchIds: string[]; }
/** POST /fixtures/backfill: how many matches without a fixture were linked. */
export interface FixtureBackfillResult { linked: number; }

/** A variant league name an admin mapped to a canonical one (UX-086); filters, dropdown and reports use the canonical. */
export interface LeagueAlias { id: string; alias: string; canonical: string; createdAt: string; }
export interface LeagueAliasRequest extends AdminReasonRequest { alias: string; canonical: string; }

export interface AdminReasonRequest { reason: string; }
export interface ModelRenameRequest extends AdminReasonRequest { displayName: string; }
export interface ModelMergeRequest extends AdminReasonRequest { targetModelId: string; }

export interface LatestModelPrediction {
  predictionId: string; modelId: string; predictedAt: string; predictionType: PredictionType; matchMinute: number | null;
  predictedHomeScore: number | null; predictedAwayScore: number | null; correctScoreProbability: number | null;
  topPickMarket: Market | null; topPick: string | null; topPickProbability: number | null; topPickLine: number | null;
  topPickPrice: number | null; topPickResult: SettlementResult;
}
export interface MatchModelSummary {
  modelId: string; modelName: string; modelKey?: string; modelVersion: string; predictions: number; picks: number; wins: number;
  losses: number; pushOrVoid: number; pending: number; winRate: number | null; lastPredictedAt: string;
  latest: LatestModelPrediction | null;
}
export interface MatchStats {
  predictionId: string; matchMinute: number | null; predictedAt: string;
  possessionHome: number | null; possessionAway: number | null; shotsHome: number | null; shotsAway: number | null;
  shotsOnTargetHome: number | null; shotsOnTargetAway: number | null; shotsOffTargetHome: number | null;
  shotsOffTargetAway: number | null; cornersHome: number | null; cornersAway: number | null;
  yellowCardsHome: number | null; yellowCardsAway: number | null; redCardsHome: number | null; redCardsAway: number | null;
}
/** Response of POST /external/predictions and /predictions/import. */
export interface PredictionIngestResponse {
  predictionId: string; matchId: string; externalMatchId: string; duplicate: boolean;
  picks: { pickId: string; rank: number; market: Market; pick: string; oddsId: string }[];
  odds: Record<string, string>;
  /** On a 201: an earlier prediction with the same model, match, type, minute and picks (agent retry). */
  possibleDuplicateOf: string | null;
}
/** previousResult/newResult may also be a kick-off move: { startTime, status }. */
export interface ResultHistory {
  id: string; previousResult: Record<string, unknown>; newResult: Record<string, unknown>; changeSource: string; changedAt: string;
}
export interface MatchDetail {
  match: MatchRow; models: MatchModelSummary[]; latestStats: MatchStats | null; resultHistory: ResultHistory[];
  /** Null while the match is not linked to a fixture. */
  fixture?: FixtureView | null;
}

export interface PredictionRow {
  id: string; predictedAt: string; predictionType: PredictionType; matchMinute: number | null;
  currentHomeScore: number | null; currentAwayScore: number | null; eventId: string; matchId: string; league: string;
  homeTeam: string; awayTeam: string; startTime: string; matchStatus: MatchStatus; finalHomeScore: number | null;
  finalAwayScore: number | null; modelId: string; modelName: string; modelKey?: string; modelVersion: string;
  predictedHomeScore: number | null; predictedAwayScore: number | null; correctScoreProbability: number | null;
  topPickId: string | null; topPickMarket: Market | null; topPick: string | null; topPickProbability: number | null;
  topPickLine: number | null; topPickLineDisplay: string | null; topPickStage: string | null; topPickPrice: number | null;
  settlementStatus: SettlementResult; pickCount: number;
  /** Current results of all picks; mutually exclusive, they sum to pickCount. */
  pickWins: number; pickHalfWins: number; pickLosses: number; pickHalfLosses: number; pickPushOrVoid: number;
  pickPending: number;
  /** False when a later prediction of the same fixture, model, type and minute supersedes it in aggregates. */
  counted: boolean;
}

export interface OddsSnapshot {
  id: string; ref: string; market: Market; stage: 'OPENING' | 'PRE_MATCH' | 'LIVE'; snapshotOrder: number;
  line: number | null; lineDisplay: string | null; homeOdds: number | null; drawOdds: number | null; awayOdds: number | null;
  overOdds: number | null; underOdds: number | null; settlementBasis: 'FULL_MATCH' | 'REMAINING_MATCH';
  homeScoreAtCapture: number | null; awayScoreAtCapture: number | null; homeCornersAtCapture: number | null;
  awayCornersAtCapture: number | null; capturedAt: string | null; extra: unknown;
}
export interface PickResultRow {
  id: string; result: SettlementResult; settledAt: string; source: string; calculationVersion: string; current: boolean;
  supersededAt: string | null; reason: string | null; details: Record<string, unknown>;
}
export interface PickDetail {
  id: string; rank: number; market: Market; pick: string; probability: number; oddsId: string; oddsRef: string;
  price: number | null; line: number | null; stage: string; settlementStatus: SettlementResult; results: PickResultRow[];
}
export interface PredictionStatsView {
  possessionHome: number | null; possessionAway: number | null; shotsHome: number | null; shotsAway: number | null;
  shotsOnTargetHome: number | null; shotsOnTargetAway: number | null; shotsOffTargetHome: number | null;
  shotsOffTargetAway: number | null; cornersHome: number | null; cornersAway: number | null;
  yellowCardsHome: number | null; yellowCardsAway: number | null; redCardsHome: number | null; redCardsAway: number | null;
  extra: unknown;
}
export interface SimulationView {
  method: string; simulationCount: number; randomSeed: number | null; expectedRemainingHomeGoals: number | null;
  expectedRemainingAwayGoals: number | null; expectedRemainingHomeCorners: number | null;
  expectedRemainingAwayCorners: number | null; algorithmVersion: string | null; parameters: unknown;
  probabilities: unknown; correctScoreDistribution: { home: number; away: number; probability: number }[] | null;
}
export interface PredictionDetail {
  id: string; eventId: string; predictionType: PredictionType; matchMinute: number | null;
  currentHomeScore: number | null; currentAwayScore: number | null; currentHomeCorners: number | null;
  currentAwayCorners: number | null; predictedAt: string; createdAt: string;
  match: {
    id: string; externalMatchId: string; providerId: string; providerName: string; league: string; homeTeam: string;
    awayTeam: string; startTime: string; status: MatchStatus; finalHomeScore: number | null; finalAwayScore: number | null;
    finalHomeCorners: number | null; finalAwayCorners: number | null; htHomeScore: number | null; htAwayScore: number | null;
  };
  model: { id: string; name: string; version: string };
  odds: OddsSnapshot[]; stats: PredictionStatsView | null; simulation: SimulationView | null; picks: PickDetail[];
  correctScores: { rank: number; home: number; away: number; probability: number | null }[];
  metadata: unknown; payload: unknown;
  /** Whether reports count it (countPolicy=latest). */
  counted: boolean;
  /** Other predictions of the same counting key, oldest first; `exact` = same content apart from eventId/predictedAt/metadata. */
  similar: SimilarPrediction[];
}
export interface SimilarPrediction { predictionId: string; predictedAt: string; exact: boolean; counted: boolean; }

export interface PerformanceCounts {
  picks: number; settled: number; wins: number; losses: number; pushOrVoid: number; pending: number;
  halfWins: number; halfLosses: number; avgProbability: number | null; winRate: number | null;
  /** WIN / LOSS only. fullWins + halfWins + fullLosses + halfLosses + pushOrVoid = settled (wins/losses include halves). */
  fullWins: number; fullLosses: number;
  /** UX-018 profit at stake 1 (scale 3), stakes placed (PUSH in, VOID out) and units / staked; null when staked = 0. */
  units: number | null; staked: number; roi: number | null;
}
export interface DashboardTotals extends PerformanceCounts {
  totalPredictions: number; totalMatches: number; activeModels: number; totalModels: number; predictionsToday: number;
  /** Matches overdue for a result; same scope as GET /matches?overdue=true&league=&providerId= (no date/model filter). */
  overdueMatches: number;
  /** Predictions inside the filters that countPolicy=latest leaves out (0 under `all`). */
  notCountedPredictions: number;
}
/** What the dashboard counted: requested bounds (null = open) on predictedAt and the first/last prediction inside them. */
export interface DashboardPeriod {
  from: string | null; to: string | null; basis: 'predictedAt'; firstPredictedAt: string | null; lastPredictedAt: string | null;
}
export interface Dashboard {
  period: DashboardPeriod;
  totals: DashboardTotals;
  winRateOverTime: { day: string; wins: number; losses: number; settled: number; winRate: number | null; units: number | null }[];
  predictionsByModel: { model: string; predictions: number }[];
  predictionsByMarket: { market: Market; picks: number }[];
  resultDistribution: { result: SettlementResult; picks: number }[];
  modelPerformance: (PerformanceCounts & { key: string })[];
}

export interface ModelPerformanceRow extends PerformanceCounts {
  modelId: string; modelName: string; modelKey?: string; modelVersion: string; providerName: string; predictions: number;
  correctScoreEvaluated: number; correctScoreHits: number; correctScoreAccuracy: number | null;
  notCountedPredictions: number;
}
export interface BreakdownRow extends PerformanceCounts { key: string; }
export interface MarketPerformanceRow extends PerformanceCounts { market: Market; }

export interface HistoryRow {
  pickId: string; predictionId: string; predictedAt: string; matchId: string; league: string; homeTeam: string;
  awayTeam: string; startTime: string; matchStatus: MatchStatus; modelId: string; modelName: string; modelKey?: string; modelVersion: string;
  predictionType: PredictionType; matchMinute: number | null; currentHomeScore: number | null; currentAwayScore: number | null;
  predictedHomeScore: number | null; predictedAwayScore: number | null; correctScoreProbability: number | null;
  finalHomeScore: number | null; finalAwayScore: number | null; finalHomeCorners: number | null; finalAwayCorners: number | null;
  market: Market; pick: string; pickRank: number; probability: number; oddsStage: string; line: number | null;
  lineDisplay: string | null; price: number | null; settlementBasis: string; homeScoreAtCapture: number | null;
  awayScoreAtCapture: number | null; result: SettlementResult; settledAt: string | null; settlementSource: string | null;
  counted: boolean;
  /** The pick's profit at stake 1; null when VOID or pending. */
  units: number | null;
}

/** GET /reports/calibration: always 10 bins of width 0.1; WIN/LOSS evaluated, other settled results excluded. */
export interface CalibrationBin {
  bin: number; from: number; to: number; picks: number; avgProbability: number | null; hitRate: number | null;
}
export interface CalibrationReport { bins: CalibrationBin[]; evaluated: number; excluded: number; }

export interface ComparisonEntry {
  /** The entry's own match: models of different providers predict different match rows of one fixture. */
  matchId: string; providerName?: string; predictionId: string; modelId: string; modelName: string; modelKey?: string; modelVersion: string; predictedAt: string;
  predictionType: PredictionType; matchMinute: number | null; predictedHomeScore: number | null; predictedAwayScore: number | null;
  correctScoreProbability: number | null; correctScoreHit: boolean | null; market: Market | null; pick: string | null;
  probability: number | null; line: number | null; lineDisplay: string | null; price: number | null;
  result: SettlementResult; predictionCount: number;
}
/** One fixture of the model comparison; the match fields are its first member's. */
export interface ComparisonMatch {
  /** The fixture id, or the match id while the match is not linked. */
  fixtureId?: string; resultMismatch?: boolean;
  matchId: string; league: string; homeTeam: string; awayTeam: string; startTime: string; status: MatchStatus;
  finalHomeScore: number | null; finalAwayScore: number | null; finalHomeCorners: number | null; finalAwayCorners: number | null;
  models: ComparisonEntry[];
}

/** Matches GET /reports/model-comparison would return for each minModels value. */
export interface ComparisonCoverage { minModels: number; matches: number; }

export interface MonteCarloRow {
  predictionId: string; predictedAt: string; matchId: string; league: string; homeTeam: string; awayTeam: string;
  matchStatus: MatchStatus; modelName: string; modelKey?: string; modelVersion: string; predictionType: PredictionType; matchMinute: number | null;
  currentHomeScore: number | null; currentAwayScore: number | null; method: string; simulationCount: number;
  randomSeed: number | null; algorithmVersion: string | null; expectedHomeGoals: number | null; expectedAwayGoals: number | null;
  expectedHomeCorners: number | null; expectedAwayCorners: number | null; probabilitiesJson: string | null;
  distributionJson: string | null; predictedHomeScore: number | null; predictedAwayScore: number | null;
  correctScoreProbability: number | null; finalHomeScore: number | null; finalAwayScore: number | null;
  finalHomeCorners: number | null; finalAwayCorners: number | null; actualRemainingGoals: number | null;
  topPickResult: SettlementResult | null;
}
export interface MonteCarloReport {
  summary: {
    simulatedPredictions: number; avgSimulationCount: number | null; avgExpectedRemainingGoals: number | null;
    finishedPredictions: number; avgActualRemainingGoals: number | null; meanAbsGoalError: number | null;
    correctScoreHits: number; correctScoreAccuracy: number | null;
  };
  page: Page<MonteCarloRow>;
}

export interface PromptTemplate {
  id: string; name: string; templateType: string; content: string; description: string | null; version: number;
  active: boolean; updatedBy: string | null; createdAt: string; updatedAt: string;
}

export interface ApiLogRow {
  id: string; receivedAt: string; providerId: string | null; providerName: string | null; endpoint: string;
  httpMethod: string; requestId: string; eventId: string | null; httpStatus: number;
  requestStatus: 'SUCCESS' | 'DUPLICATE' | 'REJECTED' | 'FAILED'; durationMs: number; errorMessage: string | null;
  clientIp: string | null;
  /** UX-052: the signed-in admin behind an import, settle or override; null for agent calls. */
  actor?: string | null;
  /** Made with the legacy shared EXTERNAL_API_KEY (watch these reach zero before the cut-over). */
  legacyKey?: boolean;
}
export interface ApiLogDetail extends ApiLogRow { apiKeyId: string | null; processingResult: unknown; }

export interface PickSettlement {
  pickId: string; market: Market; pick: string; result: SettlementResult; status: string; reason: string | null;
  aiResult: string | null; aiAgrees: boolean | null;
}
export interface MatchSettlement {
  matchId: string; matchStatus: MatchStatus; settled: number; alreadySettled: number; pending: number; needsReview: number;
  picks: PickSettlement[];
}
export interface ReviewItem {
  pickId: string; predictionId: string; matchId: string; homeTeam: string; awayTeam: string; matchStatus: string;
  market: Market; pick: string; currentResult: SettlementResult; newResult: SettlementResult; reason: string | null;
  settledAt: string;
}

/** UX-044: one row of the account audit (`GET /users/audit`). `oldValue`/`newValue` hold role or status changes. */
export interface UserAuditRow {
  id: string; at: string; actor: string | null; targetId: string; target: string;
  action: 'USER_CREATED' | 'ROLE_CHANGED' | 'STATUS_CHANGED' | 'PASSWORD_RESET' | 'PASSWORD_CHANGED' | 'LOGIN_UNLOCKED';
  oldValue: string | null; newValue: string | null; clientIp: string | null;
}
export interface ScorePair { home: number; away: number; }
/** POST /matches/{id}/result (admin). Same rules as the external results API; resultAt is the server time. */
export interface AdminResultRequest {
  status: MatchStatus; finalScore?: ScorePair | null; finalCorners?: ScorePair | null; halfTimeScore?: ScorePair | null;
  halfTimeCorners?: ScorePair | null; reason?: string | null;
}
export interface ResultResponse {
  matchId: string; status: MatchStatus; changed: boolean; settlement: MatchSettlement | null;
  /** Other members of the match's fixture that took this result. */
  propagatedTo?: string[];
}
/** GET /settlements/matches/{id}/prompt-input: what the settlement prompt needs, with the pick ids. */
export interface SettlementPromptInput {
  matchId: string; externalMatchId: string; league: string; homeTeam: string; awayTeam: string; startTime: string;
  status: MatchStatus; finalScore: ScorePair | null; finalCorners: ScorePair | null; halfTimeScore: ScorePair | null;
  picks: SettlementPromptInputPick[];
}
export interface SettlementPromptInputPick {
  pickId: string; predictionId: string; market: Market; pick: string; line: number | null; lineDisplay: string | null;
  oddsStage: string; settlementBasis: string | null; price: number | null; scoreAtCapture: ScorePair | null;
  cornersAtCapture: ScorePair | null; currentResult: SettlementResult;
}
/** keyRendered is false when {{EXTERNAL_API_KEY}} is still in the text (viewers, or no key configured). */
export interface AgentPrompt { content: string; keyRendered: boolean; }
export interface PromptVersionSummary {
  version: number; description: string | null; active: boolean; updatedBy: string | null; updatedByUsername: string | null;
  createdAt: string;
}
export interface PromptVersion extends PromptVersionSummary { content: string; }
