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
