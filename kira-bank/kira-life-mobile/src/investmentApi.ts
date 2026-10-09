import {API_URL, ApiError, useAuth} from './auth';

export type PageMeta = { page: number; size: number; totalElements: number; totalPages: number };
export type PageResponse<T> = { data: T[]; meta: PageMeta };

const errorMessages: Record<string, string> = {
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ.',
  ACCOUNT_VERSION_CONFLICT: 'Tài khoản đã được cập nhật ở nơi khác. Vui lòng tải lại và thử lại.',
  INVESTMENT_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED: 'Máy chủ chưa cấu hình khóa bảo vệ mật khẩu tài khoản đầu tư.',
  INVESTMENT_ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản đầu tư.',
  INVESTMENT_TRANSACTION_NOT_FOUND: 'Không tìm thấy giao dịch đầu tư.',
  INVESTMENT_TRANSACTION_DUPLICATE: 'Giao dịch tương tự đã tồn tại trong sổ đối soát.',
  INVALID_ACCOUNT_STATUS: 'Trạng thái tài khoản không hợp lệ.',
  AI_NOT_CONFIGURED: 'Hệ thống AI chưa được cấu hình trên máy chủ.',
  IMPORT_RATE_LIMITED: 'Bạn đã tạo quá nhiều lô nhập. Vui lòng thử lại sau ít phút.',
  IMPORT_BATCH_NOT_REVIEWABLE: 'Lô nhập chưa thể duyệt ở trạng thái hiện tại.',
  IMPORT_ITEM_VERSION_CONFLICT: 'Bản ghi đã thay đổi. Vui lòng tải lại và thử lại.',
  INVESTMENT_CURRENCY_MISMATCH: 'Tiền tệ không khớp với tài khoản.',
  IMPORT_CONFLICT_REQUIRES_RESOLUTION: 'Bản ghi trùng lặp, vui lòng chọn cách xử lý.',
  EXTERNAL_TRANSACTION_ID_ALREADY_EXISTS: 'Mã giao dịch bên ngoài đã tồn tại.',
  IMPORT_MERGE_TARGET_NOT_FOUND: 'Không tìm thấy giao dịch để gộp.',
  IMPORT_BATCH_COMPLETED: 'Lô nhập đã hoàn tất, không thể chỉnh sửa thêm.',
  IMPORT_FILE_NOT_FOUND: 'Không tìm thấy tệp.',
  IMPORT_BATCH_NOT_FOUND: 'Không tìm thấy lô nhập.',
  INVALID_IMPORT_FILE_COUNT: 'Mỗi lô cần từ 1 đến 10 ảnh.',
  IMPORT_BATCH_TOO_LARGE: 'Tổng dung lượng ảnh vượt quá 50MB.',
  AI_RUN_CAPACITY_EXCEEDED: 'Hệ thống AI đang xử lý quá nhiều yêu cầu. Vui lòng thử lại sau vài giây.',
  AI_JOB_NOT_RERUNNABLE: 'Công việc này chưa thể chạy lại.',
  ATTACHMENT_PURGED: 'Ảnh gốc đã bị xóa khỏi hệ thống lưu trữ.',
  IMPORT_CONCURRENT_CONFIRM_FAILED: 'Có xung đột khi xác nhận đồng thời. Vui lòng thử lại.',
  INVESTMENT_REPORT_NOT_FOUND: 'Không tìm thấy hồ sơ tra soát.',
  INVESTMENT_REPORT_TYPE_NOT_FOUND: 'Không tìm thấy loại báo cáo này.',
  INVALID_REPORT_RANGE: 'Khoảng ngày không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
  REPORT_RANGE_TOO_LARGE: 'Khoảng ngày tối đa là 5 năm.',
  INVALID_REPORT_GRANULARITY: 'Cách nhóm kỳ không hợp lệ.',
  INVESTMENT_GOAL_NOT_FOUND: 'Không tìm thấy mục tiêu.',
  INVALID_GOAL_CURRENCY: 'Bạn chưa có tài khoản đầu tư nào dùng loại tiền này.',
  TOO_MANY_GOALS: 'Bạn đã đạt số mục tiêu tối đa (20).',
  INVESTMENT_REPORT_ALREADY_OPEN: 'Giao dịch này đã có hồ sơ tra soát đang mở.',
  INVESTMENT_REPORT_VERSION_CONFLICT: 'Hồ sơ tra soát đã thay đổi ở nơi khác. Vui lòng tải lại.',
  INVESTMENT_REPORT_CLOSED: 'Hồ sơ tra soát đã được đóng.',
  DEFAULT: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
};

