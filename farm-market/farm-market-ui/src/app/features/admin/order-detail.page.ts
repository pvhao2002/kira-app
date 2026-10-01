import {ChangeDetectionStrategy, Component, computed, inject, resource, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {Api} from '../../core/api';
import {vnd} from '../../core/format';
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
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (res.error()) {
      <div class="state-box" role="alert">
        <b>{{ msg(res.error()) }}</b>
        <a class="btn secondary" routerLink="/admin/orders">Về danh sách đơn hàng</a>
      </div>
    } @else if (detail(); as d) {
      @let o = d.order;
      <div class="eyebrow"><a routerLink="/admin/orders">Đơn hàng</a> / {{ o.code }}</div>
      <header class="head">
        <h1 class="page-title">{{ o.code }}</h1>
        <span class="pill" [class]="status[o.status].cls">{{ status[o.status].label }}</span>
        <span class="muted">Đặt lúc {{ time(o.createdAt) }} · {{ o.branchName }}</span>
      </header>

      <div class="layout">
        <div class="stack">
          <div class="card">
            <b>Sản phẩm</b>
            @for (l of o.items; track l.productId) {
              <div class="line">
                <i class="thumb" aria-hidden="true"></i>
                <div class="grow"><div>{{ l.name }}</div><div class="muted small">{{ money(l.unitPrice) }} / {{ l.unit }} · <span class="mono">{{ l.sku }}</span></div></div>
                <span class="muted">× {{ l.quantity }}</span>
                <b>{{ money(l.lineTotal) }}</b>
              </div>
            }
            <dl class="sum">
              <dt class="muted">Tạm tính</dt><dd>{{ money(o.subtotal) }}</dd>
              <dt class="muted">Phí giao hàng</dt><dd>{{ money(o.shippingFee) }}</dd>
              @if (o.discount) {
                <dt class="muted">Khuyến mãi{{ o.promoCode ? ' ' + o.promoCode : '' }}</dt><dd class="ok">−{{ money(o.discount) }}</dd>
              }
              @if (o.tierDiscount) {
                <dt class="muted">Ưu đãi hạng thành viên</dt><dd class="ok">−{{ money(o.tierDiscount) }}</dd>
              }
              @if (o.pointsDiscount) {
                <dt class="muted">Dùng {{ o.pointsUsed }} điểm</dt><dd class="ok">−{{ money(o.pointsDiscount) }}</dd>
              }
              <dt><b>Tổng cộng</b></dt><dd><b class="total">{{ money(o.total) }}</b></dd>
            </dl>
          </div>

          <div class="two">
            <div class="card">
              <b>Khách hàng</b>
              <div class="info">
                <div>{{ d.customerName || o.shipping.recipient }}</div>
                <div class="muted">{{ o.shipping.recipient }} · {{ o.shipping.phone }}</div>
                <div class="muted">{{ address(o.shipping) }}</div>
                @if (o.customerNote) {<div class="muted">Ghi chú: {{ o.customerNote }}</div>}
              </div>
            </div>
            <div class="card">
              <b>Thanh toán &amp; giao hàng</b>
              <dl class="kv">
                <dt class="muted">Phương thức</dt><dd>{{ pay[o.paymentMethod] ?? o.paymentMethod }}</dd>
                <dt class="muted">Trạng thái</dt><dd>{{ o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán' }}</dd>
                <dt class="muted">Giao hàng</dt><dd>{{ ship[o.shippingMethod] ?? o.shippingMethod }}</dd>
                <dt class="muted">Mã vận đơn</dt><dd class="mono">{{ o.trackingCode || '—' }}</dd>
              </dl>
              @if (o.paymentMethod === 'COD') {
                <p class="muted small">Đơn COD tự động chuyển sang "Đã thanh toán" khi giao hàng thành công.</p>
              } @else if (o.status === 'CANCELLED') {
                <p class="muted small">Đơn đã hủy, không thể cập nhật thanh toán.</p>
              } @else {
                @if (o.paymentMethod === 'EWALLET' || o.paymentMethod === 'CARD') {
                  <p class="muted small">Chưa kết nối cổng thanh toán: nhân viên xử lý thủ công hình thức này, xác nhận khi đã nhận tiền.</p>
                }
                @if (o.paymentMethod === 'BANK_TRANSFER' && o.payment?.transferNote) {
                  <p class="muted small">Đối chiếu nội dung chuyển khoản: <span class="mono">{{ o.payment.transferNote }}</span></p>
                }
                <div class="row wrap actions">
                  @if (o.paymentStatus === 'PAID') {
                    <button type="button" class="btn secondary" [disabled]="busy()" (click)="setPaid(false)">Đánh dấu chưa thanh toán</button>
                  } @else {
                    <button type="button" class="btn" [disabled]="busy()" (click)="setPaid(true)">Xác nhận đã nhận tiền</button>
                  }
                </div>
              }
              @if (payErr()) {<p class="err small" role="alert">{{ payErr() }}</p>}
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <b>Cập nhật trạng thái</b>
            <ol class="steps">
              @for (s of steps(); track $index) {
                <li [class.reached]="s.reached" [class.cancel]="s.cancel">
                  <span class="mark" aria-hidden="true">{{ s.mark }}</span>
                  <div><div class="sname">{{ s.name }}</div><div class="muted small">{{ s.time }}</div></div>
                </li>
              }
            </ol>
            @if (next(); as n) {
              @if (n.to === 'SHIPPING' && o.paymentMethod === 'BANK_TRANSFER' && o.paymentStatus !== 'PAID') {
                <p class="warn small" role="alert">Cảnh báo: đơn chuyển khoản này chưa được xác nhận thanh toán. Hãy kiểm tra trước khi giao hàng.</p>
              }
              @if (n.to === 'SHIPPING') {
                <div class="field">
                  <label for="trk">Mã vận đơn (bắt buộc)</label>
                  <input id="trk" class="input mono" maxlength="64" [value]="tracking()" (input)="tracking.set($any($event.target).value)">
                </div>
              }
              <div class="row wrap actions">
                <button type="button" class="btn grow" [disabled]="busy() || (n.to === 'SHIPPING' && !tracking().trim())" (click)="change(n.to)">{{ n.label }}</button>
                <button type="button" class="btn danger" [disabled]="busy()" (click)="cancel()">Hủy đơn</button>
              </div>
            } @else {
              <div class="row wrap actions">
                <span class="muted grow">{{ o.status === 'DELIVERED' ? 'Đơn đã giao thành công.' : 'Đơn đã bị hủy.' }}</span>
              </div>
            }
            @if (actionErr()) {<p class="err small" role="alert">{{ actionErr() }}</p>}
          </div>

          <div class="card">
            <b>Ghi chú nội bộ</b>
            <p class="muted small">Chỉ nhân viên chi nhánh thấy.</p>
            @for (n of d.notes; track n.id) {
              <p class="note"><b>{{ n.authorName }}</b> · {{ time(n.createdAt) }} — {{ n.body }}</p>
            }
            <div class="row">
              <input class="input" #note maxlength="1000" placeholder="Thêm ghi chú…" aria-label="Ghi chú nội bộ" (keydown.enter)="addNote(note)">
              <button type="button" class="btn secondary sm" [disabled]="busy()" (click)="addNote(note)">Thêm</button>
            </div>
            @if (noteErr()) {<p class="err small" role="alert">{{ noteErr() }}</p>}
          </div>
        </div>
      </div>
    } @else {
      <div class="state-box" role="status">Đang tải đơn hàng…</div>
    }
  `,
  styles: `
    :host { display: block; }
    .eyebrow a { color: inherit; }
    .head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: 4px 0 24px; }
    .layout { display: grid; grid-template-columns: 1.6fr 1fr; gap: 20px; align-items: start; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .small { font-size: 12px; }
    .err { color: var(--danger); }
    .warn { color: #a15c00; background: #fff4dc; border-radius: 10px; padding: 10px 12px; margin: 8px 0 0; }
    .grow { flex: 1; min-width: 0; }
    .line { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border); }
    .thumb { width: 48px; height: 48px; border-radius: 10px; background: var(--tint); flex: none; }
    .sum { display: grid; grid-template-columns: 1fr auto; gap: 8px 16px; margin: 16px 0 0; }
    .sum dd, .kv dd { margin: 0; text-align: right; }
    .sum .ok { color: var(--primary); }
    .total { font-size: 18px; }
    .info { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
    .kv { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 10px 0 0; }
    .steps { list-style: none; margin: 16px 0; padding: 0; }
    .steps li { position: relative; display: flex; gap: 14px; padding-bottom: 20px; color: rgba(31, 42, 28, .45); }
    .steps li:last-child { padding-bottom: 0; }
    .steps li::before { content: ''; position: absolute; left: 10px; top: 22px; bottom: 0; width: 2px; background: var(--line); }
    .steps li:last-child::before { display: none; }
    .steps li.reached { color: var(--ink); }
    .steps li.reached:not(:last-child)::before { background: var(--primary); }
    .steps li.cancel { color: var(--danger); }
    .steps li.cancel::before { background: var(--line); }
    .mark { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--line); background: var(--surface); color: #fff; font-size: 12px; display: grid; place-items: center; flex: none; z-index: 1; }
    .reached .mark { background: var(--primary); border-color: var(--primary); }
    .cancel .mark { background: var(--danger); border-color: var(--danger); }
    .sname { font-weight: 600; }
    .actions { margin-top: 8px; }
    .note { margin: 8px 0 12px; padding: 12px; background: var(--surface-2); border-radius: 12px; font-size: 13px; }
    @media (max-width: 767px) {
      .layout, .two { grid-template-columns: 1fr; }
    }
  `
})
export class AdminOrderDetailPage {
  private readonly api = inject(Api);
  private readonly code = toSignal(inject(ActivatedRoute).paramMap.pipe(map(p => p.get('id') ?? '')), {initialValue: ''});

  readonly status = STATUS;
  readonly pay = PAY_LABEL;
  readonly ship = SHIP_LABEL;
  readonly money = vnd;
  readonly time = fmtDateTime;
  readonly msg = errMsg;

  readonly busy = signal(false);
  readonly actionErr = signal('');
  readonly noteErr = signal('');
  readonly payErr = signal('');
  readonly tracking = signal('');

  readonly res = resource({
    params: () => ({code: this.code()}),
    loader: ({params}) => this.api.get<Detail>(`/admin/orders/${encodeURIComponent(params.code)}`)
  });

  readonly detail = computed(() => (this.res.hasValue() ? this.res.value() : null));
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

  address(s: {line1: string; ward: string; district: string; city: string}): string {
    return [s.line1, s.ward, s.district, s.city].filter(Boolean).join(', ');
  }

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
