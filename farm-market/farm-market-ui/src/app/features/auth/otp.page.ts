import {ChangeDetectionStrategy, Component, inject, signal, viewChildren, ElementRef} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {toApiError} from '../../core/api';
import {AuthStore} from '../../core/auth.store';

const LEN = 6;

@Component({
  selector: 'app-otp-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otp.page.html',
  styleUrl: './otp.page.css'
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
