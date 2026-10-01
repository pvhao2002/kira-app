/** Response shapes + small helpers for the customer account area (backend /api/v1; money is integer VND). */
import type {ApiError} from '../../core/api';

/** Real list envelope: the backend nests the paging fields under `meta` (core/api.ts PageResponse is flat). */
export interface Page<T> {
  data: T[];
  meta: {page: number; size: number; totalElements: number; totalPages: number};
}

export type OrderStatusCode = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';

export interface OrderLine {
  productId: number;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderSummary {
  id: number;
  code: string;
  status: OrderStatusCode;
  total: number;
  itemCount: number;
  paymentMethod: string;
  branchId: number;
  createdAt: string;
  items: OrderLine[];
}

export interface OrderDetail {
  id: number;
  code: string;
  status: OrderStatusCode;
  paymentMethod: string;
  shippingFee: number;
  subtotal: number;
  discount: number;
  tierDiscount: number;
  pointsDiscount: number;
  total: number;
  branchId: number;
  branchName: string;
  shipping: {recipient: string; phone: string; line1: string; ward?: string; district?: string; city?: string};
  trackingCode?: string;
  createdAt: string;
  items: OrderLine[];
  history: {from: OrderStatusCode | null; to: OrderStatusCode; note?: string; at: string}[];
}

export interface ReorderResult {
  branchId: number;
  lines: {productId: number; name: string; unit: string; unitPrice: number; quantity: number; requestedQuantity: number}[];
  skipped: {productId: number; name: string; reason: string}[];
}

export const ORDER_STATUS: Record<OrderStatusCode, {name: string; cls: string}> = {
  PENDING: {name: 'Chờ xác nhận', cls: 'warn'},
  CONFIRMED: {name: 'Đã xác nhận', cls: 'info'},
  PREPARING: {name: 'Đang chuẩn bị', cls: 'info'},
  SHIPPING: {name: 'Đang giao', cls: 'info'},
  DELIVERED: {name: 'Đã giao', cls: 'ok'},
  CANCELLED: {name: 'Đã hủy', cls: 'bad'}
};

export const PAY_LABEL: Record<string, string> = {COD: 'Tiền mặt khi nhận (COD)', BANK_TRANSFER: 'Chuyển khoản', EWALLET: 'Ví điện tử', CARD: 'Thẻ'};

export interface AddressDto {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  ward: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  nearestBranchId: number | null;
  isDefault: boolean;
}

export interface TierInfo {
  code: string;
  label: string;
  minPoints: number;
  discountPercent: number;
  freeFastDelivery: boolean;
  perks: string[];
}

export interface LoyaltySummary {
  balance: number;
  pointValueVnd: number;
  tier: TierInfo;
  nextTier: TierInfo | null;
  pointsToNextTier: number;
  yearPoints: number;
  expiringSoonPoints: number;
  expiringSoonAt: string | null;
}

export interface PointEntry {
  id: number;
  delta: number;
  reason: string;
  refType?: string;
  refId?: string;
  createdAt: string;
}

export interface RewardDto {
  id: string;
  title: string;
  pointsCost: number;
  discountType: 'PERCENT' | 'FIXED' | 'FREE_SHIP';
  value: number;
  minOrder: number;
  validDays: number;
  affordable: boolean;
}

export interface VoucherDto {
  id: number;
  code: string;
  title: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED';
  expiresAt: string;
}

export interface WishEntry {
  productId: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  unit: string;
  price: number;
  status: string;
  availability: {branchId: number; productId: number; slug: string; price: number; available: number; inStock: boolean} | null;
}

export interface PendingReviewDto {
  orderId: number;
  orderCode: string;
  productId: number;
  productName: string;
  imageUrl: string | null;
  deliveredAt: string;
}

export interface MyReviewDto {
  id: number;
  productName: string;
  rating: number;
  body: string | null;
  photoUrl: string | null;
  pointsAwarded: number;
  createdAt: string;
  reply: {body: string; repliedAt: string} | null;
}

export const REVIEW_LABELS = ['Chạm để chấm điểm', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Tuyệt vời'];

export const fmtDate = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');
export const fmtDateTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '';

/** User-facing message from a thrown ApiError (api.ts converts every failure to one). */
export const errMsg = (e: unknown): string => (e as Partial<ApiError>)?.message ?? 'Đã có lỗi xảy ra.';
