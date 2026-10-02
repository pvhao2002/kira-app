import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {apiResource, resourceError} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {Order, OrderStatus, PaymentMethod} from '../../core/checkout.api';

const STEPS: {status: OrderStatus; name: string}[] = [
  {status: 'PENDING', name: 'Đã đặt hàng'},
  {status: 'CONFIRMED', name: 'Đã xác nhận'},
  {status: 'PREPARING', name: 'Đang chuẩn bị'},
  {status: 'SHIPPING', name: 'Đang giao'},
  {status: 'DELIVERED', name: 'Đã giao'}
];
const PAY_NAME: Record<PaymentMethod, string> = {COD: 'COD', BANK_TRANSFER: 'Chuyển khoản', EWALLET: 'Ví điện tử', CARD: 'Online'};
const SHIP_NAME = {STANDARD: 'Giao tiêu chuẩn', FAST: 'Giao nhanh (2 giờ)', PICKUP: 'Nhận tại cửa hàng'};

const fmt = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'});

@Component({
  selector: 'app-order-success-page',
  imports: [VndPipe, StateBox, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-success.page.html',
  styleUrl: './order-success.page.css'
})
export class OrderSuccessPage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthStore);

  readonly code = toSignal(this.route.paramMap.pipe(map(p => p.get('code') ?? '')), {initialValue: ''});
  private readonly orderRes = apiResource<Order>(() => ({path: '/orders/' + encodeURIComponent(this.code())}));
  readonly order = computed(() => (this.orderRes.hasValue() ? this.orderRes.value() : null));
  readonly loading = this.orderRes.isLoading;
  readonly error = computed(() => resourceError(this.orderRes)?.message ?? '');

  readonly customer = computed(() => this.auth.user()?.name ?? 'bạn');
  readonly stage = computed(() => Math.max(0, STEPS.findIndex(s => s.status === this.order()?.status)));
  readonly payName = computed(() => PAY_NAME[this.order()?.paymentMethod ?? 'COD']);
  readonly shipName = computed(() => SHIP_NAME[this.order()?.shippingMethod ?? 'STANDARD']);
  readonly placedAt = computed(() => (this.order() ? fmt(this.order()!.createdAt) : ''));
  readonly address = computed(() => {
    const s = this.order()?.shipping;
    return s ? [s.line1, s.ward, s.district, s.city].filter(Boolean).join(', ') : '';
  });

  /** Steps with the time each was reached, from the status history. */
  readonly timeline = computed(() => {
    const o = this.order();
    return STEPS.map(s => {
      const h = o?.history.find(x => x.to === s.status);
      return {...s, time: h ? fmt(h.at) : s.status === o?.status ? 'Đang xử lý' : ''};
    });
  });

  readonly copied = signal(false);

  async copy(text: string | null | undefined): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard may be blocked; the note stays selectable on screen.
    }
  }
}
