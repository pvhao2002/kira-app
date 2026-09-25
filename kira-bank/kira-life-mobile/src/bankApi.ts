import {ApiError, useAuth} from './auth';
import type {PageResponse} from './investmentApi';

export type BankCardDebt = {
  id: number; nickname: string; lastFour: string; status: string; statementDebt: number; currency: string;
};
export type BankDebt = {
  bankId: number; bankName: string; bankLogoUrl: string | null; cardCount: number; totalCreditLimit: number;
  creditLimitVersion: number; balanceVersion: number; statementDebt: number; currentBalance: number;
  availableCredit: number; utilizationRate: number; currency: string; cards: BankCardDebt[];
};
export type BankDashboard = {
  totalCreditLimit: number; totalStatementDebt: number; currentBalance: number; availableCredit: number;
  utilizationRate: number; currency: string; banks: BankDebt[]; trend: BankDebtTrend[];
};
export type BankDebtTrend = { month: string; currency: string; statementDebt: number; remainingDebt: number };
export type BankBalanceAdjustmentResponse = {
  id: number;
  bankId: number;
  sourceBalance: number;
  previousBalance: number;
  newBalance: number;
  adjustmentAmount: number;
  balanceOffset: number;
  reason: string;
  currency: string;
  balanceVersion: number;
  createdAt: string;
};
export type BankCatalogItem = {
  id: number; vietqrId: number | null; code: string; name: string; shortName: string | null;
  logoUrl: string | null; bin: string | null; website: string | null; brandColor: string | null;
};
export type CreditCardResponse = {
  id: number; bankId: number; bankName: string; bankLogoUrl: string | null; cardType: string; nickname: string;
  lastFour: string; creditLimit: number; creditLimitVersion: number; currentBalance: number; balanceVersion: number;
  currency: string; statementDay: number; dueDay: number; status: string; note: string | null; version: number;
  billingCycleId: number | null; statementDate: string | null; paymentDueDate: string | null;
  statementBalance: number | null; minimumPayment: number | null; billingStatus: string | null; billingVersion: number;
};
export type CreateCardRequest = {
  bankId: number; cardType: string; nickname: string; lastFour: string; creditLimit: number;
  statementDay: number; dueDay: number; note?: string | null;
};
export type UpdateCardRequest = Omit<CreateCardRequest, 'bankId'> & {
  status: string;
  version: number;
  creditLimitVersion: number
};
export type StatementResponse = {
  id: number;
  statementBalance: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  version: number;
  userCardId: number;
  periodStart: string;
  periodEnd: string;
  statementDate: string;
  dueDate: string;
  minimumPayment: number;
};
export type StatementRequest = {
  userCardId: number;
  periodStart: string;
  periodEnd: string;
  statementDate: string;
  dueDate: string;
  openingBalance: number;
  totalSpending: number;
  totalRefund: number;
  totalFee: number;
  totalInterest: number;
  minimumPayment: number;
};
export type PaymentResponse = { id: number; status: string; statement: StatementResponse };
export type BillingCycleResponse = {
  billingCycleId: number | null; statementDate: string; paymentDueDate: string;
  statementBalance: number | null; minimumPayment: number | null; billingStatus: string; billingVersion: number;
};
export type PaymentHistoryResponse = {
  id: number; statementId: number; paymentDate: string; amount: number; paymentMethod: string;
  sourceAccount: string | null; referenceNumber: string; status: string; note: string | null;
};
export type CashbackRuleResponse = {
  id: number;
  categoryName: string;
  cashbackRate: number;
  maxCashbackAmount: number;
  mccCodes: string[];
  version: number;
};
export type CashbackProgramResponse = {
  id: number;
  name: string;
  notes: string | null;
  termsUrl: string | null;
  active: boolean;
  version: number;
  groups: CashbackRuleResponse[];
};
export type CardBenefitResponse = {
  cardId: number; bankId: number; bankName: string; bankLogoUrl: string | null; cardType: string; nickname: string;
  lastFour: string; status: string; currency: string; monthlyCashbackCap: number | null; configVersion: number | null;
  programs: CashbackProgramResponse[];
};

