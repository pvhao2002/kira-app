export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number
}

export interface PageResponse<T> {
  data: T[];
  meta: PageMeta
}

export interface Profile {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string[];
  version: number
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: Profile
}

export interface Bank {
  id: number;
  vietqrId: number | null;
  code: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  bin: string | null;
  swiftCode: string | null;
  transferSupported: boolean;
  lookupSupported: boolean;
  website: string | null;
  hotline: string | null;
  brandColor: string;
  description: string
}

export interface UserCreditCard {
  id: number;
  bankId: number;
  bankName: string;
  bankLogoUrl: string | null;
  cardType: string | null;
  nickname: string;
  lastFour: string | null;
  creditLimit: number;
  creditLimitVersion: number;
  currentBalance: number;
  balanceVersion: number;
  currency: string;
  statementDay: number;
  dueDay: number;
  status: string;
  note: string | null;
  version: number;
  billingCycleId: number | null;
  statementDate: string | null;
  paymentDueDate: string | null;
  statementBalance: number | null;
  minimumPayment: number | null;
  billingStatus: 'NOT_DUE' | 'NEEDS_INPUT' | 'UNPAID' | 'OVERDUE' | 'PAID';
  billingVersion: number
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
  traceId: string
}

export interface CreditCardDebtCard {
  id: number;
  nickname: string;
  lastFour: string | null;
  status: string;
  statementDebt: number;
  currency: string
}

export interface CreditCardDebtBank {
  bankId: number;
  bankName: string;
  bankLogoUrl: string | null;
  cardCount: number;
  totalCreditLimit: number;
  creditLimitVersion: number;
  balanceVersion: number;
  statementDebt: number;
  currentBalance: number;
  availableCredit: number;
  utilizationRate: number;
  currency: string;
  cards: CreditCardDebtCard[]
}

export interface CreditCardBankLimit {
  bankId: number;
  bankName: string;
  bankLogoUrl: string | null;
  creditLimit: number;
  currency: string;
  version: number
}

export interface CreditCardBankBalanceResponse {
  bankId: number;
  bankName: string;
  bankLogoUrl: string | null;
  previousBalance: number;
  currentBalance: number;
  adjustmentAmount: number;
  currency: string;
  balanceVersion: number
}

export interface CreditCardDashboard {
  totalCreditLimit: number;
  totalStatementDebt: number;
  currentBalance: number;
  availableCredit: number;
  utilizationRate: number;
  currency: string;
  banks: CreditCardDebtBank[]
}

export interface CreditCardCashbackGroup {
  id: number;
  categoryName: string;
  cashbackRate: number;
  maxCashbackAmount: number;
  mccCodes: string[];
  version: number
}

export interface CreditCardCashbackProgram {
  id: number;
  name: string;
  notes: string | null;
  termsUrl: string | null;
  active: boolean;
  version: number;
  groups: CreditCardCashbackGroup[]
}

export interface CreditCardBenefit {
  cardId: number;
  bankId: number;
  bankName: string;
  bankLogoUrl: string | null;
  cardType: string | null;
  nickname: string;
  lastFour: string | null;
  status: string;
  currency: string;
  monthlyCashbackCap: number | null;
  configVersion: number | null;
  programs: CreditCardCashbackProgram[]
}

export interface CreditCardCashbackGroupRequest {
  id: number | null;
  version: number | null;
  categoryName: string;
  cashbackRate: number;
  maxCashbackAmount: number;
  mccCodes: string[]
}

export interface CreditCardCashbackProgramRequest {
  name: string;
  notes: string | null;
  termsUrl: string | null;
  active: boolean;
  version: number | null;
  groups: CreditCardCashbackGroupRequest[]
}

export interface InvestmentAccountSummary {
  id: number;
  accountCode: string | null;
  accountName: string;
  currency: string;
  status: string
}

