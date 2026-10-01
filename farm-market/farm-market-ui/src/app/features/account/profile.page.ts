import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Api} from '../../core/api';
import {ApiError} from '../../core/api';
import {AuthStore, Gender} from '../../core/auth.store';
import {num} from '../../core/format';
import {BranchStore} from '../../core/branch.store';
import {ImageSlot} from '../../shared/image-slot';
import {AddressDto, LoyaltySummary, OrderSummary, Page, VoucherDto, errMsg} from './account.data';

@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="page-title">Xin chào, {{ auth.user()?.name }}</h1>
    @if (error()) { <div class="state-box" role="alert"><b>Không tải được dữ liệu</b>{{ error() }}</div> }

    <section class="stats">
      <div class="hero">
        <div class="row"><span>Điểm tích lũy</span><span class="spacer"></span>@if (sum(); as s) {<span class="pill accent">Hạng {{ s.tier.label }}</span>}</div>
        <div class="big serif">{{ sum() ? num(sum()!.balance) : '…' }} <small>điểm</small></div>
        <div class="bar"><div class="fill" [style.width.%]="pct()"></div></div>
        <div class="sub">
          @if (sum()?.nextTier; as n) { Còn {{ num(sum()!.pointsToNextTier) }} điểm để lên hạng {{ n.label }} }
          @else if (sum()) { Bạn đang ở hạng cao nhất }
        </div>
      </div>
      @for (k of stats(); track k.l) {
        <div class="card stat">
          <div class="muted">{{ k.l }}</div>
          <div class="v serif">{{ k.v }}</div>
          <div class="muted s">{{ k.s }}</div>
        </div>
      }
    </section>

    <section class="cols">
      <div class="card">
        <div class="row head">
          <h2>Thông tin cá nhân</h2><span class="spacer"></span>
          <button type="button" class="btn secondary sm" [disabled]="editing()" (click)="startEdit()">{{ editing() ? 'Đang chỉnh sửa' : 'Chỉnh sửa' }}</button>
        </div>
        <div class="row avatar">
          <app-image-slot class="av" caption="Ảnh" [circle]="true" ratio="1 / 1" />
          <button type="button" class="btn secondary sm" [disabled]="!editing()">Đổi ảnh</button>
          <button type="button" class="btn ghost sm" [disabled]="!editing()">Xóa</button>
        </div>
        <div class="form">
          <div class="field"><label for="pf-name">Họ và tên</label><input id="pf-name" class="input" maxlength="120" [value]="fullName()" (input)="fullName.set($any($event.target).value)" [disabled]="!editing()">
            @if (fe('fullName')) {<small class="err" role="alert">{{ fe('fullName') }}</small>}</div>
          <div class="field"><label for="pf-dob">Ngày sinh</label><input id="pf-dob" class="input" type="date" [value]="birthDate()" (input)="birthDate.set($any($event.target).value)" [disabled]="!editing()">
            @if (fe('birthDate')) {<small class="err" role="alert">{{ fe('birthDate') }}</small>}</div>
          <div class="field"><label for="pf-phone">Số điện thoại</label>
            <input id="pf-phone" class="input" inputmode="tel" [value]="phone()" (input)="phone.set($any($event.target).value)" [disabled]="!editing()">
            @if (fe('phone')) {<small class="err" role="alert">{{ fe('phone') }}</small>}</div>
          <div class="field"><label for="pf-mail">Email</label>
            <input id="pf-mail" class="input" [value]="auth.user()?.email ?? ''" disabled></div>
          <div class="field"><span class="label">Giới tính</span>
            <div class="row wrap">
              @for (g of genders; track g; let i = $index) {
                <button type="button" class="tab-pill" [class.on]="gender() === genderKeys[i]" [disabled]="!editing()" (click)="gender.set(genderKeys[i])">{{ g }}</button>
              }
            </div>
            @if (fe('gender')) {<small class="err" role="alert">{{ fe('gender') }}</small>}</div>
          <div class="field"><label for="pf-branch">Chi nhánh mua thường xuyên</label>
            <select id="pf-branch" class="input" [disabled]="!editing()" (change)="branch.select(+$any($event.target).value)">
              @for (b of branch.branches; track b.id; let i = $index) {
                <option [value]="i" [selected]="i === branch.index()">{{ b.name }}</option>
              }
            </select></div>
        </div>
        @if (saveError()) { <p class="err" role="alert">{{ saveError() }}</p> }
        @if (saved()) { <p class="ok-note" role="status">Đã lưu thay đổi.</p> }
        @if (editing()) {
          <div class="row end">
            <button type="button" class="btn secondary" [disabled]="saving()" (click)="cancel()">Hủy</button>
            <button type="button" class="btn" [disabled]="saving()" (click)="save()">{{ saving() ? 'Đang lưu…' : 'Lưu thay đổi' }}</button>
          </div>
        }
      </div>

      <div class="side">
        <div class="card">
          <div class="row head"><h2>Sổ địa chỉ</h2><span class="spacer"></span><a class="btn ghost sm" routerLink="/account/addresses">+ Thêm</a></div>
          @for (a of addrs(); track a.id) {
            <div class="addr" [class.def]="a.isDefault">
              <div class="row"><b>{{ a.label }}</b>@if (a.isDefault) {<span class="pill ok">Mặc định</span>}</div>
              <div>{{ a.recipient }} · {{ a.phone }}</div>
              <div class="muted">{{ addrLine(a) }}</div>
            </div>
          } @empty { <div class="muted">Chưa có địa chỉ.</div> }
        </div>
        <div class="card">
          <h2>Bảo mật &amp; thông báo</h2>
          <div class="row line"><span>Mật khẩu</span><span class="spacer"></span><button type="button" class="btn ghost sm">Đổi mật khẩu</button></div>
          @for (n of notifNames; track n; let i = $index) {
            <div class="row line">
              <span [id]="'nf' + i">{{ n }}</span><span class="spacer"></span>
              <button type="button" class="toggle" role="switch" [class.on]="nf()[i]" [attr.aria-checked]="nf()[i]" [attr.aria-labelledby]="'nf' + i" (click)="flip(i)"></button>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    h2 { font-size: 16px; font-weight: 600; }
    .stats { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 16px; margin: 24px 0; }
    .hero { background: var(--primary); color: #fff; border-radius: 18px; padding: 22px; display: flex; flex-direction: column; gap: 8px; }
    .hero .big { font-size: 40px; line-height: 1.1; }
    .hero small { font-size: 14px; opacity: .7; font-family: var(--sans); }
    .bar { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .2); overflow: hidden; }
    .fill { height: 100%; background: var(--accent); border-radius: 999px; }
    .sub { font-size: 13px; opacity: .85; }
    .stat .v { font-size: 28px; margin: 4px 0; }
    .stat .s { font-size: 12px; }
    .cols { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; align-items: start; }
    .side { display: flex; flex-direction: column; gap: 20px; }
    .head { margin-bottom: 16px; }
    .avatar { margin-bottom: 20px; }
    .av { width: 64px; }
    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .with { display: flex; align-items: center; gap: 10px; }
    .input:disabled { background: var(--surface-2); border-color: transparent; opacity: 1; }
    .err { color: var(--danger, #b3261e); font-size: 12px; }
    .ok-note { color: var(--primary); font-size: 13px; margin-top: 12px; }
    .end { justify-content: flex-end; margin-top: 20px; }
    .addr { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); margin-top: 10px; font-size: 13px; }
    .addr.def { border: 1.5px solid var(--primary); }
    .line { padding: 12px 0; border-bottom: 1px solid var(--border); }
    .line:last-child { border-bottom: 0; }
    @media (max-width: 1100px) { .stats { grid-template-columns: 1fr 1fr; } .cols { grid-template-columns: 1fr; } }
    @media (max-width: 767px) { .stats { grid-template-columns: 1fr; } .form { grid-template-columns: 1fr; } }
  `
})
export class ProfilePage {
  private readonly api = inject(Api);
  protected readonly auth = inject(AuthStore);
  protected readonly branch = inject(BranchStore);
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
  protected readonly sum = signal<LoyaltySummary | null>(null);
  protected readonly addrs = signal<AddressDto[]>([]);
  protected readonly orderCount = signal<number | null>(null);
  protected readonly vouchers = signal<VoucherDto[] | null>(null);
  protected readonly error = signal('');

  protected readonly defaultAddr = computed((): AddressDto | undefined => this.addrs().find(a => a.isDefault) ?? this.addrs()[0]);
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
    const run = (p: Promise<unknown>) => p.catch(e => this.error.set(errMsg(e)));
    void run(this.auth.loadProfile().then(() => this.fill()));
    void run(this.api.get<LoyaltySummary>('/loyalty/summary').then(r => this.sum.set(r)));
    void run(this.api.get<AddressDto[]>('/addresses').then(r => this.addrs.set(r.slice(0, 2))));
    void run(this.api.get<Page<OrderSummary>>('/orders', {size: 1}).then(r => this.orderCount.set(r.meta.totalElements)));
    void run(this.api.get<VoucherDto[]>('/loyalty/vouchers').then(r => this.vouchers.set(r)));
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
      const err = e as ApiError;
      this.fieldErrors.set(err.fieldErrors ?? {});
      this.saveError.set(Object.keys(err.fieldErrors ?? {}).length ? '' : (err.message ?? 'Không lưu được thay đổi.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected addrLine = (a: AddressDto): string => [a.line1, a.ward, a.district, a.city].filter(Boolean).join(', ');

  protected flip(i: number): void {
    this.nf.update(a => a.map((v, j) => (j === i ? !v : v)));
  }
}
