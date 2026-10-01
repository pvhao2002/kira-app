import {ChangeDetectionStrategy, Component, inject, signal, viewChildren, ElementRef} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {toApiError} from '../../core/api';
import {AuthStore} from '../../core/auth.store';

const LEN = 6;

@Component({
  selector: 'app-otp-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <form class="card box" novalidate (submit)="$event.preventDefault(); confirm()">
        <div class="icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="3" width="12" height="18" rx="2"></rect><path d="M11 18h2"></path></svg>
        </div>
        <div>
          <h1>Nhập mã xác thực</h1>
          <div class="muted sub">
            @if (auth.otp()?.enrolled === false) {
              Đây là lần đầu bạn đăng nhập: thêm khóa bí mật bên dưới vào ứng dụng xác thực (Google Authenticator, Authy…), rồi nhập mã 6 số hiện trên ứng dụng.
            } @else {
              Nhập mã 6 số từ ứng dụng xác thực trên điện thoại của bạn.
            }
          </div>
        </div>

        @if (auth.otp()?.enrolled === false) {
          @if (auth.enrollment(); as e) {
            <div class="secret">
              <div class="eyebrow">Khóa bí mật</div>
              <div class="mono key">{{ e.secret }}</div>
              <div class="eyebrow">Đường dẫn otpauth (dán vào ứng dụng hỗ trợ)</div>
              <div class="mono uri">{{ e.otpauthUri }}</div>
            </div>
          } @else {
            <span class="muted">Đang tạo khóa bí mật…</span>
          }
        }

        <div class="digits" role="group" aria-label="Mã xác thực 6 số" (paste)="onPaste($event)">
          @for (d of digits(); track $index; let i = $index) {
            <input #cell class="cell" inputmode="numeric" maxlength="1" autocomplete="one-time-code"
              [class.err]="error()" [value]="d" [attr.aria-label]="'Chữ số ' + (i + 1)"
              (input)="onInput(i, $event)" (keydown)="onKey(i, $event)">
          }
        </div>
        @if (error()) {
          <span class="err-t" role="alert">{{ message() }}</span>
        }

        <button type="submit" class="btn block go" [disabled]="verifying() || (auth.otp()?.enrolled === false && !auth.enrollment())">{{ verifying() ? 'Đang xác nhận…' : 'Xác nhận' }}</button>

        <a routerLink="/login" class="muted sm" (click)="auth.cancelOtp()">← Quay lại đăng nhập</a>
      </form>
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--canvas); }
    .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
    .box { width: 520px; max-width: 100%; padding: 48px 56px; display: flex; flex-direction: column; gap: 24px; }
    .icon { width: 56px; height: 56px; border-radius: 16px; background: var(--tint); color: var(--primary); display: flex; align-items: center; justify-content: center; }
    h1 { font-family: var(--serif); font-weight: 400; font-size: 34px; margin-bottom: 8px; }
    .sub { font-size: 15px; line-height: 1.55; }
    .sm { font-size: 13px; }
    .digits { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    .cell { height: 60px; width: 100%; border-radius: 12px; background: var(--surface); border: 1px solid rgba(31, 42, 28, .18); text-align: center; font-size: 24px; font-weight: 600; padding: 0; }
    .cell:focus { border: 1.5px solid var(--primary); outline: none; }
    .cell.err { border: 1.5px solid var(--danger); }
    .err-t { font-size: 13px; color: var(--danger); margin-top: -12px; }
    .go { height: 54px; border-radius: 12px; font-size: 16px; }
    .secret { background: var(--surface); border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
    .key { font-size: 18px; font-weight: 600; letter-spacing: .06em; word-break: break-all; user-select: all; }
    .uri { font-size: 12px; word-break: break-all; user-select: all; }
    @media (max-width: 767px) {
      .box { padding: 28px 20px; gap: 20px; }
      .digits { gap: 6px; }
      .cell { height: 52px; font-size: 20px; }
    }
  `
})
export class OtpPage {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly cells = viewChildren<ElementRef<HTMLInputElement>>('cell');

  readonly digits = signal<string[]>(Array(LEN).fill(''));
  readonly error = signal(false);
  readonly message = signal('');
  readonly verifying = signal(false);

  constructor() {
    // No pending password step (e.g. direct visit or reload): start over at the login page.
    const c = this.auth.otp();
    if (!c) void this.router.navigateByUrl('/login');
    else if (!c.enrolled) void this.startEnrollment();
  }

  private async startEnrollment(): Promise<void> {
    try {
      await this.auth.enroll();
    } catch (e) {
      this.fail(toApiError(e).message);
    }
  }

  private fail(message: string): void {
    this.message.set(message);
    this.error.set(true);
  }

  private focus(i: number): void {
    this.cells()[Math.min(Math.max(i, 0), LEN - 1)]?.nativeElement.focus();
  }

  private set(i: number, v: string): void {
    this.digits.update(ds => ds.map((d, k) => (k === i ? v : d)));
  }

  onInput(i: number, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const v = el.value.replace(/\D/g, '').slice(-1);
    el.value = v;
    this.set(i, v);
    this.error.set(false);
    if (v) this.focus(i + 1);
  }

  onKey(i: number, ev: KeyboardEvent): void {
    if (ev.key === 'Backspace' && !this.digits()[i]) this.focus(i - 1);
    else if (ev.key === 'ArrowLeft') this.focus(i - 1);
    else if (ev.key === 'ArrowRight') this.focus(i + 1);
  }

  onPaste(ev: ClipboardEvent): void {
    const text = (ev.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, LEN);
    if (!text) return;
    ev.preventDefault();
    this.digits.set(Array.from({length: LEN}, (_, k) => text[k] ?? ''));
    this.error.set(false);
    this.focus(text.length);
  }

  async confirm(): Promise<void> {
    if (this.verifying()) return;
    if (this.digits().some(d => !d)) {
      this.fail('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    this.verifying.set(true);
    try {
      const u = await this.auth.verifyOtp(this.digits().join(''));
      // After OTP go straight to the role's landing page (no returnUrl).
      await this.router.navigateByUrl(this.auth.landing(u));
    } catch (e) {
      const err = toApiError(e);
      this.fail(err.code === 'OTP_INVALID' ? 'Mã không đúng hoặc đã hết hạn. Vui lòng thử lại.'
        : err.code === 'OTP_RATE_LIMITED' ? 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.' : err.message);
      this.digits.set(Array(LEN).fill(''));
      this.focus(0);
    } finally {
      this.verifying.set(false);
    }
  }
}
