import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {toApiError} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {CheckoutApi, Order, OrderStatus, PaymentMethod} from '../../core/checkout.api';
import {vnd} from '../../core/format';

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
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container wrap">
      @if (loading()) {
        <div class="state-box" role="status">Đang tải đơn hàng…</div>
      } @else if (error()) {
        <div class="state-box" role="alert">
          <div class="serif big">Không tải được đơn hàng.</div>
          <div>{{ error() }}</div>
          <a class="btn" routerLink="/account/orders">Xem đơn hàng của tôi</a>
        </div>
      } @else if (order(); as o) {
        <div class="head">
          <div class="check" aria-hidden="true">{{ o.status === 'CANCELLED' ? '✕' : '✓' }}</div>
          <div>
            <h1>{{ o.status === 'CANCELLED' ? 'Đơn hàng đã hủy' : 'Đặt hàng thành công!' }}</h1>
            <div class="muted lead">Cảm ơn {{ customer() }}. Chúng tôi sẽ cập nhật trạng thái đơn của bạn tại đây.</div>
          </div>
        </div>

        <div class="info">
          <div><div class="k">Mã đơn hàng</div><div class="mono code">{{ o.code }}</div></div>
          <div><div class="k">Tổng tiền</div><div class="total">{{ vnd(o.total) }}</div></div>
          <div><div class="k">Thanh toán</div><div class="v">{{ payName() }}</div><div class="pstat" [class.paid]="o.paymentStatus === 'PAID'">{{ o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán' }}</div></div>
          <div><div class="k">Giao hàng</div><div class="v">{{ shipName() }}</div></div>
          <div class="from">
            <span class="muted">Xuất từ: </span><b>{{ o.branchName }}</b>
            <span class="muted">  ·  Giao đến: </span>{{ address() }}
          </div>
        </div>

        @if (o.status !== 'CANCELLED' && o.paymentMethod !== 'COD' && o.paymentStatus !== 'PAID') {
          <div class="pay-card">
            @if (o.paymentMethod === 'BANK_TRANSFER') {
              @if (o.payment?.qrUrl; as qr) {
                <b>Chuyển khoản qua mã VietQR</b>
                <div class="qr-row">
                  <img class="qr" [src]="qr" width="240" height="240" alt="Mã VietQR thanh toán đơn hàng">
                  <dl class="bank">
                    <dt class="muted">Ngân hàng</dt><dd>{{ o.payment.bankName }}</dd>
                    <dt class="muted">Số tài khoản</dt><dd class="mono">{{ o.payment.accountNo }}</dd>
                    <dt class="muted">Chủ tài khoản</dt><dd>{{ o.payment.accountName }}</dd>
                    <dt class="muted">Số tiền</dt><dd><b>{{ vnd(o.total) }}</b></dd>
                    <dt class="muted">Nội dung</dt>
                    <dd><span class="mono">{{ o.payment.transferNote }}</span>
                      <button type="button" class="btn secondary sm" (click)="copy(o.payment.transferNote)">{{ copied() ? 'Đã sao chép' : 'Sao chép' }}</button></dd>
                  </dl>
                </div>
                <p class="muted sm">Vui lòng giữ nguyên nội dung chuyển khoản để chúng tôi xác nhận nhanh. Đơn được xử lý sau khi nhân viên nhận được tiền.</p>
              } @else {
                <b>Chuyển khoản theo hướng dẫn</b>
                <p class="muted">Cửa hàng sẽ liên hệ để gửi thông tin tài khoản chuyển khoản cho đơn <span class="mono">{{ o.code }}</span>. Vui lòng ghi mã đơn trong nội dung chuyển khoản.</p>
              }
            } @else {
              <b>Thanh toán online</b>
              <p class="muted">Hình thức thanh toán trực tuyến này hiện được nhân viên xử lý thủ công, chưa kết nối cổng thanh toán. Cửa hàng sẽ liên hệ để hướng dẫn và xác nhận thanh toán cho đơn <span class="mono">{{ o.code }}</span>.</p>
            }
          </div>
        }

        <div class="lines-card">
          @for (l of o.items; track l.productId) {
            <div class="ln"><span>{{ l.name }} <span class="muted">× {{ l.quantity }}</span></span><b>{{ vnd(l.lineTotal) }}</b></div>
          }
          <div class="ln sub"><span class="muted">Tạm tính</span><span>{{ vnd(o.subtotal) }}</span></div>
          <div class="ln sub"><span class="muted">Phí giao hàng</span><span>{{ vnd(o.shippingFee) }}</span></div>
          @if (o.discount > 0) {
            <div class="ln sub"><span class="muted">Giảm giá{{ o.promoCode ? ' (' + o.promoCode + ')' : '' }}</span><span>−{{ vnd(o.discount) }}</span></div>
          }
          @if (o.tierDiscount > 0) {
            <div class="ln sub"><span class="muted">Ưu đãi hạng thành viên</span><span>−{{ vnd(o.tierDiscount) }}</span></div>
          }
          @if (o.pointsDiscount > 0) {
            <div class="ln sub"><span class="muted">Dùng điểm</span><span>−{{ vnd(o.pointsDiscount) }}</span></div>
          }
          <div class="ln sub"><b>Tổng cộng</b><b class="total">{{ vnd(o.total) }}</b></div>
        </div>

        @if (o.status !== 'CANCELLED') {
          <div class="timeline-card">
            <div class="tl-head"><b>Trạng thái đơn hàng</b><span class="muted sm">Đặt lúc {{ placedAt() }}</span></div>
            <ol class="tl">
              @for (t of steps; track t.status; let i = $index) {
                <li [class.done]="i < stage()" [class.cur]="i === stage()" [attr.aria-current]="i === stage() ? 'step' : null">
                  <div class="tl-top">
                    <span class="dotm">{{ i < stage() ? '✓' : '' }}</span>
                    <span class="seg"></span>
                  </div>
                  <div class="tl-name">{{ t.name }}</div>
                  <div class="muted sm">{{ timeOf(t.status) }}</div>
                </li>
              }
            </ol>
            @if (o.trackingCode) {
              <div class="muted sm track">Mã vận đơn: <span class="mono">{{ o.trackingCode }}</span></div>
            }
          </div>
        }

        <div class="row wrap actions">
          <a class="btn lg" routerLink="/account/orders">Xem đơn hàng</a>
          <a class="btn lg outline" routerLink="/products">Tiếp tục mua sắm</a>
        </div>
      }
    </div>
  `,
  styles: `
    .wrap { max-width: 1000px; padding-top: 48px; padding-bottom: 72px; }
    .head { display: flex; gap: 28px; align-items: center; margin-bottom: 40px; }
    .check { width: 84px; height: 84px; border-radius: 50%; background: var(--primary); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 40px; flex: none; }
    h1 { font-family: var(--serif); font-weight: 400; font-size: 52px; letter-spacing: -.02em; margin-bottom: 6px; line-height: 1.1; }
    .lead { font-size: 16px; }
    .sm { font-size: 13px; }
    .info { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 24px 28px; gap: 20px; margin-bottom: 28px; font-size: 14px; }
    .k { color: var(--muted); margin-bottom: 6px; }
    .code { font-weight: 600; font-size: 16px; }
    .total { font-weight: 700; font-size: 16px; color: var(--primary); }
    .v { font-weight: 600; font-size: 16px; }
    .from { grid-column: 1 / -1; border-top: 1px solid rgba(31, 42, 28, .1); padding-top: 16px; }
    .timeline-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px; }
    .tl-head { display: flex; justify-content: space-between; margin-bottom: 28px; font-size: 18px; gap: 8px; }
    .tl { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .tl li { display: flex; flex-direction: column; gap: 12px; }
    .tl-top { display: flex; align-items: center; }
    .dotm { width: 28px; height: 28px; border-radius: 50%; flex: none; background: var(--surface); border: 2px solid rgba(31, 42, 28, .25); color: #fff; font-size: 14px; display: flex; align-items: center; justify-content: center; }
    .seg { flex: 1; height: 3px; background: rgba(31, 42, 28, .14); }
    .tl li:last-child .seg { background: transparent; }
    .tl li.done .dotm { background: var(--primary); border-color: var(--primary); }
    .tl li.done .seg { background: var(--primary); }
    .tl li.cur .dotm { background: var(--accent); border-color: var(--primary); }
    .tl-name { font-weight: 600; font-size: 15px; color: rgba(31, 42, 28, .45); }
    .tl li.done .tl-name, .tl li.cur .tl-name { color: var(--ink); }
    .actions { margin-top: 32px; }
    .btn.lg { padding: 16px 28px; }
    .btn.outline { background: transparent; color: var(--primary); border: 1.5px solid var(--primary); }
    @media (max-width: 767px) {
      .wrap { padding-top: 24px; padding-bottom: 32px; }
      .head { gap: 16px; margin-bottom: 24px; }
      .check { width: 56px; height: 56px; font-size: 26px; }
      h1 { font-size: 32px; }
      .info { grid-template-columns: 1fr 1fr; padding: 18px; }
      .timeline-card { padding: 18px; }
      .tl { grid-template-columns: 1fr; gap: 0; }
      .tl li { flex-direction: row; align-items: center; gap: 12px; padding: 8px 0; }
      .tl-top { flex-direction: column; align-self: stretch; }
      .seg { display: none; }
      .tl-head { flex-direction: column; }
    }
    .lines-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 20px 28px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 10px; font-size: 15px; }
    .ln { display: flex; justify-content: space-between; gap: 12px; }
    .ln.sub { font-size: 14px; }
    .track { margin-top: 20px; }
    .pstat { font-size: 13px; margin-top: 4px; color: #a15c00; font-weight: 600; }
    .pstat.paid { color: var(--primary); }
    .pay-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 24px 28px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 12px; }
    .qr-row { display: flex; gap: 28px; align-items: center; flex-wrap: wrap; }
    .qr { width: 240px; height: 240px; border-radius: 12px; background: #fff; border: 1px solid var(--border); }
    .bank { display: grid; grid-template-columns: auto 1fr; gap: 10px 20px; margin: 0; font-size: 15px; }
    .bank dd { margin: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  `
})
export class OrderSuccessPage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthStore);
  private readonly api = inject(CheckoutApi);
  readonly vnd = vnd;
  readonly steps = STEPS;

  readonly code = toSignal(this.route.paramMap.pipe(map(p => p.get('code') ?? '')), {initialValue: ''});
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly customer = computed(() => this.auth.user()?.name ?? 'bạn');
  readonly stage = computed(() => Math.max(0, STEPS.findIndex(s => s.status === this.order()?.status)));
  readonly payName = computed(() => PAY_NAME[this.order()?.paymentMethod ?? 'COD']);
  readonly shipName = computed(() => SHIP_NAME[this.order()?.shippingMethod ?? 'STANDARD']);
  readonly placedAt = computed(() => (this.order() ? fmt(this.order()!.createdAt) : ''));
  readonly address = computed(() => {
    const s = this.order()?.shipping;
    return s ? [s.line1, s.ward, s.district, s.city].filter(Boolean).join(', ') : '';
  });

  readonly copied = signal(false);
  private seq = 0;

  constructor() {
    effect(() => {
      const code = this.code();
      untracked(() => void this.load(code));
    });
  }

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

  /** Time the order reached a step, from the status history. */
  timeOf(status: OrderStatus): string {
    const h = this.order()?.history.find(x => x.to === status);
    if (h) return fmt(h.at);
    return status === this.order()?.status ? 'Đang xử lý' : '';
  }

  private async load(code: string): Promise<void> {
    const my = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const o = await this.api.order(code);
      if (my === this.seq) this.order.set(o);
    } catch (e) {
      if (my === this.seq) this.error.set(toApiError(e).message);
    } finally {
      if (my === this.seq) this.loading.set(false);
    }
  }
}
