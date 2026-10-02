import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal} from '@angular/core';
import {FormField, FormRoot, disabled, form, maxLength, validate} from '@angular/forms/signals';
import {Router, RouterLink} from '@angular/router';
import {apiResource, resourceError, toApiError} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {Address, CheckoutApi, PAY_METHODS, SHIP_METHODS} from '../../core/checkout.api';
import {FREE_SHIP_THRESHOLD, PAY_OPTIONS, SHIP_OPTIONS} from '../../core/mock-data';
import {ImageSlot} from '../../shared/image-slot';

const PHONE_RE = /^(0|\+84)\d{9}$/;

@Component({
  selector: 'app-checkout-page',
  imports: [VndPipe, StateBox, RouterLink, FormField, FormRoot, ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.css'
})
export class CheckoutPage {
  readonly cart = inject(CartStore);
  readonly branch = inject(BranchStore);
  private readonly auth = inject(AuthStore);
  private readonly api = inject(CheckoutApi);
  private readonly router = inject(Router);
  readonly shipOptions = SHIP_OPTIONS;
  readonly payOptions = PAY_OPTIONS;
  readonly freeShipFrom = FREE_SHIP_THRESHOLD;

  // Saved addresses: only for a signed-in customer; the form below is shown instead when there are none.
  private readonly addressesRes = apiResource<Address[]>(() => (this.auth.isLoggedIn() ? {path: '/addresses'} : undefined), {defaultValue: []});
  readonly addresses = computed(() => (this.addressesRes.hasValue() ? this.addressesRes.value() : []));
  readonly loadingAddr = this.addressesRes.isLoading;
  readonly adding = signal(false);
  /** Defaults to the default (or first) address; keeps the user's pick while it still exists. */
  readonly addressId = linkedSignal<Address[], number | null>({
    source: this.addresses,
    computation: (list, prev) => (prev && list.some(a => a.id === prev.value) ? prev.value : ((list.find(a => a.isDefault) ?? list[0])?.id ?? null))
  });

  private readonly model = signal({
    name: this.auth.user()?.fullName ?? '',
    phone: '',
    address: '',
    ward: '',
    district: '',
    province: 'TP. Hồ Chí Minh',
    note: ''
  });
  readonly f = form(this.model, p => {
    maxLength(p.note, 500);
    validate(p.name, ({value}) => (value().trim() ? undefined : {kind: 'required', message: 'Vui lòng nhập họ tên.'}));
    validate(p.phone, ({value}) => (PHONE_RE.test(value().replace(/[\s.-]/g, '')) ? undefined : {kind: 'pattern', message: 'Số điện thoại chưa hợp lệ.'}));
    validate(p.address, ({value}) => (value().trim() ? undefined : {kind: 'required', message: 'Vui lòng nhập địa chỉ giao hàng.'}));
  });

  private readonly promoModel = signal({code: this.cart.promo()?.code ?? ''});
  readonly promoForm = form(this.promoModel, p => {
    maxLength(p.code, 40);
    disabled(p.code, {when: () => !!this.cart.promo()});
  });
  readonly promoBusy = signal(false);
  readonly promoMsg = signal('');

  readonly tried = signal(false);
  readonly placing = signal(false);
  private readonly placeError = signal('');
  /** Order failure, or the saved-address load failure. */
  readonly error = computed(() => this.placeError() || resourceError(this.addressesRes)?.message || '');
  readonly errorCode = signal('');

  /** Idempotency key for the current checkout attempt; reused on retry while the request body is unchanged. */
  private attempt: {fp: string; key: string} | null = null;

  readonly legacyLines = computed(() => this.cart.lines().filter(l => l.productId === undefined));

  /** The branch the cart's products belong to (falls back to the selected branch). */
  readonly branchId = computed(() => this.cart.branchId() ?? this.branch.branchId());

  readonly fulfilNote = computed(() => {
    const b = this.branch.branches[this.branchId() - 1];
    if (!b) return '';
    return this.cart.shipIndex() === 2 ? `Nhận tại ${b.name} · ${b.addr}` : `Đơn sẽ xuất từ chi nhánh ${b.name}`;
  });

  addrText(a: Address): string {
    return [a.line1, a.ward, a.district, a.city].filter(Boolean).join(', ');
  }

  async applyPromo(): Promise<void> {
    const code = this.promoModel().code.trim();
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
    this.promoForm.code().value.set('');
  }

  async place(): Promise<void> {
    this.tried.set(true);
    if (this.placing() || this.cart.lines().length === 0 || this.legacyLines().length > 0) return;
    const creating = this.adding() || this.addresses().length === 0;
    if (creating ? this.f().invalid() : this.addressId() === null) return;
    this.placing.set(true);
    this.placeError.set('');
    this.errorCode.set('');
    try {
      let addressId = this.addressId();
      if (creating) {
        const m = this.model();
        const created = await this.api.createAddress({
          label: 'Nhà',
          recipient: m.name.trim(),
          phone: m.phone.trim(),
          line1: m.address.trim(),
          ward: m.ward.trim(),
          district: m.district.trim(),
          city: m.province.trim(),
          makeDefault: this.addresses().length === 0
        });
        // Merge locally (not reload()): a retry after a failed order must already see the saved address.
        this.addressesRes.update(l => [...(l ?? []), created]);
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
        customerNote: this.model().note.trim() || undefined
      };
      const fp = JSON.stringify(body);
      if (this.attempt?.fp !== fp) this.attempt = {fp, key: crypto.randomUUID()};
      const order = await this.api.placeOrder(body, this.attempt.key);
      this.attempt = null;
      this.cart.clear();
      void this.router.navigate(['/orders', order.code]);
    } catch (e) {
      const err = toApiError(e);
      this.placeError.set(err.message);
      this.errorCode.set(err.code === 'UNKNOWN' ? '' : err.code);
    } finally {
      this.placing.set(false);
    }
  }
}
