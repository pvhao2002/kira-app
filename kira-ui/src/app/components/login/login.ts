import {ChangeDetectionStrategy, Component, inject, OnInit, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {AuthService} from '../../config/AuthService';
import {ToastService} from '../../config/ToastService';
import {Subscription, take} from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private sessionCheckSubscription?: Subscription;

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  readonly showPassword = signal(false);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.sessionCheckSubscription = this.authService.checkSession()
      .pipe(take(1))
      .subscribe((authenticated) => {
        if (authenticated) {
          void this.router.navigateByUrl('/dashboard');
        }
      });
  }

  onSubmit(): void {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please enter both username and password.');
      return;
    }

    const {username, password} = this.form.getRawValue();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password.trim()) {
      this.toast.error('Please enter both username and password.');
      return;
    }

    this.sessionCheckSubscription?.unsubscribe();
    this.loading.set(true);
    this.authService.login(trimmedUsername, password)
      .subscribe({
        next: () => {
          const returnUrl = this.resolveReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
          this.loading.set(false);
          this.toast.success('Signed in successfully');
          void this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.loading.set(false);
          const message = err?.error?.message || 'Sign-in failed. Please check your information.';
          this.toast.error(message);
        }
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((current) => !current);
  }

  private resolveReturnUrl(rawReturnUrl: string | null): string {
    if (!rawReturnUrl || !rawReturnUrl.startsWith('/') || rawReturnUrl.startsWith('/login')) {
      return '/dashboard';
    }
    return rawReturnUrl;
  }
}