export function errorCode(e: unknown) {
  return e instanceof ApiError ? e.code : 'NETWORK';
}

export function errorMessage(e: unknown) {
  return errorMessages[errorCode(e)] || errorMessages.DEFAULT;
}

export function errorMessageForCode(code: string | null | undefined) {
  return errorMessages[code || ''] || errorMessages.DEFAULT;
}

export type InvestmentTransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'BONUS';
export type InvestmentTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type InvestmentReconciliationReportReason =
  'AMOUNT_MISMATCH'
  | 'DUPLICATE_TRANSACTION'
  | 'AI_EXTRACTION_ERROR'
  | 'COUNTERPARTY_INFO_MISMATCH'
  | 'OTHER';
export type InvestmentReconciliationReportStatus = 'OPEN' | 'IN_REVIEW' | 'NEEDS_INFO' | 'RESOLVED' | 'REJECTED';
export type InvestmentProcessingAction = 'INSERT' | 'UPDATE' | 'DUPLICATE' | 'REVIEW' | 'IGNORE';
export type InvestmentImportResolution = 'ACCEPT' | 'MERGE_EXISTING' | 'SAVE_AS_NEW' | 'SKIP';
export type InvestmentImportFileStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED' | 'CONFIRMED';
export type InvestmentImportBatchStatus =
  'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'READY_WITH_ERRORS'
  | 'PARTIALLY_CONFIRMED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CANCELLED';
export type AttachmentAiStatus =
  'NOT_REQUESTED'
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED'
  | 'CONFIRMED';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

export type AccountResponse = {
  id: number; accountCode: string; accountName: string; accountUsername: string; accountEmail: string;
  phoneNumber: string; registerDate: string; accountPasswordSet: boolean; currency: string; status: AccountStatus;
  note: string | null; version: number;
};
export type CreateAccountRequest = {
  accountCode: string; accountName: string; accountUsername: string; accountEmail: string; phoneNumber: string;
  registerDate: string; accountPassword: string; currency?: string;
};
export type UpdateAccountRequest = {
  accountCode?: string | null; accountName: string; accountUsername?: string | null; accountEmail?: string | null;
  phoneNumber?: string | null; registerDate?: string | null; accountPassword?: string | null; note?: string | null;
  status: AccountStatus; version: number;
};

export type BatchSummary = {
  detected: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  review: number
};
export type ImportFileResponse = {
  attachmentId: number;
  originalName: string;
  contentUrl: string;
  status: InvestmentImportFileStatus;
  errorCode: string | null
};
export type ImportItemResponse = {
  itemId: string;
  version: number;
  transactionType: InvestmentTransactionType | null;
  transactionStatus: InvestmentTransactionStatus | null;
  amount: number | null;
  currency: string | null;
  transactionAt: string | null;
  externalTransactionId: string | null;
  description: string | null;
  rawText: string | null;
  confidence: number | null;
  processingAction: InvestmentProcessingAction;
  matchedTransactionId: number | null;
  warnings: string[];
};
export type ImportBatchResponse = {
  batchId: string;
  accountId: number;
  status: InvestmentImportBatchStatus;
  summary: BatchSummary;
  files: ImportFileResponse[];
  transactions: ImportItemResponse[]
};

