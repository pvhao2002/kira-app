import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Api, errorMessage} from '../../core/api';
import {AuthStore} from '../../core/auth';

/** The viewer account seeded by V1; the admin can reset its password. */
const OTHER = 'love';
/** bcrypt reads at most 72 bytes, so the server refuses longer passwords. */
const MAX_BYTES = 72;

export interface PasswordErrors { current?: string; next?: string; repeat?: string; }

/** Checks before calling the server. `current` undefined: there is no current-password field (admin reset). */
export function passwordErrors(next: string, repeat: string, current?: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (current !== undefined && !current) errors.current = 'Nhập mật khẩu hiện tại';
  if (next.length < 8) errors.next = 'Mật khẩu mới cần ít nhất 8 ký tự';
  else if (new TextEncoder().encode(next).length > MAX_BYTES) errors.next = 'Mật khẩu mới quá dài (tối đa 72 ký tự không dấu)';
  else if (current !== undefined && next === current) errors.next = 'Mật khẩu mới phải khác mật khẩu cũ';
  else if (repeat !== next) errors.repeat = 'Hai lần nhập chưa giống nhau';
  return errors;
}

class PasswordForm {
  readonly current = signal('');
  readonly next = signal('');
  readonly repeat = signal('');
  readonly visible = signal(false);
  readonly tried = signal(false);
  readonly busy = signal(false);
  readonly done = signal('');
  readonly error = signal('');
  readonly errors = computed(() => passwordErrors(this.next(), this.repeat(), this.withCurrent ? this.current() : undefined));

  constructor(private withCurrent: boolean) {}

  /** The message for one field, shown only after the first submit. */
  message(key: keyof PasswordErrors) {
    return this.tried() ? this.errors()[key] ?? '' : '';
  }

  /** Marks the attempt; true when the form can go to the server. */
  ready() {
    this.tried.set(true);
    this.done.set('');
    this.error.set('');
    return !Object.keys(this.errors()).length;
  }

  finish(done: string) {
    this.current.set('');
    this.next.set('');
    this.repeat.set('');
    this.tried.set(false);
    this.busy.set(false);
    this.done.set(done);
  }

  fail(err: unknown) {
    this.busy.set(false);
    this.error.set(errorMessage(err));
  }
}

