import {ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {apiErrorMessage, fieldErrors} from '../../core/api/api-error';
import {AuthStore} from '../../core/auth/auth.store';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthPage {
  /** Bound from route data. */
  readonly mode = input<'login' | 'register'>('login');
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly fullName = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverError = signal('');
  protected readonly serverFields = signal<Record<string, string>>({});
  protected readonly isRegister = computed(() => this.mode() === 'register');

  protected readonly errors = computed(() => {
    const server = this.serverFields(), password = this.password();
    return {
      fullName: this.isRegister() && !this.fullName().trim() ? 'Vui lòng nhập họ tên' : server['fullName'] ?? '',
      email: !EMAIL.test(this.email().trim()) ? 'Email không hợp lệ' : server['email'] ?? '',
      password: !password ? 'Vui lòng nhập mật khẩu'
        : this.isRegister() && (password.length < 8 || password.length > 72) ? 'Mật khẩu phải từ 8 đến 72 ký tự'
          : server['password'] ?? ''
    };
  });

  protected submit(): void {
    this.submitted.set(true);
    this.serverError.set('');
    this.serverFields.set({});
    const e = this.errors();
    if (e.fullName || e.email || e.password || this.busy()) return;

    this.busy.set(true);
    const credentials = {email: this.email().trim(), password: this.password()};
    const request = this.isRegister()
      ? this.auth.register({...credentials, fullName: this.fullName().trim()})
      : this.auth.login(credentials);
    request.subscribe({
      next: () => void this.router.navigateByUrl('/app/dashboard'),
      error: err => {
        this.busy.set(false);
        this.serverFields.set(fieldErrors(err));
        this.serverError.set(apiErrorMessage(err));
      }
    });
  }
}
