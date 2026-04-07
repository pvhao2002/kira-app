import {Component, inject, OnInit, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {AuthService} from '../../config/AuthService';
import {ToastService} from '../../config/ToastService';
import {Subscription, take} from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  standalone: true
})
export class Login implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private sessionCheckSubscription?: Subscription;

  readonly username = signal('');
  readonly password = signal('');
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
    if (!this.username().trim() || !this.password().trim() || this.loading()) {
      return;
    }

    this.sessionCheckSubscription?.unsubscribe();
    this.loading.set(true);
    this.authService.login(this.username().trim(), this.password())
      .subscribe({
        next: () => {
          const returnUrl = this.resolveReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
          this.loading.set(false);
          this.toast.success('Đăng nhập thành công');
          void this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.loading.set(false);
          const message = err?.error?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
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
