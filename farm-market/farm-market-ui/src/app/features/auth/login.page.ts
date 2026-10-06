import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, isDevMode, signal} from '@angular/core';
import {FormField, FormRoot, form, required, validate} from '@angular/forms/signals';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Api, ApiError, toApiError} from '../../core/api';
import {AuthStore, AuthUser, DEMO_PASSWORD, DEMO_USERS} from '../../core/auth.store';
import {fetchPublicIp} from '../../core/public-ip';
import {ImageSlot} from '../../shared/image-slot';
import {AppLogo} from '../../shared/logo';

const LOGIN_REQUIRED = 'Vui lòng nhập email và mật khẩu.';

@Component({
  selector: 'app-login-page',
  imports: [AppLogo, FormField, FormRoot, RouterLink, ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.css'
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly dev = isDevMode();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private clientIp: string | null = null;

  readonly users = DEMO_USERS;
  readonly roleIdx = signal(0);
  readonly showPw = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly loginModel = signal({identifier: DEMO_USERS[0].email, password: DEMO_PASSWORD, remember: true});
  readonly loginForm = form(this.loginModel, p => {
    validate(p.identifier, ({value}) => (value().trim() ? undefined : {kind: 'required', message: LOGIN_REQUIRED}));
    required(p.password, {message: LOGIN_REQUIRED});
  });
  // Register rules are enforced by the API; its fieldErrors are shown under each field (see fieldErr).
  private readonly registerModel = signal({fullName: '', email: '', phone: '', password: ''});
  readonly registerForm = form(this.registerModel);
  readonly mode = signal<'login' | 'register'>('login');
  readonly fieldErrors = signal<Record<string, string>>({});
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
    void fetchPublicIp().then(ip => this.clientIp = ip);
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  pickRole(i: number): void {
    this.roleIdx.set(i);
    this.loginModel.update(m => ({...m, identifier: this.users[i].email, password: DEMO_PASSWORD}));
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
    if (this.loginForm().invalid()) {
      this.error.set(LOGIN_REQUIRED);
      return;
    }
    const {identifier, password} = this.loginModel();
    await this.authenticate(() => this.auth.signIn(identifier.trim(), password, this.clientIp));
  }

  async register(): Promise<void> {
    if (this.loading()) return;
    this.error.set('');
    this.fieldErrors.set({});
    const m = this.registerModel();
    const email = m.email.trim();
    const password = m.password;
    await this.authenticate(async () => {
      await this.api.post('/auth/register', {fullName: m.fullName.trim(), email, phone: m.phone.trim(), password});
      return this.auth.signIn(email, password, this.clientIp);
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