export type ConfirmItemRequest = {
  itemId: string; version: number; selected: boolean; resolution?: InvestmentImportResolution | null;
  transactionType?: InvestmentTransactionType | null; transactionStatus?: InvestmentTransactionStatus | null;
  amount?: number | null; currency?: string | null; transactionAt?: string | null;
  externalTransactionId?: string | null; description?: string | null;
};
export type ConfirmItemResult = {
  itemId: string;
  result: 'INSERTED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  transactionId: number | null;
  errorCode: string | null
};
export type ConfirmBatchResponse = {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  results: ConfirmItemResult[]
};
export type ManualTransactionRequest = {
  transactionType: InvestmentTransactionType; transactionStatus: InvestmentTransactionStatus; amount: number;
  currency: string; transactionAt: string; externalTransactionId?: string | null; description?: string | null;
};

export type TransactionResponse = {
  id: number;
  transactionType: InvestmentTransactionType;
  transactionStatus: InvestmentTransactionStatus;
  amount: number;
  currency: string;
  transactionAt: string;
  externalTransactionId: string | null;
  description: string | null;
  rawText: string | null;
  confidence: number | null;
  sourceFileHash: string | null;
  sourceAttachmentId: number | null;
  version: number;
};
export type InvestmentReconciliationReportResponse = {
  id: number; accountId: number; accountName: string | null; transactionId: number;
  transactionType: InvestmentTransactionType | null; transactionStatus: InvestmentTransactionStatus | null;
  amount: number | null; currency: string | null; transactionAt: string | null;
  externalTransactionId: string | null; sourceAttachmentId: number | null;
  reason: InvestmentReconciliationReportReason; detail: string;
  status: InvestmentReconciliationReportStatus; resolutionNote: string | null;
  createdAt: string; resolvedAt: string | null; version: number;
  history: {
    fromStatus: InvestmentReconciliationReportStatus | null;
    toStatus: InvestmentReconciliationReportStatus;
    note: string | null;
    createdAt: string
  }[];
};
export type InvestmentTypeSummary = { transactionType: InvestmentTransactionType; count: number; amount: number };
export type InvestmentStatisticsResponse = {
  accountId: number; currency: string; fromDate: string | null; toDate: string | null;
  status: InvestmentTransactionStatus | null; totalCount: number; totalAmount: number; netAmount: number;
  byType: InvestmentTypeSummary[]; daily: InvestmentDailyFlow[];
};
export type InvestmentDailyFlow = { date: string; deposits: number; withdrawals: number; bonuses: number };
export type InvestmentCurrencyFlow = {
  currency: string;
  deposits: number;
  withdrawals: number;
  bonuses: number;
  netDeposits: number;
  daily: InvestmentDailyFlow[]
};
export type InvestmentStatisticsCurrency = {
  currency: string; totalCount: number; deposits: number; withdrawals: number; bonuses: number; netAmount: number;
  daily: InvestmentDailyFlow[]
};
export type InvestmentStatisticsAccount = {
  accountId: number; accountName: string; accountCode: string | null; currency: string; status: string;
  totalCount: number; deposits: number; withdrawals: number; bonuses: number; netAmount: number;
};
export type InvestmentStatisticsOverview = {
  fromDate: string; toDate: string; timeZone: string; accountId: number | null; currencies: InvestmentStatisticsCurrency[];
  accounts?: InvestmentStatisticsAccount[]
};
export type ReportTotals = { count: number; deposits: number; withdrawals: number; bonuses: number; net: number; netWithBonus: number };
export type InvestmentReport<T> = {
  type: string; fromDate: string; toDate: string; timeZone: string; accountId: number | null;
  currencies: { currency: string; data: T }[]
};
export type PeriodRow = {
  period: string; start: string; totals: ReportTotals; cumulativeNet: number; netChange: number | null; netChangePct: number | null
};
export type PeriodicReport = {
  granularity: string; totals: ReportTotals; averageNet: number; best: PeriodRow | null; worst: PeriodRow | null;
  profitablePeriods: number; losingPeriods: number; rows: PeriodRow[]
};
export type AccountRowReport = {
  accountId: number; accountName: string; totals: ReportTotals; roiPct: number | null; averageDeposit: number;
  averageWithdrawal: number; firstDate: string; lastDate: string; daysSinceLast: number; netSharePct: number | null
};
export type AccountsReport = { totals: ReportTotals; rows: AccountRowReport[] };
export type EquityPoint = { date: string; net: number; cumulativeNet: number; peak: number; drawdown: number };
export type DayNet = { date: string; net: number };
export type EquityReport = {
  points: EquityPoint[]; finalNet: number; peakNet: number; maxDrawdown: number; maxDrawdownDate: string | null;
  currentDrawdown: number; bestDay: DayNet | null; worstDay: DayNet | null; activeDays: number; winDays: number;
  lossDays: number; longestWinStreak: number; longestLossStreak: number; currentStreak: number
};
export type ReportSlot = { key: number; totals: ReportTotals };
export type ActivityReport = { byWeekday: ReportSlot[]; byHour: ReportSlot[]; byDayOfMonth: ReportSlot[]; matrix: number[][]; busiestWeekday: number; busiestHour: number; busiestDayOfMonth: number };
export type TypeStats = { type: string; count: number; total: number; min: number; max: number; average: number; median: number; p90: number };
export type SizeBucket = { from: number; to: number; deposits: number; withdrawals: number; bonuses: number };
export type TopTransaction = { accountName: string; type: string; amount: number; at: string };
export type DistributionReport = { byType: TypeStats[]; buckets: SizeBucket[]; largest: TopTransaction[] };
export type MetricDelta = { metric: string; current: number; previous: number; change: number; changePct: number | null };
export type ComparisonReport = { previousFrom: string; previousTo: string; current: ReportTotals; previous: ReportTotals; deltas: MetricDelta[] };
export type DayRow = { date: string; totals: ReportTotals };
export type DailyReport = {
  totals: ReportTotals; days: DayRow[]; best: DayRow | null; worst: DayRow | null;
  averageNetPerActiveDay: number; averageTransactionsPerActiveDay: number
};
export type RollingPoint = { date: string; net: number; rolling7: number; rolling30: number };
export type RollingReport = {
  points: RollingPoint[]; latest7: number; latest30: number; best7: number | null; worst7: number | null;
  averageDailyNet: number; volatility: number
};
export type BonusRow = { key: string; label: string; bonuses: number; deposits: number; bonusPctOfDeposits: number | null; bonusCount: number };
export type BonusReport = {
  totalBonuses: number; totalDeposits: number; bonusPctOfDeposits: number | null; bonusPctOfPositiveNet: number | null;
  averageBonus: number; largestBonus: number; byMonth: BonusRow[]; byAccount: BonusRow[]
};
export type PaybackRow = {
  accountId: number; accountName: string; deposits: number; withdrawals: number; recoveredPct: number | null; outstanding: number;
  brokeEven: boolean; firstDate: string; breakEvenDate: string | null; daysToBreakEven: number | null
};
export type PaybackReport = {
  deposits: number; withdrawals: number; recoveredPct: number | null; outstanding: number; accountsBrokeEven: number;
  accountsOutstanding: number; rows: PaybackRow[]
};
export type SeasonalMonth = { month: number; occurrences: number; winningOccurrences: number; count: number; totalNet: number; averageNet: number };
export type SeasonalityReport = { months: SeasonalMonth[]; best: SeasonalMonth | null; worst: SeasonalMonth | null };
export type ProjectionReport = {
  asOf: string; monthToDateNet: number; daysElapsed: number; daysRemaining: number; dailyRunRate30: number; projectedMonthEnd: number;
  projectedNext30: number; projectedYear: number; trailing30: number; trailing90: number; observedDays: number
};
export type LedgerRow = { at: string; accountId: number; accountName: string; type: string; amount: number; signedNet: number; runningNet: number };
export type LedgerReport = { totals: ReportTotals; truncated: boolean; limit: number; rows: LedgerRow[] };
export type AccountBrief = { accountId: number; accountName: string; net: number };
export type OverviewReport = {
  totals: ReportTotals; activeAccounts: number; activeDays: number; firstDate: string | null; lastDate: string | null; lastAt: string | null;
  averageTransaction: number; withdrawalToDepositPct: number | null; bestAccount: AccountBrief | null; worstAccount: AccountBrief | null;
  currentMonth: string; currentMonthNet: number; previousMonthNet: number; monthNetChange: number
};
export type MatrixRow = { accountId: number; accountName: string; cells: number[]; cumulative: number[]; total: number };
export type MatrixReport = { months: string[]; rows: MatrixRow[]; monthTotals: number[]; cumulativeTotals: number[] };
export type DrawdownEpisode = {
  peakDate: string; startDate: string; troughDate: string; recoveryDate: string | null; depth: number; daysToTrough: number;
  daysToRecover: number | null; durationDays: number
};
export type DrawdownReport = { episodes: DrawdownEpisode[]; count: number; ongoing: boolean; longestDays: number; deepest: number };
export type CadenceRow = {
  accountId: number; accountName: string; transactions: number; averageGapDays: number | null; longestGapDays: number;
  longestGapFrom: string | null; longestGapTo: string | null; avgDaysDepositToWithdrawal: number | null
};
export type CadenceReport = { averageGapDays: number | null; avgDaysDepositToWithdrawal: number | null; rows: CadenceRow[] };
export type GoalProgress = {
  id: number; period: 'MONTH' | 'YEAR'; target: number; achieved: number; remaining: number; pct: number; elapsedPct: number;
  onTrack: boolean; reached: boolean; requiredDaily: number; daysRemaining: number
};
export type GoalsReport = { asOf: string; goals: GoalProgress[] };
export type Insight = { code: string; severity: 'WARN' | 'INFO' | 'GOOD'; accountId: number | null; accountName: string | null; value: number | null; date: string | null };
export type InsightsReport = { asOf: string; insights: Insight[] };
export type PerformanceReport = {
  activeDays: number; winDays: number; lossDays: number; winRatePct: number | null; grossWin: number; grossLoss: number; averageWin: number;
  averageLoss: number; payoffRatio: number | null; profitFactor: number | null; expectancyPerDay: number; medianDayNet: number;
  largestWin: number; largestLoss: number; totalNet: number; maxDrawdown: number; recoveryFactor: number | null
};
export type Lot = {
  accountId: number; accountName: string; depositDate: string; amount: number; recovered: number; outstanding: number; recoveredDate: string | null;
  daysToRecover: number | null; ageDays: number
};
export type LotsReport = {
  lotCount: number; recoveredLots: number; averageDaysToRecover: number | null; totalDeposited: number; totalRecovered: number;
  outstanding: number; aging: { bucket: string; lots: number; outstanding: number }[]; truncated: boolean; lots: Lot[]
};
export type AdminInvestmentSummary = {
  fromDate: string; toDate: string; timeZone: string;
  currencies: {
    currency: string;
    totals: { transactions: number; users: number; accounts: number; deposits: number; withdrawals: number; bonuses: number; net: number };
    months: { month: string; transactions: number; deposits: number; withdrawals: number; bonuses: number; net: number }[];
    topUsers: { userId: number; email: string; fullName: string; transactions: number; deposits: number; withdrawals: number; net: number }[]
  }[]
};
export type AllocationRow = { accountId: number; accountName: string; deposits: number; withdrawals: number; outstanding: number; outstandingSharePct: number | null; depositSharePct: number | null };
export type AllocationReport = { totalDeposits: number; totalOutstanding: number; hhi: number | null; concentration: 'NONE' | 'DIVERSIFIED' | 'MODERATE' | 'CONCENTRATED'; topSharePct: number | null; rows: AllocationRow[] };
export type InvestmentStatisticsOperations = {
  updatedAt: string; accountId: number | null;
  ai: { pending: number; processing: number; ready: number; failed: number };
  imports: {
    total: number;
    items: { batchId: string; accountId: number; accountName: string; status: string; createdAt: string; reviewCount: number }[]
  };
  reconciliation: {
    total: number; open: number; inReview: number; needsInfo: number; items: {
      id: number; accountId: number; accountName: string; transactionId: number; amount: number; currency: string;
      reason: string; status: string; createdAt: string;
    }[]
  };
};
export type InvestmentImportTask = { batchId: string; accountId: number; accountName: string; status: string };
export type InvestmentTaskGroup = { total: number; items: InvestmentImportTask[] };
export type InvestmentOverview = {
  updatedAt: string;
  days: number;
  fromDate: string;
  toDate: string;
  activeAccounts: number;
  currencies: InvestmentCurrencyFlow[];
  review: InvestmentTaskGroup;
  failed: InvestmentTaskGroup
};