@Component({
  selector: 'app-account-page',
  imports: [FormsModule, RouterLink],
  template: `
    <header>
      <a class="btn ghost" routerLink="/">‹ Về trang ảnh</a>
      <h1 class="script">Tài khoản</h1>
      @if (auth.user(); as u) {
        <p class="muted">Đang đăng nhập: <strong>{{ u.displayName }}</strong> ({{ u.username }})</p>
      }
      @if (auth.isAdmin()) { <a class="btn" routerLink="/cai-dat">Cài đặt trang</a> }
    </header>

    <section class="card" aria-labelledby="mine-title">
      <h2 id="mine-title">Đổi mật khẩu</h2>
      <p class="muted">Thiết bị này vẫn giữ đăng nhập; các thiết bị khác của tài khoản này sẽ bị đăng xuất.</p>
      <form (ngSubmit)="change()" novalidate>
        <label class="field">Mật khẩu hiện tại
          <input class="input" name="current" [type]="mine.visible() ? 'text' : 'password'" autocomplete="current-password"
                 [(ngModel)]="mine.current" [attr.aria-invalid]="!!mine.message('current')" aria-describedby="mine-current">
        </label>
        <p id="mine-current" class="error">{{ mine.message('current') }}</p>
        <label class="field">Mật khẩu mới
          <input class="input" name="next" [type]="mine.visible() ? 'text' : 'password'" autocomplete="new-password"
                 [(ngModel)]="mine.next" [attr.aria-invalid]="!!mine.message('next')" aria-describedby="mine-next">
        </label>
        <p id="mine-next" class="error">{{ mine.message('next') }}</p>
        <label class="field">Nhập lại mật khẩu mới
          <input class="input" name="repeat" [type]="mine.visible() ? 'text' : 'password'" autocomplete="new-password"
                 [(ngModel)]="mine.repeat" [attr.aria-invalid]="!!mine.message('repeat')" aria-describedby="mine-repeat">
        </label>
        <p id="mine-repeat" class="error">{{ mine.message('repeat') }}</p>
        <label class="toggle"><input type="checkbox" name="show" [(ngModel)]="mine.visible"> Hiện mật khẩu</label>
        @if (mine.error()) { <p class="error" role="alert">{{ mine.error() }}</p> }
        @if (mine.done()) { <p class="ok" role="status">{{ mine.done() }}</p> }
        <button class="btn primary" type="submit" [disabled]="mine.busy()">{{ mine.busy() ? 'Đang đổi…' : 'Đổi mật khẩu' }}</button>
      </form>
    </section>

    @if (auth.isAdmin()) {
      <section class="card" aria-labelledby="other-title">
        <h2 id="other-title">Đặt lại mật khẩu cho Em</h2>
        <p class="muted">Dùng khi Em quên mật khẩu. Em sẽ bị đăng xuất trên mọi thiết bị và đăng nhập lại bằng mật khẩu mới.</p>
        <form (ngSubmit)="reset()" novalidate>
          <label class="field">Mật khẩu mới cho Em
            <input class="input" name="next" [type]="other.visible() ? 'text' : 'password'" autocomplete="new-password"
                   [(ngModel)]="other.next" [attr.aria-invalid]="!!other.message('next')" aria-describedby="other-next">
          </label>
          <p id="other-next" class="error">{{ other.message('next') }}</p>
          <label class="field">Nhập lại
            <input class="input" name="repeat" [type]="other.visible() ? 'text' : 'password'" autocomplete="new-password"
                   [(ngModel)]="other.repeat" [attr.aria-invalid]="!!other.message('repeat')" aria-describedby="other-repeat">
          </label>
          <p id="other-repeat" class="error">{{ other.message('repeat') }}</p>
          <label class="toggle"><input type="checkbox" name="show" [(ngModel)]="other.visible"> Hiện mật khẩu</label>
          @if (other.error()) { <p class="error" role="alert">{{ other.error() }}</p> }
          @if (other.done()) { <p class="ok" role="status">{{ other.done() }}</p> }
          <button class="btn primary" type="submit" [disabled]="other.busy()">{{ other.busy() ? 'Đang đặt lại…' : 'Đặt lại mật khẩu' }}</button>
        </form>
      </section>
    }
  `,
  styles: `
    :host { display: block; max-width: 760px; margin: 0 auto; padding: 20px 20px 120px; }
    header { display: grid; gap: 4px; justify-items: start; }
    h1 { margin: 0; font-size: 46px; color: var(--rose-deep); }
    header p { margin: 0 0 6px; }
    .card { margin-top: 24px; padding: 20px; border: 1px solid var(--blush); border-radius: 22px; background: var(--paper);
      box-shadow: var(--shadow); }
    h2 { margin: 0 0 4px; font-size: 18px; }
    .card > p { margin: 0 0 16px; }
    form { display: grid; gap: 6px; max-width: 420px; }
    form .error { margin: 0 0 6px; min-height: 1em; }
    .toggle { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 14px; cursor: pointer; }
    .toggle input { width: 18px; height: 18px; accent-color: var(--rose-deep); }
    .ok { margin: 0 0 6px; color: #166534; font-weight: 500; }
    .btn.primary { justify-self: start; margin-top: 6px; }
  `
})
export class AccountPage {
  private api = inject(Api);
  protected auth = inject(AuthStore);
  protected mine = new PasswordForm(true);
  protected other = new PasswordForm(false);

  protected change() {
    const f = this.mine;
    if (!f.ready()) return;
    f.busy.set(true);
    this.api.changePassword(f.current(), f.next()).subscribe({
      next: user => {
        this.auth.user.set(user);
        f.finish('Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.');
      },
      error: err => f.fail(err)
    });
  }

  protected reset() {
    const f = this.other;
    if (!f.ready()) return;
    f.busy.set(true);
    this.api.resetPassword(OTHER, f.next()).subscribe({
      next: () => f.finish('Đã đặt lại mật khẩu cho Em. Em cần đăng nhập lại bằng mật khẩu mới.'),
      error: err => f.fail(err)
    });
  }
}
