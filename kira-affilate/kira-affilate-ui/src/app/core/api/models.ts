// Mirrors kira-affilate/docs/api.md (v1). Money is VND as JSON numbers; timestamps are ISO-8601 instants (UTC).

export interface ApiError {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string> | null;
  path: string;
  traceId: string;
}

export interface Page<T> {
  data: T[];
  meta: {page: number; size: number; totalElements: number; totalPages: number};
}

// Auth
export interface Profile {
  id: number;
  email: string;
  fullName: string;
  version: number;
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: Profile;
}

// Shopee credentials & offers
export type CredentialLastStatus = 'OK' | 'INVALID_CREDENTIAL' | 'NO_API_ACCESS' | 'RATE_LIMITED' | 'ERROR';

export interface CredentialStatus {
  configured: boolean;
  appId: string | null;
  lastCheckedAt: string | null;
  lastStatus: CredentialLastStatus | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

/** Offer pages use Shopee's 1-based `page`. */
export interface OfferPage<T> {
  items: T[];
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export interface ProductOffer {
  itemId: string | number;
  productName: string;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  sales: number | null;
  ratingStar: string | number | null;
  commissionRate: string | null;
  commission: number | null;
  shopName: string | null;
  productLink: string;
  offerLink: string | null;
}

export interface ShopOffer {
  shopId: string | number;
  shopName: string;
  imageUrl: string | null;
  commissionRate: string | null;
  ratingStar: string | number | null;
  originalLink: string;
  offerLink: string | null;
  periodStartTime: number | null;
  periodEndTime: number | null;
}

export interface CampaignOffer {
  offerName: string;
  imageUrl: string | null;
  commissionRate: string | null;
  originalLink: string;
  offerLink: string | null;
  periodStartTime: number | null;
  periodEndTime: number | null;
}

export interface OfferQuery {
  keyword?: string;
  sortType?: number;
  page: number;
  limit: number;
}

// Campaigns (the user's own named Sub ID sets)
export interface Campaign {
  id: number;
  name: string;
  subIds: string[];
  createdAt: string;
}

export interface CampaignRequest {
  name: string;
  subIds: string[];
}

// Links
export type LinkStatus = 'OK' | 'FAILED';

export interface ConvertRequest {
  urls: string[];
  subIds?: string[];
  campaignId?: number;
}

export interface ConvertResult {
  originUrl: string;
  status: LinkStatus;
  shortLink: string | null;
  error: string | null;
  id: number | null;
}

export interface ConvertResponse {
  results: ConvertResult[];
}

export interface Link {
  id: number;
  originUrl: string;
  shortLink: string | null;
  subIds: string[];
  campaignId: number | null;
  campaignName: string | null;
  status: LinkStatus;
  error: string | null;
  createdAt: string;
}

export interface LinkQuery {
  search?: string;
  status?: LinkStatus | '';
  campaignId?: number | '';
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string;
}

// Orders & commissions
export type Bucket = 'ESTIMATED' | 'CONFIRMED' | 'REJECTED' | 'VALIDATED';
export type OrderStatus = 'UNPAID' | 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface OrderRow {
  id: number;
  conversionId: string | number;
  orderId: string;
  itemId: string | number;
  itemName: string;
  shopName: string | null;
  imageUrl: string | null;
  qty: number;
  itemPrice: number;
  actualAmount: number;
  refundAmount: number | null;
  orderStatus: OrderStatus;
  fraudStatus: string | null;
  bucket: Bucket;
  commission: number;
  purchaseTime: string;
  completeTime: string | null;
  utmContent: string | null;
}

export interface OrderDetail extends OrderRow {
  modelId: string | number | null;
  clickTime: string | null;
  buyerType: string | null;
  device: string | null;
  referrer: string | null;
  itemSellerCommission: number | null;
  itemShopeeCommission: number | null;
  conversionTotalCommission: number | null;
  conversionNetCommission: number | null;
  validatedAt: string | null;
  validationId: string | number | null;
  categoryLv1: string | null;
  itemNotes: string | null;
}

export interface OrderQuery {
  search?: string;
  orderStatus?: OrderStatus | '';
  bucket?: Bucket | '';
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export type SyncRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RATE_LIMITED';

export interface SyncRun {
  id: number;
  kind: 'CONVERSIONS' | 'VALIDATION';
  trigger: 'SCHEDULED' | 'MANUAL';
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string | null;
  rowsUpserted: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SyncStatus {
  running: boolean;
  lastRun: SyncRun | null;
  lastSuccessAt: string | null;
}

export interface ValidationImport {
  validationId: string | number;
  importedAt: string;
  conversions: number;
  totalCommission: number;
}

// Reports
export interface ReportSummary {
  orders: number;
  items: number;
  gmv: number;
  commission: {estimated: number; confirmed: number; rejected: number; validated: number};
  links: number;
  /** Always false: the Shopee Open API does not expose click counts. */
  clicksAvailable: false;
}

export type Granularity = 'day' | 'week' | 'month';

export interface TimeseriesPoint {
  period: string;
  orders: number;
  gmv: number;
  estimated: number;
  /** Includes validated commission. */
  confirmed: number;
  rejected: number;
}

export type TopBy = 'product' | 'shop' | 'subId' | 'campaign' | 'status' | 'category' | 'device' | 'buyerType';

export interface TopRow {
  key: string;
  label: string;
  orders: number;
  items: number;
  gmv: number;
  commission: number;
}