export type CardRecommendation = {
  cardId: number; bankId: number; bankName: string; bankLogoUrl: string | null; nickname: string;
  cardType: string | null; lastFour: string | null; currency: string; ruleId: number | null;
  programName: string | null; categoryName: string | null; cashbackRate: number | null; estimatedCashback: number;
  ruleCap: number | null; ruleRemaining: number | null; cardCap: number | null; cardRemaining: number | null;
  availableCredit: number | null; insufficientCredit: boolean; periodStart: string; periodEnd: string; reasons: string[];
};
export type CardRecommendationResponse = { mccCode: string; amount: number | null; cards: CardRecommendation[] };
export type CardTransactionRequest = {
  transactionDate: string; description: string; amount: number;
  transactionType: 'SPENDING' | 'REFUND' | 'FEE' | 'INTEREST' | 'CASHBACK'; mccCode: string | null; cashbackRuleId: number | null;
};

export const bankErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.';
  if (error.code === 'BANK_NOT_FOUND') return 'Không tìm thấy ngân hàng.';
  if (error.code === 'USER_CARD_NOT_FOUND') return 'Không tìm thấy thẻ.';
  if (error.code === 'BANK_CREDIT_LIMIT_NOT_FOUND') return 'Ngân hàng chưa có hạn mức chung.';
  if (error.code === 'CARD_VERSION_CONFLICT' || error.code === 'CREDIT_CARD_VERSION_CONFLICT') return 'Dữ liệu thẻ đã thay đổi ở nơi khác. Vui lòng tải lại.';
  if (error.code === 'CREDIT_LIMIT_VERSION_CONFLICT' || error.code === 'BANK_CREDIT_LIMIT_VERSION_CONFLICT') return 'Hạn mức ngân hàng đã thay đổi ở nơi khác. Vui lòng tải lại.';
  if (error.code === 'SHARED_CREDIT_LIMIT_MISMATCH') return 'Hạn mức thẻ phải khớp hạn mức chung hiện tại của ngân hàng.';
  if (error.code === 'INVALID_CARD_STATUS') return 'Trạng thái thẻ không hợp lệ.';
  if (error.code === 'BANK_BALANCE_VERSION_CONFLICT') return 'Số dư ngân hàng đã thay đổi ở nơi khác. Vui lòng tải lại.';
  if (error.code === 'INVALID_TREND_PERIOD') return 'Khoảng xu hướng chỉ hỗ trợ 3, 6 hoặc 12 tháng.';
  if (error.code === 'STATEMENT_NOT_FOUND') return 'Không tìm thấy sao kê.';
  if (error.code === 'STATEMENT_NOT_PAYABLE') return 'Sao kê hiện không thể thanh toán.';
  if (error.code === 'IDEMPOTENCY_KEY_REUSED') return 'Mã yêu cầu thanh toán đã được dùng cho sao kê khác. Vui lòng mở lại màn hình thanh toán.';
  if (error.code === 'PAYMENT_EXCEEDS_REMAINING') return 'Số tiền thanh toán vượt dư nợ còn lại.';
  if (error.code === 'INVALID_STATEMENT_DATES') return 'Ngày kỳ sao kê không hợp lệ.';
  if (error.code === 'INVALID_STATEMENT_BALANCE') return 'Dư nợ sao kê không thể âm.';
  if (error.code === 'MINIMUM_PAYMENT_REQUIRED') return 'Sao kê có dư nợ phải có thanh toán tối thiểu.';
  if (error.code === 'INVALID_MINIMUM_PAYMENT') return 'Thanh toán tối thiểu không thể vượt dư nợ sao kê.';
  if (error.code === 'BILLING_CYCLE_ID_REQUIRED') return 'Kỳ sao kê đã thay đổi. Vui lòng tải lại thẻ và thử lại.';
  if (error.code === 'STATEMENT_NOT_DUE') return 'Chưa đến ngày chốt sao kê của thẻ.';
  if (error.code === 'STATEMENT_ALREADY_PAID') return 'Sao kê đã được thanh toán.';
  if (error.code === 'STATEMENT_NOT_ACTIONABLE') return 'Sao kê hiện không còn cần xử lý.';
  if (error.code === 'STATEMENT_HAS_PAYMENT') return 'Không thể sửa sao kê đã có thanh toán.';
  if (error.code === 'STATEMENT_VERSION_CONFLICT') return 'Sao kê đã thay đổi ở nơi khác. Vui lòng tải lại.';
  if (error.code === 'MINIMUM_PAYMENT_EXCEEDS_BALANCE') return 'Thanh toán tối thiểu không được vượt dư nợ.';
  if (error.code === 'INVALID_PAYMENT_STATUS') return 'Trạng thái thanh toán không hợp lệ.';
  if (error.code === 'CREDIT_CARD_BENEFIT_NOT_FOUND') return 'Không tìm thấy cấu hình ưu đãi thẻ.';
  if (error.code === 'CASHBACK_CONFIG_VERSION_CONFLICT') return 'Trần hoàn tiền đã thay đổi ở nơi khác. Vui lòng tải lại.';
  if (error.code === 'CASHBACK_PROGRAM_VERSION_CONFLICT' || error.code === 'CASHBACK_RULE_VERSION_CONFLICT') return 'Chương trình ưu đãi đã thay đổi ở nơi khác. Vui lòng tải lại.';
  if (error.code === 'CASHBACK_MCC_DUPLICATE') return 'Một mã MCC chỉ được thuộc một nhóm trong cùng chương trình.';
  if (error.code === 'CASHBACK_CATEGORY_DUPLICATE') return 'Tên nhóm danh mục không được trùng.';
  if (error.code === 'CASHBACK_TERMS_URL_INVALID') return 'Link điều khoản phải dùng HTTP hoặc HTTPS.';
  if (error.code === 'INVALID_MCC') return 'MCC phải gồm 4 chữ số.';
  if (error.code === 'CASHBACK_RULE_NOT_FOUND') return 'Nhóm cashback không thuộc thẻ này.';
  if (error.code === 'CARD_TRANSACTION_DUPLICATE') return 'Khoản chi này đã được ghi nhận.';
  if (error.code === 'VALIDATION_ERROR') return 'Dữ liệu thẻ không hợp lệ.';
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
};

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.append(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
};

