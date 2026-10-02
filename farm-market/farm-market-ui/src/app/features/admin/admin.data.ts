import {PageResponse, toApiError} from '../../core/api';

/** Shared types/labels for the admin screens (data comes from the API). Money is integer VND. */

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';

export const STATUS_KEYS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

/** `cls` is the shared .pill modifier. */
export const STATUS: Record<OrderStatus, {label: string; cls: string}> = {
  PENDING: {label: 'Chờ xác nhận', cls: 'warn'},
  CONFIRMED: {label: 'Đã xác nhận', cls: 'ok'},
  PREPARING: {label: 'Đang chuẩn bị', cls: 'prep'},
  SHIPPING: {label: 'Đang giao', cls: 'info'},
  DELIVERED: {label: 'Đã giao', cls: ''},
  CANCELLED: {label: 'Đã hủy', cls: 'bad'}
};

/** Forward step of the backend state machine (CANCELLED is reachable from any non-final state). */
export const NEXT: Partial<Record<OrderStatus, {to: OrderStatus; label: string}>> = {
  PENDING: {to: 'CONFIRMED', label: 'Xác nhận đơn'},
  CONFIRMED: {to: 'PREPARING', label: 'Bắt đầu chuẩn bị'},
  PREPARING: {to: 'SHIPPING', label: 'Giao cho đơn vị vận chuyển'},
  SHIPPING: {to: 'DELIVERED', label: 'Đánh dấu đã giao'}
};

export const STEP_KEYS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED'];
export const STEP_NAMES = ['Đã đặt hàng', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã giao'];

export const PAY_LABEL: Record<string, string | undefined> = {COD: 'COD', BANK_TRANSFER: 'Chuyển khoản', EWALLET: 'Ví điện tử', CARD: 'Thẻ'};
export const SHIP_LABEL: Record<string, string | undefined> = {STANDARD: 'Tiêu chuẩn', FAST: 'Nhanh', PICKUP: 'Nhận tại cửa hàng'};

export const UNIT_CHIPS = ['Quả', 'Hộp', 'Khay', 'Kg', 'Con', 'Cặp', 'Bao'];
export const LOW_STOCK_LIMIT = 10;

/** List endpoints return `{data, meta}`. */
export type Paged<T> = PageResponse<T>;

/** User-facing text for an error (field errors joined, else the message). */
export function errMsg(e: unknown): string {
  const x = toApiError(e);
  const fields = Object.values(x.fieldErrors);
  return fields.length ? fields.join(' · ') : x.message;
}

const TZ = 'Asia/Ho_Chi_Minh';
const dm = new Intl.DateTimeFormat('vi-VN', {timeZone: TZ, day: '2-digit', month: '2-digit'});
const dmy = new Intl.DateTimeFormat('vi-VN', {timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric'});
const hm = new Intl.DateTimeFormat('vi-VN', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false});
const ymd = new Intl.DateTimeFormat('en-CA', {timeZone: TZ});

/** "30/09 09:42" */
export const fmtDateTime = (iso: string): string => `${dm.format(new Date(iso))} ${hm.format(new Date(iso))}`;
/** "30/09/2026" */
export const fmtDate = (iso: string): string => dmy.format(new Date(iso));
/** "30/09" */
export const fmtDayMonth = (iso: string): string => dm.format(new Date(iso));
/** "2026-09-30" (for <input type="date">), Vietnam time. */
export const toDateInput = (iso: string): string => ymd.format(new Date(iso));