export type InvestmentTransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'BONUS';
export type InvestmentTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type InvestmentImportAction = 'INSERT' | 'UPDATE' | 'DUPLICATE' | 'REVIEW' | 'IGNORE';
export type InvestmentImportResolution = 'ACCEPT' | 'MERGE_EXISTING' | 'SAVE_AS_NEW' | 'SKIP';
export type InvestmentImportBatchStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'READY_WITH_ERRORS'
  | 'PARTIALLY_CONFIRMED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface InvestmentImportFile {
  attachmentId: number;
  originalName: string;
  contentUrl: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED' | 'CONFIRMED';
  errorCode: string | null
}

export interface InvestmentImportItem {
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
  processingAction: InvestmentImportAction;
  matchedTransactionId: number | null;
  warnings: string[]
}

export interface InvestmentImportBatch {
  batchId: string;
  accountId: number;
  status: InvestmentImportBatchStatus;
  summary: {detected: number; inserted: number; updated: number; skipped: number; failed: number; review: number};
  files: InvestmentImportFile[];
  transactions: InvestmentImportItem[]
}

export interface InvestmentConfirmItem {
  itemId: string;
  version: number;
  selected: boolean;
  resolution: InvestmentImportResolution;
  transactionType: InvestmentTransactionType | null;
  transactionStatus: InvestmentTransactionStatus | null;
  amount: number | null;
  currency: string | null;
  transactionAt: string | null;
  externalTransactionId: string | null;
  description: string | null
}

export interface InvestmentConfirmResponse {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  results: Array<{itemId: string; result: string; transactionId: number | null; errorCode: string | null}>
}

export interface InvestmentTransaction {
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
  version: number
}

export type InvestmentAiJobStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED' | 'CONFIRMED';

export interface InvestmentAiDetectedTransaction {
  transactionType: string | null;
  transactionStatus: string | null;
  amount: number | null;
  currency: string | null;
  transactionAt: string | null;
  externalTransactionId: string | null;
  description: string | null;
  rawText: string | null;
  confidence: number | null;
  uncertainFields: string[];
  validationWarnings: string[]
}

export interface InvestmentAiDetectedJson {
  attachmentId: number;
  transactions: InvestmentAiDetectedTransaction[]
}

export interface InvestmentAiReviewTarget {
  accountId: number;
  accountName: string;
  batchId: string;
  batchStatus: InvestmentImportBatchStatus;
  createdAt: string;
  pendingItemCount: number
}

export interface InvestmentAiJob {
  attachmentId: number;
  owner: {userId: number; fullName: string | null; email: string | null} | null;
  originalName: string;
  mimeType: string;
  size: number;
  status: InvestmentAiJobStatus;
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
  reviewTargets: InvestmentAiReviewTarget[];
  detectedJson: InvestmentAiDetectedJson | null
}

export type LodgingStatus = 'PENDING' | 'READY' | 'FAILED';
export type LodgingReviewStatus = 'OK' | 'NOT_OK';
export interface LodgingFee { amount: number; unit: string }
export interface LodgingReferenceLocation {
  id: number; name: string; address: string; formattedAddress: string | null;
  geocodeStatus: LodgingStatus; geocodeError: string | null; canEdit: boolean; canDelete: boolean; version: number
}
export interface LodgingImage { attachmentId: number; originalName: string; contentUrl: string; sortOrder: number }
export interface LodgingDistance {
  referenceLocationId: number; name: string; address: string; distanceMeters: number | null;
  status: LodgingStatus; errorCode: string | null; calculatedAt: string | null
}
export interface LodgingReviewSummary { okCount: number; notOkCount: number; myStatus: LodgingReviewStatus | null; myReason: string | null }
export interface LodgingListing {
  id: number; address: string; formattedAddress: string | null; rentPrice: number;
  electricity: LodgingFee | null; water: LodgingFee | null; service: LodgingFee | null; parking: LodgingFee | null;
  facebookUrl: string | null; phone: string | null; videoUrl: string | null; note: string | null;
  geocodeStatus: LodgingStatus; geocodeError: string | null;
  owner: {userId: number; fullName: string}; canEdit: boolean; canDelete: boolean; version: number;
  images: LodgingImage[]; distances: LodgingDistance[]; reviewSummary: LodgingReviewSummary;
  createdAt: string; updatedAt: string
}
export interface LodgingReview { userId: number; fullName: string; status: LodgingReviewStatus; reason: string | null; updatedAt: string }
export interface AddressSuggestion { mapboxId: string | null; label: string }
export interface LodgingListingRequest {
  address: string; rentPrice: number; electricity: LodgingFee | null; water: LodgingFee | null;
  service: LodgingFee | null; parking: LodgingFee | null; facebookUrl: string | null; phone: string | null;
  videoUrl: string | null; note: string | null; referenceLocationIds: number[]; version: number | null
}

