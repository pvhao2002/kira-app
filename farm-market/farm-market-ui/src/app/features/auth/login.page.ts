import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, isDevMode, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Api, ApiError, toApiError} from '../../core/api';
import {AuthStore, AuthUser, DEMO_PASSWORD, DEMO_USERS} from '../../core/auth.store';
import {ImageSlot} from '../../shared/image-slot';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="left">
        <a routerLink="/" class="logo"><i class="egg"></i><span class="serif">Đồi Nắng</span></a>

        <div class="center">
          <div>
            <h1>Đăng nhập</h1>
            <div class="muted sub">Khách hàng và nhân viên dùng chung một trang đăng nhập.</div>
          </div>

          @if (!signedIn() && mode() === 'register') {
            <form class="stack" novalidate (ngSubmit)="register()">
              <div class="field">
                <label for="rg-name">Họ tên</label>
                <input id="rg-name" class="input tall" name="fullName" autocomplete="name" [(ngModel)]="regName" [class.err]="!!fieldErr('fullName')">
                @if (fieldErr('fullName')) { <span class="err-t" role="alert">{{ fieldErr('fullName') }}</span> }
              </div>
              <div class="field">
                <label for="rg-email">Email</label>
                <input id="rg-email" class="input tall" type="email" name="email" autocomplete="email" [(ngModel)]="regEmail" [class.err]="!!fieldErr('email')">
                @if (fieldErr('email')) { <span class="err-t" role="alert">{{ fieldErr('email') }}</span> }
              </div>
              <div class="field">
                <label for="rg-phone">Số điện thoại (không bắt buộc)</label>
                <input id="rg-phone" class="input tall" name="phone" inputmode="tel" autocomplete="tel" [(ngModel)]="regPhone" [class.err]="!!fieldErr('phone')">
                @if (fieldErr('phone')) { <span class="err-t" role="alert">{{ fieldErr('phone') }}</span> }
              </div>
              <div class="field">
                <label for="rg-pw">Mật khẩu (từ 8 ký tự)</label>
                <input id="rg-pw" class="input tall" name="newPassword" autocomplete="new-password" [type]="showPw() ? 'text' : 'password'" [(ngModel)]="regPassword" [class.err]="!!fieldErr('password')">
                @if (fieldErr('password')) { <span class="err-t" role="alert">{{ fieldErr('password') }}</span> }
              </div>
              @if (error()) {
                <span class="err-t" role="alert">{{ error() }}</span>
              }
              <button type="submit" class="btn block go" [disabled]="loading()">{{ loading() ? 'Đang tạo tài khoản…' : 'Đăng ký' }}</button>
              <div class="center-t muted">Đã có tài khoản? <button type="button" class="link" (click)="setMode('login')">Đăng nhập</button></div>
            </form>
          } @else if (!signedIn()) {
            <form class="stack" novalidate (ngSubmit)="submit()">
              <div class="field">
                <span class="label">Tài khoản demo</span>
                <div class="chips" role="group" aria-label="Chọn tài khoản demo">
                  @for (u of users; track u.role; let i = $index) {
                    <button type="button" class="tab-pill" [class.on]="roleIdx() === i" [attr.aria-pressed]="roleIdx() === i" (click)="pickRole(i)">{{ u.label }}</button>
                  }
                </div>
              </div>

              <div class="field">
                <label for="lg-id">Email hoặc số điện thoại</label>
                <input id="lg-id" class="input tall" name="identifier" autocomplete="username" [(ngModel)]="identifier" [class.err]="!!error()" (input)="error.set('')">
              </div>

              <div class="field">
                <label for="lg-pw">Mật khẩu</label>
                <div class="pw">
                  <input id="lg-pw" class="input tall" name="password" autocomplete="current-password" [type]="showPw() ? 'text' : 'password'" [(ngModel)]="password" [class.err]="!!error()" (input)="error.set('')">
                  <button type="button" class="show" [attr.aria-pressed]="showPw()" (click)="showPw.set(!showPw())">{{ showPw() ? 'Ẩn' : 'Hiện' }}</button>
                </div>
                @if (error()) {
                  <span class="err-t" role="alert">{{ error() }}</span>
                }
              </div>

              <div class="between">
                <label class="rem">
                  <input type="checkbox" name="remember" [(ngModel)]="remember">
                  <span class="box">{{ remember() ? '✓' : '' }}</span>Ghi nhớ đăng nhập
                </label>
                <button type="button" class="link">Quên mật khẩu?</button>
              </div>

              <button type="submit" class="btn block go" [disabled]="loading()">{{ loading() ? 'Đang đăng nhập…' : 'Đăng nhập' }}</button>
              @if (dev) {
                <div class="muted sm dev-hint">Dev: nhân viên/quản lý/quản trị cần mã OTP thật. Chạy <code>node farm-market-service/totp.js</code> để lấy mã hiện tại (bí mật dev trong README).</div>
              }

              <div class="or"><span></span>hoặc<span></span></div>
              <div class="alts">
                <button type="button" class="alt" disabled title="Sắp ra mắt">Mã OTP qua SMS</button>
                <button type="button" class="alt" disabled title="Sắp ra mắt">Google</button>
              </div>
              <div class="center-t muted">Chưa có tài khoản? <button type="button" class="link" (click)="setMode('register')">Đăng ký</button></div>
            </form>
          } @else {
            @if (user(); as u) {
              <div class="stack">
                <div class="hello">
                  <span class="ok-dot">✓</span>
                  <div><b class="hi">Xin chào, {{ u.name }}</b><div class="muted">Vai trò: {{ u.label }}</div></div>
                </div>
                <div class="dest">
                  <div class="eyebrow">Đang chuyển đến</div>
                  <div class="mono path">{{ destPath() }}</div>
                  <div class="muted">{{ u.destDesc }}</div>
                  <div class="progress"><div></div></div>
                </div>
                <button type="button" class="link back" (click)="back()">← Quay lại form</button>
              </div>
            }
          }
        </div>

        <a routerLink="/" class="muted sm">← Về trang chủ</a>
      </div>

      <div class="right">
        <app-image-slot class="bg" caption="Ảnh: rổ trứng và gà thả vườn buổi sáng" [radius]="28" ratio="auto" />
        <div class="tagcard">
          <div class="eyebrow">Farm tag</div>
          <div class="serif lot">Lô TG-0930</div>
          <div class="muted sm">Thu hoạch 06:05 sáng nay · Trại Đồi Nắng</div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--canvas); }
    .page { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); min-height: 100vh; }
    .left { display: flex; flex-direction: column; padding: 40px 96px; gap: 24px; }
    .logo { display: flex; align-items: center; gap: 10px; font-size: 24px; color: var(--primary); }
    .egg { width: 24px; height: 30px; background: var(--accent); border: 2px solid var(--primary); border-radius: 50% 50% 46% 46% / 60% 60% 40% 40%; }
    .center { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px; max-width: 440px; width: 100%; }
    h1 { font-family: var(--serif); font-weight: 400; font-size: 48px; letter-spacing: -.02em; margin-bottom: 8px; }
    .sub { font-size: 15px; }
    .sm { font-size: 13px; }
    .stack { display: flex; flex-direction: column; gap: 20px; }
    .stack.tight { gap: 8px; }
    .grow { flex: 1; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .input.tall { height: 52px; font-size: 16px; padding: 0 16px; }
    .pw { position: relative; }
    .pw .input { padding-right: 64px; }
    .show { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: 0; padding: 8px; font-weight: 600; font-size: 13px; color: var(--primary); }
    .err-t { font-size: 13px; color: var(--danger); }
    .between { display: flex; justify-content: space-between; align-items: center; font-size: 14px; gap: 8px; }
    .rem { display: flex; align-items: center; gap: 10px; cursor: pointer; position: relative; }
    .rem input { position: absolute; opacity: 0; width: 20px; height: 20px; margin: 0; }
    .box { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid rgba(31, 42, 28, .3); color: #fff; font-size: 13px; display: flex; align-items: center; justify-content: center; }
    .rem input:checked + .box { background: var(--primary); border-color: var(--primary); }
    .rem input:focus-visible + .box { outline: 2px solid var(--primary); outline-offset: 2px; }
    .link { font-weight: 600; color: var(--primary); background: none; border: 0; padding: 0; font-size: 14px; }
    .go { height: 54px; font-size: 16px; }
    .or { display: flex; align-items: center; gap: 12px; font-size: 12px; color: rgba(31, 42, 28, .45); }
    .or span { flex: 1; height: 1px; background: rgba(31, 42, 28, .12); }
    .alts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .alt { height: 50px; border-radius: 999px; border: 1px solid rgba(31, 42, 28, .18); background: var(--surface); font-weight: 600; font-size: 14px; }
    .alt:disabled { opacity: .6; cursor: not-allowed; }
    .center-t { text-align: center; font-size: 14px; }
    .hello { display: flex; align-items: center; gap: 14px; }
    .ok-dot { width: 44px; height: 44px; border-radius: 50%; background: var(--tint); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; }
    .hi { font-size: 18px; display: block; }
    .dest { background: var(--surface); border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
    .path { font-size: 15px; font-weight: 600; }
    .progress { height: 4px; border-radius: 4px; background: var(--surface-2); overflow: hidden; margin-top: 6px; }
    .progress div { width: 65%; height: 100%; background: var(--primary); }
    .dev-hint { line-height: 1.5; }
    .back { align-self: flex-start; }
    .right { position: relative; padding: 24px 24px 24px 0; }
    .bg { height: 100%; min-height: 400px; }
    .tagcard { position: absolute; left: 48px; bottom: 48px; width: 320px; background: var(--surface); border-radius: 18px; padding: 18px 20px; box-shadow: var(--shadow-pop); }
    .lot { font-size: 20px; margin: 8px 0 6px; }
    @media (max-width: 1100px) { .left { padding: 40px 48px; } }
    @media (max-width: 767px) {
      .page { grid-template-columns: 1fr; }
      .left { padding: 24px 22px; gap: 20px; }
      .right { display: none; }
      h1 { font-size: 36px; }
      .center { gap: 24px; max-width: none; }
    }
  `
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly dev = isDevMode();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  readonly users = DEMO_USERS;
  readonly roleIdx = signal(0);
  readonly identifier = signal(DEMO_USERS[0].email);
  readonly password = signal(DEMO_PASSWORD);
  readonly showPw = signal(false);
  readonly remember = signal(true);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly mode = signal<'login' | 'register'>('login');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly regName = signal('');
  readonly regEmail = signal('');
  readonly regPhone = signal('');
  readonly regPassword = signal('');
  readonly user = signal<AuthUser | null>(null);
  readonly signedIn = computed(() => this.user() !== null);

  private get returnUrl(): string | null {
    return this.route.snapshot.queryParamMap.get('returnUrl');
  }

  readonly destPath = computed(() => {
    const u = this.user();
    return u ? this.auth.landing(u, this.returnUrl) : '';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  pickRole(i: number): void {
    this.roleIdx.set(i);
    this.identifier.set(this.users[i].email);
    this.password.set(DEMO_PASSWORD);
    this.error.set('');
  }

  setMode(m: 'login' | 'register'): void {
    this.mode.set(m);
    this.error.set('');
    this.fieldErrors.set({});
  }

  fieldErr(k: string): string {
    return this.fieldErrors()[k] ?? '';
  }

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.error.set('');
    if (!this.identifier().trim() || !this.password()) {
      this.error.set('Vui lòng nhập email và mật khẩu.');
      return;
    }
    await this.authenticate(() => this.auth.signIn(this.identifier().trim(), this.password()));
  }

  async register(): Promise<void> {
    if (this.loading()) return;
    this.error.set('');
    this.fieldErrors.set({});
    const email = this.regEmail().trim();
    const password = this.regPassword();
    await this.authenticate(async () => {
      await this.api.post('/auth/register', {fullName: this.regName().trim(), email, phone: this.regPhone().trim(), password});
      return this.auth.signIn(email, password);
    });
  }

  private async authenticate(run: () => Promise<AuthUser | null>): Promise<void> {
    this.loading.set(true);
    try {
      const u = await run();
      if (!u) {
        // Back-office role: the password was right, a TOTP code is still required.
        void this.router.navigateByUrl('/login/otp');
        return;
      }
      this.user.set(u);
      this.timers.push(setTimeout(() => this.proceed(), 900));
    } catch (e) {
      const err: ApiError = toApiError(e);
      this.error.set(err.message);
      this.fieldErrors.set(err.fieldErrors);
    } finally {
      this.loading.set(false);
    }
  }

  proceed(): void {
    const u = this.user();
    if (u) void this.router.navigateByUrl(this.auth.landing(u, this.returnUrl));
  }

  back(): void {
    this.timers.forEach(clearTimeout);
    this.timers.length = 0;
    void this.auth.logout();
    this.user.set(null);
  }
}
