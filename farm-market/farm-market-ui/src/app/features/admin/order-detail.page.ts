import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {Api, apiResource} from '../../core/api';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {NEXT, OrderStatus, PAY_LABEL, SHIP_LABEL, STATUS, STEP_KEYS, STEP_NAMES, errMsg, fmtDateTime} from './admin.data';

interface Line {productId: number; sku: string; name: string; unit: string; unitPrice: number; quantity: number; lineTotal: number}
interface Detail {
  order: {
    code: string;
    status: OrderStatus;
    paymentMethod: string;
    paymentStatus: 'UNPAID' | 'PAID';
    shippingMethod: string;
    shippingFee: number;
    subtotal: number;
    discount: number;
    tierDiscount: number;
    pointsUsed: number;
    pointsDiscount: number;
    total: number;
    promoCode: string | null;
    voucherCode: string | null;
    branchName: string;
    shipping: {recipient: string; phone: string; line1: string; ward: string; district: string; city: string};
    customerNote: string | null;
    trackingCode: string | null;
    createdAt: string;
    items: Line[];
    history: {from: OrderStatus | null; to: OrderStatus; note: string | null; at: string}[];
    payment: {transferNote: string | null} | null;
  };
  customerId: number | null;
  customerName: string | null;
  notes: {id: number; authorName: string; body: string; createdAt: string}[];
}

@Component({
  selector: 'app-admin-order-detail-page',
  imports: [RouterLink, StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail.page.html',
  styleUrl: './order-detail.page.css'
})
export class AdminOrderDetailPage {
  private readonly api = inject(Api);
  private readonly code = toSignal(inject(ActivatedRoute).paramMap.pipe(map(p => p.get('id') ?? '')), {initialValue: ''});

  readonly status = STATUS;
  readonly pay = PAY_LABEL;
  readonly ship = SHIP_LABEL;

  readonly busy = signal(false);
  readonly actionErr = signal('');
  readonly noteErr = signal('');
  readonly payErr = signal('');
  readonly tracking = signal('');

  readonly res = apiResource<Detail>(() => ({path: `/admin/orders/${encodeURIComponent(this.code())}`}));

  readonly detail = computed(() => (this.res.hasValue() ? this.res.value() : null));
  readonly error = computed(() => (this.res.error() ? errMsg(this.res.error()) : ''));
  readonly view = computed(() => {
    const d = this.detail();
    if (!d) return null;
    const o = d.order;
    return {
      created: fmtDateTime(o.createdAt),
      address: [o.shipping.line1, o.shipping.ward, o.shipping.district, o.shipping.city].filter(Boolean).join(', '),
      notes: d.notes.map(n => ({...n, time: fmtDateTime(n.createdAt)}))
    };
  });
  readonly next = computed(() => NEXT[this.detail()?.order.status as OrderStatus]);

  readonly steps = computed(() => {
    const o = this.detail()?.order;
    if (!o) return [];
    const at = (s: OrderStatus) => (s === 'PENDING' ? o.createdAt : o.history.find(h => h.to === s)?.at);
    const rows = STEP_KEYS.map((k, i) => {
      const t = at(k);
      return {name: STEP_NAMES[i], time: t ? fmtDateTime(t) : 'Chưa đến', mark: t ? '✓' : '', reached: !!t, cancel: false};
    });
    if (o.status !== 'CANCELLED') return rows;
    const t = at('CANCELLED');
    return [...rows.filter(r => r.reached), {name: 'Đã hủy', time: t ? fmtDateTime(t) : '', mark: '✕', reached: false, cancel: true}];
  });

  cancel(): void {
    if (confirm('Hủy đơn hàng này? Hàng đang giữ sẽ được trả về kho.')) void this.change('CANCELLED');
  }

  async change(to: OrderStatus): Promise<void> {
    const o = this.detail()?.order;
    if (!o || this.busy()) return;
    this.busy.set(true);
    this.actionErr.set('');
    try {
      const body = to === 'SHIPPING' ? {status: to, trackingCode: this.tracking().trim()} : {status: to};
      this.res.value.set(await this.api.post<Detail>(`/admin/orders/${encodeURIComponent(o.code)}/status`, body));
      this.tracking.set('');
    } catch (e) {
      this.actionErr.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  async setPaid(paid: boolean): Promise<void> {
    const o = this.detail()?.order;
    if (!o || this.busy()) return;
    if (!paid && !confirm('Đánh dấu đơn này là chưa thanh toán?')) return;
    this.busy.set(true);
    this.payErr.set('');
    try {
      this.res.value.set(await this.api.post<Detail>(`/admin/orders/${encodeURIComponent(o.code)}/payment`, {status: paid ? 'PAID' : 'UNPAID'}));
    } catch (e) {
      this.payErr.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  async addNote(input: HTMLInputElement): Promise<void> {
    const o = this.detail()?.order;
    const body = input.value.trim();
    if (!o || !body || this.busy()) return;
    this.busy.set(true);
    this.noteErr.set('');
    try {
      await this.api.post(`/admin/orders/${encodeURIComponent(o.code)}/notes`, {body});
      input.value = '';
      this.res.reload();
    } catch (e) {
      this.noteErr.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }
}
