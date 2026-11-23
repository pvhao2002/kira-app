import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiError, safeReturnUrl } from '../core/http';

@Component({
  selector: 'mm-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-page">
      <section class="login-art">
        <div class="brand"><span class="brand-mark" aria-hidden="true">M</span><span class="brand-text"><strong>MatchMind</strong><small>Private workspace</small></span></div>
        <div class="art-copy">
          <p class="art-title">Private workspace.</p>
          <p>Access is by invitation only.</p>
        </div>
      </section>
      <section class="login-form-wrap">
        <form class="login-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="login-mobile-brand"><span class="brand-mark" aria-hidden="true">M</span><span class="brand-text"><strong>MatchMind</strong><small>Private workspace</small></span></div>
          <h1>Sign in</h1>
          <p class="login-sub">Use the account an administrator created for you.</p>
          @if (expired) { <div class="alert alert-warn" role="status">Your session ended. Sign in again to continue.</div> }
          @if (error()) { <div class="alert alert-error" role="alert" data-testid="login-error">{{ error() }}</div> }
          <div>
            <label for="username">Username</label>
            <input class="input w-full" id="username" formControlName="username" autocomplete="username" autofocus
              [attr.aria-invalid]="invalid('username')" [attr.aria-describedby]="invalid('username') ? 'username-error' : null" />
            @if (invalid('username')) { <div class="field-error" id="username-error">{{ message('username') }}</div> }
          </div>
          <div>
            <label for="password">Password</label>
            <div class="password-wrap">
              <input class="input w-full" id="password" formControlName="password" autocomplete="current-password"
                [type]="showPassword() ? 'text' : 'password'" [attr.aria-invalid]="invalid('password')"
                [attr.aria-describedby]="invalid('password') ? 'password-error' : null" />
              <!-- A fixed name with aria-pressed: swapping the label too would announce a contradictory state. -->
              <button type="button" class="btn btn-text btn-icon" aria-label="Show password"
                [attr.aria-pressed]="showPassword()" (click)="showPassword.set(!showPassword())">
                <i class="pi" [class.pi-eye]="!showPassword()" [class.pi-eye-slash]="showPassword()" aria-hidden="true"></i>
              </button>
            </div>
            @if (invalid('password')) { <div class="field-error" id="password-error">{{ message('password') }}</div> }
          </div>
          <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">
            @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Sign in
          </button>
        </form>
      </section>
    </main>`,
  // The art headline is not a heading: "Sign in" is the page's h1, which stays visible when the art panel is hidden (<= 860px).
  styles: `
    .art-copy { margin-block: auto; }
    .art-title { font-family: var(--mm-display); font-size: 3.2rem; font-weight: 600; letter-spacing: -.03em; line-height: 1.02; max-width: 13ch; color: inherit; margin: 0; }
    .login-form h1 { font-size: 1.6rem; }`,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly showPassword = signal(false);
  readonly expired = this.route.snapshot.queryParamMap.get('expired') === '1';

  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.maxLength(64)]],
    password: ['', [Validators.required, Validators.maxLength(72)]],
  });

  invalid(name: 'username' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  /** The text under a field; a too-long value must not read as "required". */
  message(name: 'username' | 'password'): string {
    const c = this.form.controls[name];
    if (c.hasError('maxlength')) return `${name === 'username' ? 'Username' : 'Password'} can be ${c.getError('maxlength').requiredLength} characters at most.`;
    return `Enter your ${name}.`;
  }

  submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      // Screen readers hear the error through aria-describedby once focus lands on the first invalid field.
      const first = (['username', 'password'] as const).find(n => this.form.controls[n].invalid);
      this.host.nativeElement.querySelector<HTMLInputElement>(`#${first}`)?.focus();
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: res => {
        // A temporary password must be changed first (every other call is 403 PASSWORD_CHANGE_REQUIRED).
        const target = res.user.mustChangePassword ? '/settings' : safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        this.router.navigateByUrl(target)
          .then(ok => { if (!ok) this.busy.set(false); }, () => this.busy.set(false));
      },
      error: err => {
        this.busy.set(false);
        const e = apiError(err);
        this.error.set(e.status === 401 ? 'Wrong username or password.' : e.status === 429 ? e.message : e.status === 0 ? 'Server unreachable. Try again shortly.' : e.message);
      },
    });
  }
}
