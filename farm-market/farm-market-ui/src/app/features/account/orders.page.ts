import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router} from '@angular/router';
import {Api, apiResource} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {vnd} from '../../core/format';
import {ImageSlot} from '../../shared/image-slot';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {
  ORDER_STATUS, OrderDetail, OrderStatusCode, OrderSummary, PAY_LABEL, Page, ReorderResult, errMsg, fmtDate, fmtDateTime, isFirstLoad, resErr, valueOr
} from './account.data';

const TABS: [string, OrderStatusCode | ''][] = [
  ['Tất cả', ''], ['Chờ xác nhận', 'PENDING'], ['Đã xác nhận', 'CONFIRMED'], ['Đang chuẩn bị', 'PREPARING'],
  ['Đang giao', 'SHIPPING'], ['Đã giao', 'DELIVERED'], ['Đã hủy', 'CANCELLED']
];
const FLOW: OrderStatusCode[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED'];

@Component({
  selector: 'app-account-orders-page',
  imports: [ImageSlot, StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
  styleUrl: './orders.page.css'
})
export class AccountOrdersPage {
  private readonly api = inject(Api);
  private readonly branch = inject(BranchStore);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  protected readonly ORDER_STATUS = ORDER_STATUS;
  protected readonly tabs = TABS;
  protected readonly tab = signal<OrderStatusCode | ''>('');
  protected readonly query = signal('');
  protected readonly page = signal(0);
  private readonly ordersRes = apiResource<Page<OrderSummary>>(() => ({path: '/orders', params: {status: this.tab(), page: this.page(), size: 10}}));
  protected readonly orders = computed(() => valueOr(this.ordersRes, null)?.data ?? []);
  protected readonly totalPages = computed(() => valueOr(this.ordersRes, null)?.meta.totalPages ?? 0);
  protected readonly loading = computed(() => isFirstLoad(this.ordersRes));
  protected readonly error = computed(() => resErr(this.ordersRes));
  private readonly picked = signal('');
  /** The picked order if it is on this page, otherwise the first one. */
  protected readonly selCode = computed(() => {
    const l = this.orders();
    return l.some(o => o.code === this.picked()) ? this.picked() : (l[0]?.code ?? '');
  });
  private readonly detailRes = apiResource<OrderDetail>(() => (this.selCode() ? {path: '/orders/' + encodeURIComponent(this.selCode())} : undefined));
  protected readonly detail = computed(() => valueOr(this.detailRes, null));
  protected readonly detailLoading = computed(() => this.detailRes.isLoading());
  protected readonly detailError = computed(() => resErr(this.detailRes));
  /** order codes with a cancel/reorder request in flight */
  protected readonly busyCodes = signal<ReadonlySet<string>>(new Set());
  protected readonly reordered = signal('');
  protected readonly notice = signal('');
  protected readonly noticeErr = signal(false);

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.orders().filter(o => !q || o.code.toLowerCase().includes(q) || o.items.some(i => i.name.toLowerCase().includes(q)));
  });
  protected readonly rows = computed(() => this.shown().map(o => ({
    o,
    date: fmtDate(o.createdAt),
    status: ORDER_STATUS[o.status],
    branch: this.branch.branches[o.branchId - 1]?.short ?? '',
    dot: this.branch.branches[o.branchId - 1] ? this.branch.themeOf(o.branchId - 1).primary : 'var(--primary)',
    summary: o.items.slice(0, 2).map(i => i.name).join(', ') + (o.items.length > 2 ? ` và ${o.items.length - 2} sản phẩm khác` : ''),
    thumbs: o.items.slice(0, 3)
  })));
  protected readonly detailAddr = computed(() => {
    const s = this.detail()?.shipping;
    return s ? [s.line1, s.ward, s.district, s.city].filter(Boolean).join(', ') : '';
  });
  protected readonly detailPay = computed(() => {
    const m = this.detail()?.paymentMethod ?? '';
    return PAY_LABEL[m] ?? m;
  });
  protected readonly steps = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const out = [{name: 'Đã đặt hàng', time: fmtDateTime(d.createdAt), on: true, bad: false}];
    for (const h of d.history) {
      if (h.to !== 'PENDING') out.push({name: ORDER_STATUS[h.to].name, time: fmtDateTime(h.at), on: true, bad: h.to === 'CANCELLED'});
    }
    if (d.status !== 'CANCELLED') {
      for (const st of FLOW.slice(FLOW.indexOf(d.status) + 1)) out.push({name: ORDER_STATUS[st].name, time: 'Chưa đến', on: false, bad: false});
    }
    return out.map(s => ({...s, key: s.name + '|' + s.time}));
  });

  protected reload(): void {
    this.ordersRes.reload();
  }

  protected setTab(t: OrderStatusCode | ''): void {
    this.page.set(0);
    this.tab.set(t);
  }

  protected go(p: number): void {
    this.page.set(p);
  }

  protected select(o: OrderSummary): void {
    this.picked.set(o.code);
    this.reordered.set('');
  }

  private flash(msg: string, err = false): void {
    this.notice.set(msg);
    this.noticeErr.set(err);
  }

  /** Runs `fn` with `code` marked busy; a second call for the same code while in flight is ignored. */
  private async guarded(code: string, fn: () => Promise<void>): Promise<void> {
    if (this.busyCodes().has(code)) return;
    this.busyCodes.update(s => new Set(s).add(code));
    try {
      await fn();
    } finally {
      this.busyCodes.update(s => {
        const n = new Set(s);
        n.delete(code);
        return n;
      });
    }
  }

  protected cancel(e: Event, o: OrderSummary): Promise<void> {
    e.stopPropagation();
    return this.guarded(o.code, () => this.doCancel(o));
  }

  private async doCancel(o: OrderSummary): Promise<void> {
    try {
      await this.api.post('/orders/' + encodeURIComponent(o.code) + '/cancel');
      this.flash(`Đã hủy đơn ${o.code}.`);
      this.ordersRes.reload();
      if (this.selCode() === o.code) this.detailRes.reload();
    } catch (err) {
      this.flash(errMsg(err), true);
    }
  }

  protected review(e: Event): void {
    e.stopPropagation();
    void this.router.navigate(['/account/reviews']);
  }

  protected reorderBtn(e: Event, o: OrderSummary): void {
    e.stopPropagation();
    void this.reorder(o.code);
  }

  /** POST /reorder returns the purchasable lines (capped at stock); skipped ones are reported, not added. */
  protected reorder(code: string): Promise<void> {
    return this.guarded(code, () => this.doReorder(code));
  }

  private async doReorder(code: string): Promise<void> {
    try {
      const r = await this.api.post<ReorderResult>('/orders/' + encodeURIComponent(code) + '/reorder');
      this.cart.addAll(r.lines.map(l => ({productId: l.productId, branchId: r.branchId, name: l.name, qty: l.quantity, unitPrice: l.unitPrice, unit: l.unit})));
      this.reordered.set(code);
      this.flash(r.skipped.length
        ? `Đã thêm ${r.lines.length} sản phẩm. Không thể mua lại: ${r.skipped.map(s => `${s.name} (${s.reason})`).join('; ')}`
        : `Đã thêm ${r.lines.length} sản phẩm vào giỏ.`, !r.lines.length);
    } catch (err) {
      this.flash(errMsg(err), true);
    }
  }

  protected invoice(d: OrderDetail): void {
    // ponytail: client-side text receipt; there is no invoice endpoint
    const body = [`Hóa đơn ${d.code}`, fmtDate(d.createdAt), ...d.items.map(i => `${i.name} x${i.quantity}  ${vnd(i.lineTotal)}`), `Tổng cộng: ${vnd(d.total)}`].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], {type: 'text/plain;charset=utf-8'}));
    a.download = `hoa-don-${d.code}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
