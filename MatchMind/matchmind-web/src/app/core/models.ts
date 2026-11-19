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
}
export interface LoginResponse { accessToken: string; expiresAt: string; user: User; }

/** Shared query filters of predictions, dashboard and reports (`to` is exclusive). */
export interface Filters {
  from?: string; to?: string; league?: string; modelId?: string; providerId?: string;
  type?: PredictionType | ''; market?: Market | ''; matchId?: string; search?: string; result?: SettlementResult | '';
}

export interface Provider {
  id: string; code: string; name: string; models: number; predictions: number; lastCallbackAt: string | null; createdAt: string;
}

export interface AiModel {
  id: string; providerId: string; providerName: string; name: string; version: string; description: string | null;
  status: 'ACTIVE' | 'DISABLED'; totalPredictions: number; settledPicks: number; wins: number; losses: number;
  pendingPicks: number; winRate: number | null; lastPredictionAt: string | null; createdAt: string; updatedAt: string;
}

export interface MatchRow {
  id: string; externalMatchId: string; providerId: string; providerName: string; league: string; homeTeam: string;
  awayTeam: string; startTime: string; status: MatchStatus; finalHomeScore: number | null; finalAwayScore: number | null;
  finalHomeCorners: number | null; finalAwayCorners: number | null; htHomeScore: number | null; htAwayScore: number | null;
  htHomeCorners: number | null; htAwayCorners: number | null; resultUpdatedAt: string | null;
  predictionCount: number; modelCount: number; createdAt: string; updatedAt: string;
}

export interface LatestModelPrediction {
  predictionId: string; modelId: string; predictedAt: string; predictionType: PredictionType; matchMinute: number | null;
  predictedHomeScore: number | null; predictedAwayScore: number | null; correctScoreProbability: number | null;
  topPickMarket: Market | null; topPick: string | null; topPickProbability: number | null; topPickLine: number | null;
  topPickPrice: number | null; topPickResult: SettlementResult;
}
export interface MatchModelSummary {
  modelId: string; modelName: string; modelVersion: string; predictions: number; picks: number; wins: number;
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
export interface ResultHistory {
  id: string; previousResult: Record<string, unknown>; newResult: Record<string, unknown>; changeSource: string; changedAt: string;
}
export interface MatchDetail {
  match: MatchRow; models: MatchModelSummary[]; latestStats: MatchStats | null; resultHistory: ResultHistory[];
}

export interface PredictionRow {
  id: string; predictedAt: string; predictionType: PredictionType; matchMinute: number | null;
  currentHomeScore: number | null; currentAwayScore: number | null; eventId: string; matchId: string; league: string;
  homeTeam: string; awayTeam: string; startTime: string; matchStatus: MatchStatus; finalHomeScore: number | null;
  finalAwayScore: number | null; modelId: string; modelName: string; modelVersion: string;
  predictedHomeScore: number | null; predictedAwayScore: number | null; correctScoreProbability: number | null;
  topPickId: string | null; topPickMarket: Market | null; topPick: string | null; topPickProbability: number | null;
  topPickLine: number | null; topPickLineDisplay: string | null; topPickStage: string | null; topPickPrice: number | null;
  settlementStatus: SettlementResult; pickCount: number;
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
}

export interface PerformanceCounts {
  picks: number; settled: number; wins: number; losses: number; pushOrVoid: number; pending: number;
  halfWins: number; halfLosses: number; avgProbability: number | null; winRate: number | null;
}
export interface DashboardTotals extends PerformanceCounts {
  totalPredictions: number; totalMatches: number; activeModels: number; totalModels: number; predictionsToday: number;
}
export interface Dashboard {
  totals: DashboardTotals;
  winRateOverTime: { day: string; wins: number; losses: number; settled: number; winRate: number | null }[];
  predictionsByModel: { model: string; predictions: number }[];
  predictionsByMarket: { market: Market; picks: number }[];
  resultDistribution: { result: SettlementResult; picks: number }[];
  modelPerformance: (PerformanceCounts & { key: string })[];
}

export interface ModelPerformanceRow extends PerformanceCounts {
  modelId: string; modelName: string; modelVersion: string; providerName: string; predictions: number;
  correctScoreEvaluated: number; correctScoreHits: number; correctScoreAccuracy: number | null;
}
export interface BreakdownRow extends PerformanceCounts { key: string; }
export interface MarketPerformanceRow extends PerformanceCounts { market: Market; }

export interface HistoryRow {
  pickId: string; predictionId: string; predictedAt: string; matchId: string; league: string; homeTeam: string;
  awayTeam: string; startTime: string; matchStatus: MatchStatus; modelId: string; modelName: string; modelVersion: string;
  predictionType: PredictionType; matchMinute: number | null; currentHomeScore: number | null; currentAwayScore: number | null;
  predictedHomeScore: number | null; predictedAwayScore: number | null; correctScoreProbability: number | null;
  finalHomeScore: number | null; finalAwayScore: number | null; finalHomeCorners: number | null; finalAwayCorners: number | null;
  market: Market; pick: string; pickRank: number; probability: number; oddsStage: string; line: number | null;
  lineDisplay: string | null; price: number | null; settlementBasis: string; homeScoreAtCapture: number | null;
  awayScoreAtCapture: number | null; result: SettlementResult; settledAt: string | null; settlementSource: string | null;
}

export interface ComparisonEntry {
  matchId: string; predictionId: string; modelId: string; modelName: string; modelVersion: string; predictedAt: string;
  predictionType: PredictionType; matchMinute: number | null; predictedHomeScore: number | null; predictedAwayScore: number | null;
  correctScoreProbability: number | null; correctScoreHit: boolean | null; market: Market | null; pick: string | null;
  probability: number | null; line: number | null; lineDisplay: string | null; price: number | null;
  result: SettlementResult; predictionCount: number;
}
export interface ComparisonMatch {
  matchId: string; league: string; homeTeam: string; awayTeam: string; startTime: string; status: MatchStatus;
  finalHomeScore: number | null; finalAwayScore: number | null; finalHomeCorners: number | null; finalAwayCorners: number | null;
  models: ComparisonEntry[];
}

export interface MonteCarloRow {
  predictionId: string; predictedAt: string; matchId: string; league: string; homeTeam: string; awayTeam: string;
  matchStatus: MatchStatus; modelName: string; modelVersion: string; predictionType: PredictionType; matchMinute: number | null;
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
}
export interface ApiLogDetail extends Omit<ApiLogRow, 'providerName'> { apiKeyId: string | null; processingResult: unknown; }

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
