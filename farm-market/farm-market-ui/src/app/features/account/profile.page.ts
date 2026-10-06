import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Api, apiResource, toApiError} from '../../core/api';
import {AuthStore, Gender} from '../../core/auth.store';
import {num} from '../../core/format';
import {BranchStore} from '../../core/branch.store';
import {ImageSlot} from '../../shared/image-slot';
import {StateBox} from '../../shared/state-box';
import {AddressDto, LoyaltySummary, OrderSummary, Page, VoucherDto, resErr, valueOr} from './account.data';

@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, ImageSlot, StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.css'
})
export class ProfilePage {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(Api);
  protected readonly branch = inject(BranchStore);
  protected readonly pwOpen = signal(false);
  protected readonly curPw = signal('');
  protected readonly newPw = signal('');
  protected readonly newPw2 = signal('');
  protected readonly pwBusy = signal(false);
  protected readonly pwError = signal('');
  protected readonly pwDone = signal(false);
  protected readonly num = num;
  protected readonly editing = signal(false);
  protected readonly genderKeys: Gender[] = ['MALE', 'FEMALE', 'OTHER'];
  protected readonly fullName = signal('');
  protected readonly phone = signal('');
  protected readonly birthDate = signal('');
  protected readonly gender = signal<Gender | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal('');
  private readonly fieldErrors = signal<Record<string, string>>({});
  protected fe = (k: string): string => this.fieldErrors()[k] ?? '';
  /** Local-only toggles: there is no notification-preferences endpoint. */
  protected readonly nf = signal([true, true, false]);
  protected readonly genders = ['Nam', 'Nữ', 'Khác'];
  protected readonly notifNames = ['Thông báo trạng thái đơn hàng', 'Ưu đãi & hàng mới về', 'Bản tin qua email'];
  private readonly sumRes = apiResource<LoyaltySummary>(() => ({path: '/loyalty/summary'}));
  private readonly addrRes = apiResource<AddressDto[]>(() => ({path: '/addresses'}));
  private readonly ordersRes = apiResource<Page<OrderSummary>>(() => ({path: '/orders', params: {size: 1}}));
  private readonly vouchersRes = apiResource<VoucherDto[]>(() => ({path: '/loyalty/vouchers'}));
  protected readonly sum = computed(() => valueOr(this.sumRes, null));
  protected readonly addrs = computed(() => valueOr(this.addrRes, []).slice(0, 2));
  protected readonly orderCount = computed(() => valueOr(this.ordersRes, null)?.meta.totalElements ?? null);
  protected readonly vouchers = computed(() => valueOr(this.vouchersRes, null));
  protected readonly error = computed(() => resErr(this.auth.profile) || resErr(this.sumRes) || resErr(this.addrRes) || resErr(this.ordersRes) || resErr(this.vouchersRes));

  protected readonly addrRows = computed(() => this.addrs().map(a => ({a, line: [a.line1, a.ward, a.district, a.city].filter(Boolean).join(', ')})));
  protected readonly pct = computed(() => {
    const s = this.sum();
    return s?.nextTier ? Math.min(100, Math.round((s.yearPoints / s.nextTier.minPoints) * 100)) : 100;
  });
  protected readonly stats = computed(() => {
    const v = this.vouchers()?.filter(x => x.status === 'AVAILABLE');
    return [
      {l: 'Tổng đơn hàng', v: this.orderCount() === null ? '…' : String(this.orderCount()), s: 'Tất cả thời gian'},
      {l: 'Mã giảm giá', v: v ? String(v.length) : '…', s: 'Đang dùng được'},
      {l: 'Điểm trong năm', v: this.sum() ? num(this.sum()!.yearPoints) : '…', s: 'Tính hạng thành viên'}
    ];
  });

  constructor() {
    // keep the form in sync with the user's profile fields unless the user is editing
    effect(() => {
      this.auth.user();
      untracked(() => {
        if (!this.editing()) this.fill();
      });
    });
  }

  private fill(): void {
    const u = this.auth.user();
    this.fullName.set(u?.fullName ?? '');
    this.phone.set(u?.phone ?? '');
    this.birthDate.set(u?.birthDate ?? '');
    this.gender.set(u?.gender ?? null);
  }

  protected startEdit(): void {
    this.fill();
    this.fieldErrors.set({});
    this.saveError.set('');
    this.saved.set(false);
    this.editing.set(true);
  }

  protected cancel(): void {
    this.fill();
    this.fieldErrors.set({});
    this.saveError.set('');
    this.editing.set(false);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.fieldErrors.set({});
    try {
      await this.auth.saveProfile({
        fullName: this.fullName().trim(), phone: this.phone().trim() || null,
        birthDate: this.birthDate() || null, gender: this.gender()
      });
      this.saved.set(true);
      this.editing.set(false);
    } catch (e) {
      const err = toApiError(e);
      this.fieldErrors.set(err.fieldErrors ?? {});
      this.saveError.set(Object.keys(err.fieldErrors ?? {}).length ? '' : (err.message ?? 'Không lưu được thay đổi.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected flip(i: number): void {
    this.nf.update(a => a.map((v, j) => (j === i ? !v : v)));
  }

  protected togglePw(): void {
    this.pwOpen.update(v => !v);
    if (!this.pwOpen()) {
      this.curPw.set('');
      this.newPw.set('');
      this.newPw2.set('');
    }
    this.pwError.set('');
    this.pwDone.set(false);
  }

  protected async changePassword(): Promise<void> {
    if (this.pwBusy()) return;
    this.pwDone.set(false);
    if (!this.curPw()) return this.pwError.set('Vui lòng nhập mật khẩu hiện tại.');
    if (this.newPw().length < 8 || this.newPw().length > 72) return this.pwError.set('Mật khẩu mới từ 8 đến 72 ký tự.');
    if (this.newPw() !== this.newPw2()) return this.pwError.set('Mật khẩu nhập lại chưa khớp.');
    this.pwBusy.set(true);
    this.pwError.set('');
    try {
      await this.api.post('/auth/password/change', {currentPassword: this.curPw(), newPassword: this.newPw()});
      this.curPw.set('');
      this.newPw.set('');
      this.newPw2.set('');
      this.pwDone.set(true);
      this.pwOpen.set(false);
    } catch (e) {
      const err = toApiError(e);
      this.pwError.set(Object.values(err.fieldErrors)[0] ?? err.message);
    } finally {
      this.pwBusy.set(false);
    }
  }
}