export type AiJobOwnerResponse = { userId: number; fullName: string | null; email: string | null };
export type InvestmentAiJobReviewTarget = {
  accountId: number;
  accountName: string;
  batchId: string;
  batchStatus: InvestmentImportBatchStatus;
  createdAt: string;
  pendingItemCount: number
};
export type InvestmentAiJobEventActor = 'USER' | 'ADMIN' | 'SYSTEM';
export type InvestmentAiJobEventResponse = {
  fromStatus: AttachmentAiStatus | null; toStatus: AttachmentAiStatus; attemptCount: number;
  reasonCode: string; actorType: InvestmentAiJobEventActor; createdAt: string;
};
export type AiTransactionDraftResponse = {
  transactionType: InvestmentTransactionType | null;
  transactionStatus: InvestmentTransactionStatus | null;
  amount: number | null;
  currency: string | null;
  transactionAt: string | null;
  externalTransactionId: string | null;
  description: string | null;
  rawText: string | null;
  confidence: number | null;
  uncertainFields: string[];
  validationWarnings: string[];
};
export type AiDraftResponse = { attachmentId: number; transactions: AiTransactionDraftResponse[] };
export type InvestmentAiJobResponse = {
  attachmentId: number;
  owner: AiJobOwnerResponse | null;
  originalName: string;
  mimeType: string;
  size: number;
  status: AttachmentAiStatus;
  attemptCount: number;
  maxAttempts: number;
  model: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contentAvailable: boolean;
  canCancel: boolean;
  canRun: boolean;
  reviewTargets: InvestmentAiJobReviewTarget[];
  detectedJson: AiDraftResponse | null;
  history: InvestmentAiJobEventResponse[];
};
export type InvestmentAiQueueSummaryResponse = {
  total: number;
  pending: number;
  processing: number;
  ready: number;
  failed: number;
  cancelled: number;
  confirmed: number;
  generatedAt: string;
};

