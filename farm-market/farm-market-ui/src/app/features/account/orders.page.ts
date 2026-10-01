import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {Router} from '@angular/router';
import {Api} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {vnd} from '../../core/format';
import {ImageSlot} from '../../shared/image-slot';
import {
  ORDER_STATUS, OrderDetail, OrderStatusCode, OrderSummary, PAY_LABEL, Page, ReorderResult, errMsg, fmtDate, fmtDateTime
} from './account.data';

const TABS: [string, OrderStatusCode | ''][] = [
  ['Tất cả', ''], ['Chờ xác nhận', 'PENDING'], ['Đã xác nhận', 'CONFIRMED'], ['Đang chuẩn bị', 'PREPARING'],
  ['Đang giao', 'SHIPPING'], ['Đã giao', 'DELIVERED'], ['Đã hủy', 'CANCELLED']
];
const FLOW: OrderStatusCode[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED'];

@Component({
  selector: 'app-account-orders-page',
  imports: [ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row head">
      <h1 class="page-title">Lịch sử đơn hàng</h1><span class="spacer"></span>
      <input class="input search" type="search" placeholder="Tìm mã đơn, tên sản phẩm (trang hiện tại)…" aria-label="Tìm đơn hàng"
             [value]="query()" (input)="query.set($any($event.target).value)">
    </div>
    <div class="row wrap tabs">
      @for (t of tabs; track t[1]) {
        <button type="button" class="tab-pill" [class.on]="tab() === t[1]" (click)="setTab(t[1])">{{ t[0] }}</button>
      }
    </div>
    @if (notice(); as n) { <div class="msg" [class.err]="noticeErr()" role="status">{{ n }}</div> }

    @if (loading() && !orders().length) {
      <div class="state-box">Đang tải đơn hàng…</div>
    } @else if (error()) {
      <div class="state-box" role="alert"><b>Không tải được đơn hàng</b>{{ error() }}
        <button type="button" class="btn sm" (click)="load()">Thử lại</button></div>
    } @else {
    <div class="layout">
      <div class="list">
        @for (o of shown(); track o.code) {
          <div class="card order" [class.sel]="o.code === selCode()" tabindex="0" (click)="select(o)" (keydown.enter)="select(o)">
            <div class="row wrap top">
              <b>{{ o.code }}</b><span class="muted">{{ date(o.createdAt) }}</span>
              <span class="br"><span class="dot" [style.background]="dotColor(o.branchId)"></span>{{ branchName(o.branchId) }}</span>
              <span class="spacer"></span>
              <span class="pill" [class]="status(o).cls">{{ status(o).name }}</span>
            </div>
            <div class="row mid">
              @for (it of o.items.slice(0, 3); track $index) { <app-image-slot class="th" caption="Ảnh" [radius]="10" ratio="1 / 1" /> }
              <span class="sum">{{ summary(o) }}</span>
              <div class="tot"><div class="muted">{{ o.itemCount }} sản phẩm</div><b>{{ vnd(o.total) }}</b></div>
            </div>
            <div class="row acts">
              @if (o.status === 'PENDING' || o.status === 'CONFIRMED') {
                <button type="button" class="btn sm danger" [disabled]="busy()" (click)="cancel($event, o)">Hủy đơn</button>
              }
              @if (o.status === 'DELIVERED') {
                <button type="button" class="btn sm secondary" (click)="review($event)">Đánh giá</button>
              }
              @if (o.status === 'DELIVERED' || o.status === 'CANCELLED') {
                <button type="button" class="btn sm" [disabled]="busy()" (click)="reorderBtn($event, o)">Mua lại</button>
              } @else {
                <button type="button" class="btn sm secondary" (click)="select(o)">Theo dõi đơn</button>
              }
            </div>
          </div>
        } @empty {
          <div class="state-box"><b>Chưa có đơn nào</b>Các đơn ở trạng thái này sẽ hiện ở đây.</div>
        }
        @if (totalPages() > 1) {
          <div class="row pager">
            <button type="button" class="btn secondary sm" [disabled]="page() === 0" (click)="go(page() - 1)">‹ Trước</button>
            <span class="muted">Trang {{ page() + 1 }} / {{ totalPages() }}</span>
            <button type="button" class="btn secondary sm" [disabled]="page() + 1 >= totalPages()" (click)="go(page() + 1)">Sau ›</button>
          </div>
        }
      </div>

      @if (selCode()) {
        <aside class="card detail">
          @if (detailLoading()) { <div class="muted">Đang tải chi tiết…</div> }
          @else if (detailError()) { <div class="msg err" role="alert">{{ detailError() }}</div> }
          @else if (detail(); as d) {
            <div class="row"><div><div class="muted">Chi tiết đơn</div><b>{{ d.code }}</b></div><span class="spacer"></span>
              <span class="pill" [class]="ORDER_STATUS[d.status].cls">{{ ORDER_STATUS[d.status].name }}</span></div>
            <ol class="steps">
              @for (s of steps(); track $index) {
                <li [class.on]="s.on" [class.bad]="s.bad"><span class="mark"></span><div><div class="sn">{{ s.name }}</div><div class="muted">{{ s.time }}</div></div></li>
              }
            </ol>
            @for (it of d.items; track $index) {
              <div class="row item">
                <app-image-slot class="th" caption="Ảnh" [radius]="8" ratio="1 / 1" />
                <div class="grow"><div>{{ it.name }}</div><div class="muted">× {{ it.quantity }}</div></div>
                <b>{{ it.unitPrice ? vnd(it.lineTotal) : 'Quà tặng' }}</b>
              </div>
            }
            <div class="totals">
              <span class="muted">Tạm tính</span><span>{{ vnd(d.subtotal) }}</span>
              <span class="muted">Phí giao hàng</span><span>{{ d.shippingFee ? vnd(d.shippingFee) : 'Miễn phí' }}</span>
              @if (d.discount) { <span class="muted">Khuyến mãi</span><span>−{{ vnd(d.discount) }}</span> }
              @if (d.tierDiscount) { <span class="muted">Ưu đãi hạng</span><span>−{{ vnd(d.tierDiscount) }}</span> }
              @if (d.pointsDiscount) { <span class="muted">Dùng điểm</span><span>−{{ vnd(d.pointsDiscount) }}</span> }
              <span class="muted">Thanh toán</span><span>{{ payLabel(d.paymentMethod) }}</span>
              <b>Tổng cộng</b><b>{{ vnd(d.total) }}</b>
            </div>
            <div class="ship"><div class="muted">Giao đến</div>
              <div>{{ d.shipping.recipient }} · {{ d.shipping.phone }}</div>
              <div>{{ addr(d) }}</div>
              <div class="muted">Xuất từ {{ d.branchName }}</div>
              @if (d.trackingCode) { <div class="muted">Mã vận đơn: {{ d.trackingCode }}</div> }</div>
            <div class="row">
              <button type="button" class="btn grow" [disabled]="busy()" (click)="reorder(d.code)">{{ reordered() === d.code ? 'Đã thêm vào giỏ ✓' : 'Mua lại cả đơn' }}</button>
              <button type="button" class="btn secondary" (click)="invoice(d)">Tải hóa đơn</button>
            </div>
          }
        </aside>
      }
    </div>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .head { margin-bottom: 20px; }
    .search { max-width: 280px; }
    .tabs { margin-bottom: 20px; }
    .msg { font-size: 13px; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); margin-bottom: 16px; }
    .msg.err { color: var(--danger); background: var(--danger-bg); }
    .layout { display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: start; }
    .list { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .order { cursor: pointer; display: flex; flex-direction: column; gap: 14px; padding: 18px; border-color: transparent; }
    .order.sel { border: 1.5px solid var(--primary); }
    .br { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .th { width: 48px; flex: none; }
    .sum { flex: 1; min-width: 0; }
    .tot { text-align: right; flex: none; }
    .acts { justify-content: flex-end; }
    .pager { justify-content: center; align-items: center; }
    .detail { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 16px; padding: 20px; }
    .steps { list-style: none; margin: 0; padding: 0; }
    .steps li { display: flex; gap: 12px; padding-bottom: 14px; position: relative; color: var(--muted); }
    .steps li::before { content: ''; position: absolute; left: 6px; top: 16px; bottom: 0; width: 1.5px; background: var(--line); }
    .steps li:last-child::before { display: none; }
    .steps li.on { color: var(--ink); }
    .steps li.on::before { background: var(--primary); }
    .mark { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--surface); flex: none; margin-top: 3px; z-index: 1; }
    .on .mark { background: var(--primary); border-color: var(--primary); }
    .bad .mark { background: var(--danger); border-color: var(--danger); }
    .steps li.bad { color: var(--danger); }
    .sn { font-weight: 600; font-size: 14px; }
    .item { padding: 6px 0; }
    .grow { flex: 1; min-width: 0; }
    .totals { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .totals > :nth-child(even) { text-align: right; }
    .ship { background: var(--surface-2); border-radius: 12px; padding: 12px 14px; font-size: 13px; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .detail { position: static; } }
    @media (max-width: 767px) {
      .head { flex-wrap: wrap; } .search { max-width: none; width: 100%; }
      .tabs { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; } .tabs .tab-pill { flex: none; }
      .mid { flex-wrap: wrap; } .tot { text-align: left; width: 100%; } .acts .btn { flex: 1; }
    }
  `
})
export class AccountOrdersPage {
  private readonly api = inject(Api);
  private readonly branch = inject(BranchStore);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  protected readonly vnd = vnd;
  protected readonly ORDER_STATUS = ORDER_STATUS;
  protected readonly tabs = TABS;
  protected readonly tab = signal<OrderStatusCode | ''>('');
  protected readonly query = signal('');
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly orders = signal<OrderSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly selCode = signal('');
  protected readonly detail = signal<OrderDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  protected readonly busy = signal(false);
  protected readonly reordered = signal('');
  protected readonly notice = signal('');
  protected readonly noticeErr = signal(false);

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.orders().filter(o => !q || o.code.toLowerCase().includes(q) || o.items.some(i => i.name.toLowerCase().includes(q)));
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
    return out;
  });

  constructor() {
    effect(() => {
      this.tab();
      this.page();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.get<Page<OrderSummary>>('/orders', {status: this.tab(), page: this.page(), size: 10});
      this.orders.set(r.data);
      this.totalPages.set(r.meta.totalPages);
      if (!r.data.some(o => o.code === this.selCode())) {
        this.selCode.set('');
        this.detail.set(null);
        if (r.data.length) this.select(r.data[0]);
      }
    } catch (e) {
      this.error.set(errMsg(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected setTab(t: OrderStatusCode | ''): void {
    this.page.set(0);
    this.tab.set(t);
  }

  protected go(p: number): void {
    this.page.set(p);
  }

  protected date = fmtDate;
  protected status = (o: OrderSummary) => ORDER_STATUS[o.status];
  protected payLabel = (m: string): string => PAY_LABEL[m] ?? m;
  protected branchName = (id: number): string => this.branch.branches[id - 1]?.short ?? '';
  protected dotColor = (id: number): string => (this.branch.branches[id - 1] ? this.branch.themeOf(id - 1).primary : 'var(--primary)');
  protected addr = (d: OrderDetail): string => [d.shipping.line1, d.shipping.ward, d.shipping.district, d.shipping.city].filter(Boolean).join(', ');
  protected summary = (o: OrderSummary): string =>
    o.items.slice(0, 2).map(i => i.name).join(', ') + (o.items.length > 2 ? ` và ${o.items.length - 2} sản phẩm khác` : '');

  protected select(o: OrderSummary): void {
    this.selCode.set(o.code);
    this.reordered.set('');
    void this.loadDetail(o.code);
  }

  private async loadDetail(code: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const d = await this.api.get<OrderDetail>('/orders/' + encodeURIComponent(code));
      if (this.selCode() === code) this.detail.set(d);
    } catch (e) {
      this.detail.set(null);
      this.detailError.set(errMsg(e));
    } finally {
      this.detailLoading.set(false);
    }
  }

  private flash(msg: string, err = false): void {
    this.notice.set(msg);
    this.noticeErr.set(err);
  }

  protected async cancel(e: Event, o: OrderSummary): Promise<void> {
    e.stopPropagation();
    this.busy.set(true);
    try {
      await this.api.post('/orders/' + encodeURIComponent(o.code) + '/cancel');
      this.flash(`Đã hủy đơn ${o.code}.`);
      await this.load();
      if (this.selCode() === o.code) await this.loadDetail(o.code);
    } catch (err) {
      this.flash(errMsg(err), true);
    } finally {
      this.busy.set(false);
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
  protected async reorder(code: string): Promise<void> {
    this.busy.set(true);
    try {
      const r = await this.api.post<ReorderResult>('/orders/' + encodeURIComponent(code) + '/reorder');
      this.cart.addAll(r.lines.map(l => ({productId: l.productId, branchId: r.branchId, name: l.name, qty: l.quantity, unitPrice: l.unitPrice, unit: l.unit})));
      this.reordered.set(code);
      this.flash(r.skipped.length
        ? `Đã thêm ${r.lines.length} sản phẩm. Không thể mua lại: ${r.skipped.map(s => `${s.name} (${s.reason})`).join('; ')}`
        : `Đã thêm ${r.lines.length} sản phẩm vào giỏ.`, !r.lines.length);
    } catch (err) {
      this.flash(errMsg(err), true);
    } finally {
      this.busy.set(false);
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
