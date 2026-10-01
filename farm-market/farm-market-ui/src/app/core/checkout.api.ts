import {Injectable, inject} from '@angular/core';
import {Api} from './api';

/** Order of SHIP_OPTIONS / PAY_OPTIONS in mock-data mapped to the backend enums. */
export const SHIP_METHODS = ['STANDARD', 'FAST', 'PICKUP'] as const;
export const PAY_METHODS = ['COD', 'BANK_TRANSFER', 'EWALLET', 'CARD'] as const;
export type ShippingMethod = (typeof SHIP_METHODS)[number];
export type PaymentMethod = (typeof PAY_METHODS)[number];
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';

export interface Address {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  ward: string | null;
  district: string | null;
  city: string | null;
  nearestBranchId: number | null;
  isDefault: boolean;
}

export interface AddressRequest {
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  ward?: string;
  district?: string;
  city?: string;
  makeDefault: boolean;
}

export interface PromoResult {
  code: string;
  discount: number;
  shippingDiscount: number;
  totalDiscount: number;
}

export interface CheckoutBody {
  addressId: number;
  branchId: number;
  items: {productId: number; quantity: number}[];
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  promoCode?: string;
  usePoints?: number;
  customerNote?: string;
}

export interface OrderLine {
  productId: number;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PaymentInfo {
  method: PaymentMethod;
  status: 'UNPAID' | 'PAID';
  qrUrl: string | null;
  bankName: string | null;
  accountNo: string | null;
  accountName: string | null;
  transferNote: string | null;
}

export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  shippingMethod: ShippingMethod;
  shippingFee: number;
  subtotal: number;
  discount: number;
  tierDiscount: number;
  pointsDiscount: number;
  total: number;
  promoCode: string | null;
  branchId: number;
  branchName: string;
  shipping: {recipient: string; phone: string; line1: string; ward: string | null; district: string | null; city: string | null};
  trackingCode: string | null;
  createdAt: string;
  items: OrderLine[];
  history: {from: OrderStatus | null; to: OrderStatus; note: string | null; at: string}[];
  payment: PaymentInfo | null;
}

@Injectable({providedIn: 'root'})
export class CheckoutApi {
  private readonly api = inject(Api);

  addresses(): Promise<Address[]> {
    return this.api.get<Address[]>('/addresses');
  }

  createAddress(r: AddressRequest): Promise<Address> {
    return this.api.post<Address>('/addresses', r);
  }

  validatePromo(code: string, branchId: number, subtotal: number, shippingFee: number): Promise<PromoResult> {
    return this.api.post<PromoResult>('/promotions/validate', {code, branchId, subtotal, shippingFee});
  }

  placeOrder(body: CheckoutBody, idempotencyKey: string): Promise<Order> {
    return this.api.post<Order>('/orders', body, idempotencyKey);
  }

  order(code: string): Promise<Order> {
    return this.api.get<Order>('/orders/' + encodeURIComponent(code));
  }
}