const q = (params: Record<string, string | number | string[] | undefined>) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === '') return;
    if (Array.isArray(v)) v.forEach(x => usp.append(k, x)); else usp.append(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
};

export function useInvestmentApi() {
  const {requestJson} = useAuth();
  return {
    listAccounts: (search: string, page = 0, size = 20) =>
      requestJson<PageResponse<AccountResponse>>(`/api/v1/investment/accounts${q({search, page, size})}`),
    listAllAccounts: async (search = '') => {
      const all: AccountResponse[] = [];
      let page = 0;
      let totalPages = 1;
      do {
        const result = await requestJson<PageResponse<AccountResponse>>(`/api/v1/investment/accounts${q({
          search,
          page,
          size: 100
        })}`);
        all.push(...result.data);
        totalPages = Math.max(result.meta.totalPages, page + 1);
        page += 1;
      } while (page < totalPages);
      return all;
    },
    getAccount: (id: number) => requestJson<AccountResponse>(`/api/v1/investment/accounts/${id}`),
    createAccount: (body: CreateAccountRequest) => requestJson<AccountResponse>('/api/v1/investment/accounts', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    updateAccount: (id: number, body: UpdateAccountRequest) => requestJson<AccountResponse>(`/api/v1/investment/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),

    createImportBatch: (accountId: number, files: { uri: string; name: string; type: string }[]) => {
      const form = new FormData();
      files.forEach(f => form.append('files', {uri: f.uri, name: f.name, type: f.type} as unknown as Blob));
      return requestJson<ImportBatchResponse>(`/api/v1/investment/accounts/${accountId}/transaction-imports`, {
        method: 'POST',
        body: form
      });
    },
    getImportBatch: (accountId: number, batchId: string) => requestJson<ImportBatchResponse>(`/api/v1/investment/accounts/${accountId}/transaction-imports/${batchId}`),
    retryImportFile: (accountId: number, batchId: string, attachmentId: number) =>
      requestJson<ImportBatchResponse>(`/api/v1/investment/accounts/${accountId}/transaction-imports/${batchId}/files/${attachmentId}/retry`, {method: 'POST'}),
    confirmImportBatch: (accountId: number, batchId: string, items: ConfirmItemRequest[]) =>
      requestJson<ConfirmBatchResponse>(`/api/v1/investment/accounts/${accountId}/transaction-imports/${batchId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({transactions: items})
      }),

    listTransactions: (accountId: number, params: {
      fromDate?: string;
      toDate?: string;
      type?: InvestmentTransactionType;
      status?: InvestmentTransactionStatus;
      page?: number;
      size?: number
    }) =>
      requestJson<PageResponse<TransactionResponse>>(`/api/v1/investment/accounts/${accountId}/transactions${q(params)}`),
    getTransaction: (accountId: number, transactionId: number) =>
      requestJson<TransactionResponse>(`/api/v1/investment/accounts/${accountId}/transactions/${transactionId}`),
    createManualTransaction: (accountId: number, body: ManualTransactionRequest) =>
      requestJson<TransactionResponse>(`/api/v1/investment/accounts/${accountId}/manual-transactions`, {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    createReconciliationReport: (accountId: number, transactionId: number, body: {
      reason: InvestmentReconciliationReportReason;
      detail: string
    }) =>
      requestJson<InvestmentReconciliationReportResponse>(`/api/v1/investment/accounts/${accountId}/transactions/${transactionId}/reconciliation-reports`, {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    listReconciliationReports: (page = 0, size = 20) =>
      requestJson<PageResponse<InvestmentReconciliationReportResponse>>(`/api/v1/investment/reconciliation-reports${q({
        page,
        size
      })}`),
    listAllReconciliationReports: async () => {
      const all: InvestmentReconciliationReportResponse[] = [];
      let page = 0;
      let totalPages = 1;
      do {
        const result = await requestJson<PageResponse<InvestmentReconciliationReportResponse>>(`/api/v1/investment/reconciliation-reports${q({
          page,
          size: 100
        })}`);
        all.push(...result.data);
        totalPages = Math.max(result.meta.totalPages, page + 1);
        page += 1;
      } while (page < totalPages);
      return all;
    },
    getReconciliationReport: (reportId: number) =>
      requestJson<InvestmentReconciliationReportResponse>(`/api/v1/investment/reconciliation-reports/${reportId}`),
    listAdminReconciliationReports: (status?: InvestmentReconciliationReportStatus, page = 0, size = 20) =>
      requestJson<PageResponse<InvestmentReconciliationReportResponse>>(`/api/v1/admin/investment/reconciliation-reports${q({
        status,
        page,
        size
      })}`),
    updateAdminReconciliationReport: (reportId: number, body: {
      status: InvestmentReconciliationReportStatus;
      resolutionNote?: string | null;
      version: number
    }) =>
      requestJson<InvestmentReconciliationReportResponse>(`/api/v1/admin/investment/reconciliation-reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      }),
    getStatistics: (accountId: number, params: {
      fromDate?: string;
      toDate?: string;
      status?: InvestmentTransactionStatus
    }) =>
      requestJson<InvestmentStatisticsResponse>(`/api/v1/investment/accounts/${accountId}/statistics${q(params)}`),
    getAllStatistics: (params: { fromDate: string; toDate: string; accountId?: number }) =>
      requestJson<InvestmentStatisticsOverview>(`/api/v1/investment/statistics${q(params)}`),
    getReport: <T, >(type: string, params: Record<string, string | number | undefined>) =>
      requestJson<InvestmentReport<T>>(`/api/v1/investment/reports/${type}${q(params)}`),
    saveGoal: (body: { currency: string; period: string; targetAmount: number }) =>
      requestJson<{ id: number }>('/api/v1/investment/goals', {method: 'PUT', body: JSON.stringify(body)}),
    deleteGoal: (id: number) => requestJson<void>(`/api/v1/investment/goals/${id}`, {method: 'DELETE'}),
    getAdminSummary: (params: { fromDate: string; toDate: string }) =>
      requestJson<AdminInvestmentSummary>(`/api/v1/admin/investment/reports/summary${q(params)}`),
    getOperations: (accountId?: number) =>
      requestJson<InvestmentStatisticsOperations>(`/api/v1/investment/statistics/operations${q({accountId})}`),
    getOverview: (days: 7 | 30 | 90 = 30) => requestJson<InvestmentOverview>(`/api/v1/dashboards/overview/investments?days=${days}`),

    listAiJobs: (statuses?: AttachmentAiStatus[], page = 0, size = 20) =>
      requestJson<PageResponse<InvestmentAiJobResponse>>(`/api/v1/investment/ai-jobs${q({statuses, page, size})}`),
    listAllAiJobs: async (statuses?: AttachmentAiStatus[]) => {
      const all: InvestmentAiJobResponse[] = [];
      let page = 0;
      let totalPages = 1;
      do {
        const result = await requestJson<PageResponse<InvestmentAiJobResponse>>(`/api/v1/investment/ai-jobs${q({
          statuses,
          page,
          size: 100
        })}`);
        all.push(...result.data);
        totalPages = result.meta.totalPages;
        page += 1;
      } while (page < totalPages);
      return all;
    },
    cancelAiJob: (id: number) => requestJson<InvestmentAiJobResponse>(`/api/v1/investment/ai-jobs/${id}/cancel`, {method: 'POST'}),
    runAiJob: (id: number) => requestJson<InvestmentAiJobResponse>(`/api/v1/investment/ai-jobs/${id}/run`, {method: 'POST'}),
    getAiJob: (id: number) => requestJson<InvestmentAiJobResponse>(`/api/v1/investment/ai-jobs/${id}`),
    listAdminAiJobs: (statuses?: AttachmentAiStatus[], page = 0, size = 20) =>
      requestJson<PageResponse<InvestmentAiJobResponse>>(`/api/v1/admin/investment/ai-jobs${q({
        statuses,
        page,
        size
      })}`),
    cancelAdminAiJob: (id: number) => requestJson<InvestmentAiJobResponse>(`/api/v1/admin/investment/ai-jobs/${id}/cancel`, {method: 'POST'}),
    runAdminAiJob: (id: number) => requestJson<InvestmentAiJobResponse>(`/api/v1/admin/investment/ai-jobs/${id}/run`, {method: 'POST'}),
    getAdminAiJob: (id: number) => requestJson<InvestmentAiJobResponse>(`/api/v1/admin/investment/ai-jobs/${id}`),
    getAdminAiJobSummary: () => requestJson<InvestmentAiQueueSummaryResponse>('/api/v1/admin/investment/ai-jobs/summary'),
  };
}

export const aiJobContentUri = (id: number) => `${API_URL}/api/v1/investment/ai-jobs/${id}/content`;
export const adminAiJobContentUri = (id: number) => `${API_URL}/api/v1/admin/investment/ai-jobs/${id}/content`;