export function useBankApi() {
  const {requestJson} = useAuth();
  const listAll = async <T, >(loadPage: (page: number) => Promise<PageResponse<T>>) => {
    const items: T[] = [];
    let page = 0;
    let totalPages = 1;
    do {
      const response = await loadPage(page);
      items.push(...response.data);
      totalPages = Math.max(response.meta.totalPages, page + 1);
      page += 1;
    } while (page < totalPages);
    return items;
  };
  return {
    dashboard: (months: 3 | 6 | 12 = 6) => requestJson<BankDashboard>(`/api/v1/dashboards/credit-cards?months=${months}`),
    listCards: (search = '', page = 0, size = 50) => requestJson<PageResponse<CreditCardResponse>>(`/api/v1/credit-cards${query({
      search,
      page,
      size
    })}`),
    listAllCards: (search = '') => listAll(page => requestJson<PageResponse<CreditCardResponse>>(`/api/v1/credit-cards${query({
      search,
      page,
      size: 100
    })}`)),
    getCard: (id: number) => requestJson<CreditCardResponse>(`/api/v1/credit-cards/${id}`),
    listStatements: (page = 0, size = 50) => requestJson<PageResponse<StatementResponse>>(`/api/v1/statements${query({
      page,
      size
    })}`),
    listAllStatements: () => listAll(page => requestJson<PageResponse<StatementResponse>>(`/api/v1/statements${query({
      page,
      size: 100
    })}`)),
    getStatement: (id: number) => requestJson<StatementResponse>(`/api/v1/statements/${id}`),
    createStatement: (body: StatementRequest) => requestJson<StatementResponse>('/api/v1/statements', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    listPayments: (page = 0, size = 50) => requestJson<PageResponse<PaymentHistoryResponse>>(`/api/v1/payments${query({
      page,
      size
    })}`),
    listAllPayments: () => listAll(page => requestJson<PageResponse<PaymentHistoryResponse>>(`/api/v1/payments${query({
      page,
      size: 100
    })}`)),
    recommendations: (mcc: string, amount?: number) => requestJson<CardRecommendationResponse>(`/api/v1/credit-card-recommendations${query({
      mcc,
      amount
    })}`),
    createCardTransaction: (cardId: number, body: CardTransactionRequest, idempotencyKey: string) =>
      requestJson<unknown>(`/api/v1/credit-cards/${cardId}/transactions`, {
        method: 'POST',
        headers: {'Idempotency-Key': idempotencyKey},
        body: JSON.stringify(body)
      }),
    listBenefits: () => requestJson<CardBenefitResponse[]>('/api/v1/credit-card-benefits'),
    updateMonthlyCashbackCap: (cardId: number, monthlyCashbackCap: number, version: number | null) => requestJson<CardBenefitResponse>(`/api/v1/credit-card-benefits/${cardId}/monthly-cap`, {
      method: 'PUT',
      body: JSON.stringify({monthlyCashbackCap, version})
    }),
    createCashbackProgram: (cardId: number, body: {
      name: string;
      notes?: string | null;
      termsUrl?: string | null;
      active: boolean;
      groups: Array<{ categoryName: string; cashbackRate: number; maxCashbackAmount: number; mccCodes: string[] }>
    }) => requestJson<CardBenefitResponse>(`/api/v1/credit-card-benefits/${cardId}/programs`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    updateCashbackProgram: (cardId: number, programId: number, body: {
      name: string;
      notes?: string | null;
      termsUrl?: string | null;
      active: boolean;
      version: number;
      groups: Array<{
        id?: number;
        version?: number;
        categoryName: string;
        cashbackRate: number;
        maxCashbackAmount: number;
        mccCodes: string[]
      }>
    }) => requestJson<CardBenefitResponse>(`/api/v1/credit-card-benefits/${cardId}/programs/${programId}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
    deleteCashbackProgram: (cardId: number, programId: number, version: number) => requestJson<void>(`/api/v1/credit-card-benefits/${cardId}/programs/${programId}`, {
      method: 'DELETE',
      body: JSON.stringify({version})
    }),
    payStatement: (id: number, body: {
      amount: number;
      paymentMethod: string;
      sourceAccount?: string;
      referenceNumber: string;
      note?: string
    }, idempotencyKey?: string) =>
      requestJson<PaymentResponse>(`/api/v1/statements/${id}/payments`, {
        method: 'POST',
        headers: {'Idempotency-Key': idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`},
        body: JSON.stringify(body)
      }),
    createCard: (request: CreateCardRequest) => requestJson<CreditCardResponse>('/api/v1/credit-cards', {
      method: 'POST',
      body: JSON.stringify(request)
    }),
    updateCard: (id: number, request: UpdateCardRequest) => requestJson<CreditCardResponse>(`/api/v1/credit-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request)
    }),
    updateBillingCycle: (id: number, request: {
      billingCycleId?: number | null;
      statementBalance: number;
      minimumPayment: number;
      paymentStatus: 'UNPAID' | 'PAID';
      version: number
    }) =>
      requestJson<BillingCycleResponse>(`/api/v1/credit-cards/${id}/billing-cycle`, {
        method: 'PUT',
        body: JSON.stringify(request)
      }),
    listBanks: (search = '', page = 0, size = 50) => requestJson<PageResponse<BankCatalogItem>>(`/api/v1/public/banks${query({
      search,
      page,
      size
    })}`),
    updateBankBalance: (bankId: number, currentBalance: number, reason: string, version: number) => requestJson(`/api/v1/credit-card-bank-balances/${bankId}`, {
      method: 'PUT',
      body: JSON.stringify({currentBalance, reason, version})
    }),
    listBankBalanceHistory: (bankId: number) => requestJson<BankBalanceAdjustmentResponse[]>(`/api/v1/credit-card-bank-balances/${bankId}/history`),
  };
}