export type AiProviderAccountStatus = 'PENDING_TEST' | 'VERIFIED' | 'COOLDOWN' | 'BLOCKED';
export interface CloudflareAiCapability {
  tokenConfigured: boolean;
  model: string;
  priority: number;
  enabled: boolean;
  status: AiProviderAccountStatus;
  cooldownUntil: string | null;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null
}
export interface CloudflareR2Capability {
  accessKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  maskedBucketName: string | null;
  maskedPublicUrl: string | null;
  primary: boolean;
  status: AiProviderAccountStatus;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  attachmentCount: number
}
export interface CloudflareAccount {
  id: number;
  displayName: string;
  maskedAccountId: string;
  ai: CloudflareAiCapability;
  r2: CloudflareR2Capability;
  legacyAttachmentCount: number;
  version: number
}

export interface PasswordVaultModule {
  id: number;
  name: string;
  websiteUrl: string | null;
  description: string | null;
  accountCount: number;
  version: number;
  createdAt: string;
  updatedAt: string
}

export interface PasswordVaultAccount {
  id: number;
  moduleId: number;
  displayName: string;
  passwordMasked: string;
  version: number;
  createdAt: string;
  updatedAt: string
}

export interface PasswordVaultAccountRequest {
  displayName: string;
  username: string | null;
  password: string;
  loginUrl: string | null;
  note: string | null;
  version: number | null
}

export interface PasswordVaultSecret {
  username: string | null;
  password: string | null;
  loginUrl: string | null;
  note: string | null;
  value: string | null
}

export interface PasswordVaultUnlock {
  unlockToken: string;
  expiresAt: string
}

export type TutoringTeachingMode = 'ONLINE' | 'IN_PERSON';
export type TutoringExceptionAction = 'MOVE' | 'CANCEL';

export interface TutoringStudent {
  id: number;
  name: string;
  phone: string | null;
  color: string;
  note: string | null;
  version: number
}

export interface TutoringLesson {
  seriesId: number;
  seriesVersion: number;
  studentId: number;
  studentName: string;
  studentPhone: string | null;
  studentColor: string;
  originalDate: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  teachingMode: TutoringTeachingMode;
  location: string | null;
  fee: number;
  note: string | null;
  exceptionAction: TutoringExceptionAction | null;
  exceptionVersion: number | null;
  cancelled: boolean;
  conflict: boolean
}

export interface TutoringConflict {
  firstSeriesId: number;
  secondSeriesId: number;
  date: string;
  startTime: string;
  endTime: string;
  description: string
}

export interface TutoringWeek {
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  readOnly: boolean;
  lessonCount: number;
  totalHours: number;
  totalFee: number;
  conflicts: TutoringConflict[];
  lessons: TutoringLesson[]
}

export interface TutoringStudentRequest {
  name: string;
  phone: string | null;
  color: string;
  note: string | null;
  version: number | null
}

export interface TutoringSeriesRequest {
  studentId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  teachingMode: TutoringTeachingMode;
  location: string | null;
  fee: number;
  note: string | null;
  effectiveFrom: string;
  version: number | null;
  confirmConflict: boolean
}
