import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';

@Component({
  selector: 'mm-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-page">
      <section class="login-art">
        <div class="brand"><span class="brand-mark">M</span><span class="brand-text"><strong>MatchMind</strong><small>AI Football Intelligence Platform</small></span></div>
        <div>
          <h1>Every AI pick, settled and scored.</h1>
          <p>Track what each model predicted before kick-off and in play, then see how it actually played out.</p>
          <ul class="login-points">
            <li><i class="pi pi-check-circle" aria-hidden="true"></i>Picks settled by the backend, never by the model</li>
            <li><i class="pi pi-check-circle" aria-hidden="true"></i>Quarter lines and live odds on the remaining match</li>
            <li><i class="pi pi-check-circle" aria-hidden="true"></i>Win rates per model, market and league</li>
          </ul>
        </div>
        <span></span>
      </section>
      <section class="login-form-wrap">
        <form class="login-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="login-mobile-brand"><span class="brand-mark" aria-hidden="true">M</span><span class="brand-text"><strong>MatchMind</strong><small>AI Football Intelligence Platform</small></span></div>
          <h2>Sign in</h2>
          <p class="login-sub">Use the account an administrator created for you.</p>
          @if (expired) { <div class="alert alert-warn" role="status">Your session ended. Sign in again to continue.</div> }
          @if (error()) { <div class="alert alert-error" role="alert" data-testid="login-error">{{ error() }}</div> }
          <div>
            <label for="username">Username</label>
            <input class="input w-full" id="username" formControlName="username" autocomplete="username" [attr.aria-invalid]="invalid('username')" />
            @if (invalid('username')) { <div class="field-error">Enter your username.</div> }
          </div>
          <div>
            <label for="password">Password</label>
            <div class="password-wrap">
              <input class="input w-full" id="password" formControlName="password" autocomplete="current-password"
                [type]="showPassword() ? 'text' : 'password'" [attr.aria-invalid]="invalid('password')" />
              <button type="button" class="btn btn-text btn-icon" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="showPassword()" (click)="showPassword.set(!showPassword())">
                <i class="pi" [class.pi-eye]="!showPassword()" [class.pi-eye-slash]="showPassword()"></i>
              </button>
            </div>
            @if (invalid('password')) { <div class="field-error">Enter your password.</div> }
          </div>
          <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">
            @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Sign in
          </button>
        </form>
      </section>
    </div>`,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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

  submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: () => {
        const target = this.route.snapshot.queryParamMap.get('returnUrl');
        // Only same-app paths: never redirect to an absolute/external URL taken from the query string.
        this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard')
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
