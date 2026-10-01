import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {toApiError} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {Address, CheckoutApi, PAY_METHODS, SHIP_METHODS} from '../../core/checkout.api';
import {vnd} from '../../core/format';
import {FREE_SHIP_THRESHOLD, PAY_OPTIONS, SHIP_OPTIONS} from '../../core/mock-data';
import {ImageSlot} from '../../shared/image-slot';

@Component({
  selector: 'app-checkout-page',
  imports: [RouterLink, FormsModule, ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <ol class="steps" aria-label="Các bước đặt hàng">
        <li class="done">✓ Giỏ hàng</li><li class="line"></li>
        <li class="cur" aria-current="step">2 Thanh toán</li><li class="line"></li>
        <li class="todo">3 Hoàn tất</li>
      </ol>

      @if (cart.lines().length === 0) {
        <div class="state-box empty">
          <div class="serif big">Giỏ hàng của bạn đang trống.</div>
          <div>Thêm sản phẩm trước khi thanh toán.</div>
          <a class="btn" routerLink="/products">Khám phá sản phẩm</a>
        </div>
      } @else {
        <form class="layout" novalidate (ngSubmit)="place()">
          <div class="left">
            @if (legacyLines().length) {
              <div class="alert" role="alert">
                Một số sản phẩm trong giỏ không còn liên kết với danh mục hiện tại, vui lòng xóa và thêm lại từ trang sản phẩm:
                @for (l of legacyLines(); track l.id) {
                  <button type="button" class="chip-x" (click)="cart.remove(l.id)">{{ l.name }} ✕</button>
                }
              </div>
            }
            @if (error()) {
              <div class="alert" role="alert"><b>{{ error() }}</b>@if (errorCode()) { <span class="mono sm"> ({{ errorCode() }})</span> }</div>
            }

            <section>
              <h2>Thông tin giao hàng</h2>
              @if (loadingAddr()) {
                <div class="muted" role="status">Đang tải địa chỉ…</div>
              } @else {
                @if (addresses().length && !adding()) {
                  <div class="pay" role="radiogroup" aria-label="Địa chỉ giao hàng">
                    @for (a of addresses(); track a.id) {
                      <button type="button" role="radio" class="choice" [class.on]="addressId() === a.id" [attr.aria-checked]="addressId() === a.id" (click)="addressId.set(a.id)">
                        <span class="dot"></span>
                        <span class="grow"><b>{{ a.label }} · {{ a.recipient }}</b> <span class="muted">{{ a.phone }}</span><br><span class="muted sm">{{ addrText(a) }}</span></span>
                      </button>
                    }
                  </div>
                  <button type="button" class="change add" (click)="adding.set(true)">+ Thêm địa chỉ mới</button>
                } @else {
                  <div class="form">
                    <div class="field">
                      <label for="co-name">Họ tên người nhận</label>
                      <input id="co-name" class="input" name="name" [(ngModel)]="name" [class.err]="tried() && !name().trim()" autocomplete="name">
                      @if (tried() && !name().trim()) {
                        <span class="err-t">Vui lòng nhập họ tên.</span>
                      }
                    </div>
                    <div class="field">
                      <label for="co-phone">Số điện thoại</label>
                      <input id="co-phone" class="input" name="phone" inputmode="tel" [(ngModel)]="phone" [class.err]="tried() && !phoneOk()" autocomplete="tel">
                      @if (tried() && !phoneOk()) {
                        <span class="err-t">Số điện thoại chưa hợp lệ.</span>
                      }
                    </div>
                    <div class="field span2">
                      <label for="co-addr">Địa chỉ</label>
                      <input id="co-addr" class="input" name="address" [(ngModel)]="address" [class.err]="tried() && !address().trim()" autocomplete="street-address">
                      @if (tried() && !address().trim()) {
                        <span class="err-t">Vui lòng nhập địa chỉ giao hàng.</span>
                      }
                    </div>
                    <div class="span2 three">
                      <div class="field">
                        <label for="co-ward">Phường/xã</label>
                        <input id="co-ward" class="input" name="ward" [(ngModel)]="ward">
                      </div>
                      <div class="field">
                        <label for="co-dist">Quận/huyện</label>
                        <input id="co-dist" class="input" name="district" [(ngModel)]="district">
                      </div>
                      <div class="field">
                        <label for="co-prov">Tỉnh/thành</label>
                        <input id="co-prov" class="input" name="province" [(ngModel)]="province">
                      </div>
                    </div>
                  </div>
                  @if (addresses().length) {
                    <button type="button" class="change add" (click)="adding.set(false)">← Dùng địa chỉ đã lưu</button>
                  }
                }
                <div class="field note-f">
                  <label for="co-note">Ghi chú đơn hàng</label>
                  <textarea id="co-note" class="input" name="note" rows="3" maxlength="500" placeholder="Ví dụ: gọi trước khi giao" [(ngModel)]="note"></textarea>
                </div>
              }
            </section>

            <section>
              <h2>Giao hàng</h2>
              <div class="ship-grid" role="radiogroup" aria-label="Phương thức giao hàng">
                @for (o of shipOptions; track o.name; let i = $index) {
                  <button type="button" role="radio" class="choice ship" [class.on]="cart.shipIndex() === i" [attr.aria-checked]="cart.shipIndex() === i" (click)="pickShip(i)">
                    <span class="dot"></span>
                    <span class="grow">
                      <b>{{ o.name }}</b>
                      <span class="muted eta">{{ o.eta }}</span>
                      <b class="fee">{{ vnd(i === 0 && cart.subtotal() >= freeShipFrom ? 0 : o.fee) }}</b>
                    </span>
                  </button>
                }
              </div>
              <div class="note">
                <span class="grow">{{ fulfilNote() }}</span>
              </div>
            </section>

            <section>
              <h2>Thanh toán</h2>
              <div class="pay" role="radiogroup" aria-label="Phương thức thanh toán">
                @for (o of payOptions; track o.name; let i = $index) {
                  <button type="button" role="radio" class="choice" [class.on]="cart.payIndex() === i" [attr.aria-checked]="cart.payIndex() === i" (click)="cart.payIndex.set(i)">
                    <span class="dot"></span><b class="grow">{{ o.name }}</b><span class="muted">{{ o.note }}</span>
                  </button>
                }
              </div>
            </section>
          </div>

          <aside class="summary">
            <div class="s-title">Đơn hàng ({{ cart.count() }} sản phẩm)</div>
            <div class="items">
              @for (l of cart.lines(); track l.id) {
                <div class="item">
                  <div class="it-img"><app-image-slot caption="Ảnh" [radius]="12" ratio="1 / 1" /><span class="qb">{{ l.qty }}</span></div>
                  <div class="grow"><div class="it-name">{{ l.name }}</div><div class="muted sm">{{ vnd(l.unitPrice) }}{{ l.unit ? ' / ' + l.unit : '' }}</div></div>
                  <b>{{ vnd(l.unitPrice * l.qty) }}</b>
                </div>
              }
            </div>
            <div class="promo">
              <input class="code mono" name="promo" aria-label="Mã giảm giá" placeholder="Mã giảm giá" maxlength="40" [(ngModel)]="promoInput" [disabled]="!!cart.promo()" (input)="promoMsg.set('')">
              @if (cart.promo()) {
                <button type="button" class="applied" (click)="removePromo()">Bỏ mã</button>
              } @else {
                <button type="button" class="applied off" [disabled]="promoBusy() || !promoInput().trim()" (click)="applyPromo()">{{ promoBusy() ? '…' : 'Áp dụng' }}</button>
              }
            </div>
            @if (promoMsg()) {
              <div class="err-t promo-msg" role="alert">{{ promoMsg() }}</div>
            }
            <div class="rows">
              <span class="muted">Tạm tính</span><span>{{ vnd(cart.subtotal()) }}</span>
              <span class="muted">Phí giao hàng</span><span>{{ vnd(cart.shipFee()) }}</span>
              @if (cart.discount() > 0) {
                <span class="muted">Giảm giá ({{ cart.promo()?.code }})</span><span class="green">−{{ vnd(cart.discount()) }}</span>
              }
            </div>
            <div class="total"><b>Tạm tính tổng</b><b class="amt">{{ vnd(cart.total()) }}</b></div>
            <div class="muted sm center total-note">Tổng cuối cùng do hệ thống tính khi đặt hàng (có thể có ưu đãi hạng thành viên).</div>
            <button type="submit" class="btn block place" [disabled]="placing() || legacyLines().length > 0">{{ placing() ? 'Đang đặt hàng…' : 'Đặt hàng' }}</button>
            <div class="muted sm center">Đổi trả trong 24 giờ nếu trứng vỡ hoặc hàng không tươi</div>
          </aside>
        </form>
      }
    </div>
  `,
  styles: `
    h2 { font-family: var(--serif); font-weight: 400; font-size: 34px; margin-bottom: 20px; }
    .sm { font-size: 13px; }
    .center { text-align: center; margin-top: 14px; }
    .grow { flex: 1; min-width: 0; }
    .steps { list-style: none; margin: 0; padding: 22px 0 0; display: flex; gap: 14px; align-items: center; font-size: 14px; font-weight: 500; }
    .steps .done { color: var(--primary); }
    .steps .cur { font-weight: 700; }
    .steps .todo { color: rgba(31, 42, 28, .45); }
    .steps .line { width: 40px; height: 1px; background: rgba(31, 42, 28, .25); }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 460px; gap: 56px; padding: 32px 0 72px; }
    .left { display: flex; flex-direction: column; gap: 40px; }
    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .span2 { grid-column: span 2; }
    .three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .input { font-size: 16px; padding: 15px 16px; }
    textarea.input { resize: vertical; }
    .err-t { font-size: 13px; color: var(--danger); }
    .ship-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .choice.ship { align-items: flex-start; padding: 18px 20px; border-radius: 16px; }
    .choice.ship .grow { display: flex; flex-direction: column; gap: 4px; }
    .eta { font-size: 14px; margin-bottom: 4px; }
    .fee { color: var(--primary); }
    .note { display: flex; align-items: center; gap: 12px; margin-top: 14px; background: var(--tint); color: var(--primary); border-radius: 14px; padding: 14px 18px; font-size: 14px; }
    .change { background: none; border: 0; font-weight: 700; color: var(--primary); white-space: nowrap; text-decoration: underline; }
    .branch-pick { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
    .choice:disabled { opacity: .5; cursor: not-allowed; }
    .pay { display: flex; flex-direction: column; gap: 10px; }
    .pay .choice { padding: 16px 20px; }
    .summary { align-self: start; background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 28px; }
    .s-title { font-weight: 600; font-size: 18px; margin-bottom: 20px; }
    .items { display: flex; flex-direction: column; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid rgba(31, 42, 28, .1); }
    .item { display: flex; gap: 14px; align-items: center; }
    .it-img { position: relative; width: 64px; flex: none; }
    .qb { position: absolute; top: -6px; right: -6px; background: var(--ink); color: #fff; font-size: 11px; font-weight: 700; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .it-name { font-weight: 600; font-size: 15px; }
    .promo { display: flex; gap: 8px; padding: 20px 0; border-bottom: 1px solid rgba(31, 42, 28, .1); }
    .code { flex: 1; border: 1px dashed rgba(139, 94, 60, .6); border-radius: 12px; padding: 13px 14px; font-size: 14px; }
    .applied { background: var(--tint); color: var(--primary); border: 0; border-radius: 12px; padding: 13px 18px; font-weight: 600; font-size: 14px; }
    .applied.off { background: var(--surface-2); color: var(--ink); }
    .rows { display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 20px 0; font-size: 15px; border-bottom: 1px solid rgba(31, 42, 28, .1); }
    .green { color: var(--primary); }
    .total { display: flex; justify-content: space-between; align-items: baseline; padding: 20px 0 24px; }
    .amt { font-size: 30px; color: var(--primary); }
    .place { height: 58px; font-size: 17px; }
    .empty { margin: 32px 0 72px; }
    .big { font-size: 24px; color: var(--ink); }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; gap: 32px; } }
    @media (max-width: 767px) {
      h2 { font-size: 26px; margin-bottom: 14px; }
      .steps { font-size: 13px; gap: 8px; }
      .steps .line { width: 16px; }
      .layout { padding: 20px 0 32px; }
      .left { gap: 28px; }
      .form, .three, .ship-grid { grid-template-columns: 1fr; }
      .span2 { grid-column: auto; }
      .summary { padding: 20px; border-radius: 20px; }
    }
    .alert { background: #fdecea; color: var(--danger); border-radius: 14px; padding: 14px 18px; font-size: 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .chip-x { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; font-size: 13px; }
    .add { margin-top: 12px; }
    .note-f { margin-top: 16px; }
    .promo-msg { margin: -12px 0 12px; }
    .total-note { margin: -12px 0 16px; }
    input.code { background: transparent; }
  `
})
export class CheckoutPage {
  readonly cart = inject(CartStore);
  readonly branch = inject(BranchStore);
  private readonly auth = inject(AuthStore);
  private readonly api = inject(CheckoutApi);
  private readonly router = inject(Router);
  readonly vnd = vnd;
  readonly shipOptions = SHIP_OPTIONS;
  readonly payOptions = PAY_OPTIONS;
  readonly freeShipFrom = FREE_SHIP_THRESHOLD;

  readonly addresses = signal<Address[]>([]);
  readonly loadingAddr = signal(true);
  readonly adding = signal(false);
  readonly addressId = signal<number | null>(null);

  readonly name = signal(this.auth.user()?.fullName ?? '');
  readonly phone = signal('');
  readonly address = signal('');
  readonly ward = signal('');
  readonly district = signal('');
  readonly province = signal('TP. Hồ Chí Minh');
  readonly note = signal('');

  readonly promoInput = signal(this.cart.promo()?.code ?? '');
  readonly promoBusy = signal(false);
  readonly promoMsg = signal('');

  readonly tried = signal(false);
  readonly placing = signal(false);
  readonly error = signal('');
  readonly errorCode = signal('');

  /** Idempotency key for the current checkout attempt; reused on retry while the request body is unchanged. */
  private attempt: {fp: string; key: string} | null = null;

  readonly legacyLines = computed(() => this.cart.lines().filter(l => l.productId === undefined));
  readonly phoneOk = computed(() => /^(0|\+84)\d{9}$/.test(this.phone().replace(/[\s.-]/g, '')));
  private readonly newAddressOk = computed(() => !!this.name().trim() && this.phoneOk() && !!this.address().trim());

  /** The branch the cart's products belong to (falls back to the selected branch). */
  readonly branchId = computed(() => this.cart.branchId() ?? this.branch.branchId());

  readonly fulfilNote = computed(() => {
    const b = this.branch.branches[this.branchId() - 1];
    if (!b) return '';
    return this.cart.shipIndex() === 2 ? `Nhận tại ${b.name} · ${b.addr}` : `Đơn sẽ xuất từ chi nhánh ${b.name}`;
  });

  constructor() {
    void this.loadAddresses();
  }

  addrText(a: Address): string {
    return [a.line1, a.ward, a.district, a.city].filter(Boolean).join(', ');
  }

  private async loadAddresses(): Promise<void> {
    try {
      const list = await this.api.addresses();
      this.addresses.set(list);
      this.addressId.set((list.find(a => a.isDefault) ?? list[0])?.id ?? null);
    } catch (e) {
      this.error.set(toApiError(e).message);
    } finally {
      this.loadingAddr.set(false);
    }
  }

  async applyPromo(): Promise<void> {
    const code = this.promoInput().trim();
    if (!code || this.promoBusy()) return;
    this.promoBusy.set(true);
    this.promoMsg.set('');
    try {
      const subtotal = this.cart.subtotal();
      const r = await this.api.validatePromo(code, this.branchId(), subtotal, this.cart.baseShipFee());
      this.cart.promo.set({code: r.code, discount: r.discount, shippingDiscount: r.shippingDiscount, subtotal});
    } catch (e) {
      this.promoMsg.set(toApiError(e).message);
    } finally {
      this.promoBusy.set(false);
    }
  }

  /** Shipping changes invalidate a promo evaluated against the old fee. */
  pickShip(i: number): void {
    if (i !== this.cart.shipIndex()) this.removePromo();
    this.cart.shipIndex.set(i);
  }

  removePromo(): void {
    this.cart.promo.set(null);
    this.promoInput.set('');
  }

  async place(): Promise<void> {
    this.tried.set(true);
    if (this.placing() || this.cart.lines().length === 0 || this.legacyLines().length > 0) return;
    const creating = this.adding() || this.addresses().length === 0;
    if (creating ? !this.newAddressOk() : this.addressId() === null) return;
    this.placing.set(true);
    this.error.set('');
    this.errorCode.set('');
    try {
      let addressId = this.addressId();
      if (creating) {
        const created = await this.api.createAddress({
          label: 'Nhà',
          recipient: this.name().trim(),
          phone: this.phone().trim(),
          line1: this.address().trim(),
          ward: this.ward().trim(),
          district: this.district().trim(),
          city: this.province().trim(),
          makeDefault: this.addresses().length === 0
        });
        this.addresses.update(l => [...l, created]);
        this.addressId.set(created.id);
        this.adding.set(false);
        addressId = created.id;
      }
      const body = {
        addressId: addressId!,
        branchId: this.branchId(),
        items: this.cart.lines().map(l => ({productId: l.productId!, quantity: l.qty})),
        shippingMethod: SHIP_METHODS[this.cart.shipIndex()],
        paymentMethod: PAY_METHODS[this.cart.payIndex()],
        promoCode: this.cart.promo()?.code,
        customerNote: this.note().trim() || undefined
      };
      const fp = JSON.stringify(body);
      if (this.attempt?.fp !== fp) this.attempt = {fp, key: crypto.randomUUID()};
      const order = await this.api.placeOrder(body, this.attempt.key);
      this.attempt = null;
      this.cart.clear();
      void this.router.navigate(['/orders', order.code]);
    } catch (e) {
      const err = toApiError(e);
      this.error.set(err.message);
      this.errorCode.set(err.code === 'UNKNOWN' ? '' : err.code);
    } finally {
      this.placing.set(false);
    }
  }
}
