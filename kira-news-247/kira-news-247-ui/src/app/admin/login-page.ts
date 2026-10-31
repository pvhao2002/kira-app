import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { AuthStore } from '../core/auth-store';
import { errorMessage } from '../core/proto-api';
import { Seo } from '../core/seo';

@Component({
  selector: 'news-login-page',
  imports: [FormsModule, HlmButton, HlmInput, HlmLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <form class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm" (ngSubmit)="submit()" data-testid="login-form">
        <h1 class="font-serif text-2xl font-bold">Kira <span class="text-primary">News</span> – Đăng nhập</h1>
        <p class="mt-1 text-sm text-muted-foreground">Dành cho ban biên tập và tài khoản AI.</p>
        <div class="mt-6 grid gap-2">
          <label hlmLabel for="username">Tên đăng nhập</label>
          <input hlmInput id="username" name="username" autocomplete="username" required data-testid="login-username" [(ngModel)]="username" />
        </div>
        <div class="mt-4 grid gap-2">
          <label hlmLabel for="password">Mật khẩu</label>
          <input hlmInput id="password" name="password" type="password" autocomplete="current-password" required data-testid="login-password" [(ngModel)]="password" />
        </div>
        @if (error()) {
          <p role="alert" class="mt-4 text-sm text-destructive" data-testid="login-error">{{ error() }}</p>
        }
        <button hlmBtn type="submit" class="mt-6 w-full" [disabled]="busy()" data-testid="login-submit">
          {{ busy() ? 'Đang đăng nhập…' : 'Đăng nhập' }}
        </button>
      </form>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected username = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    inject(Seo).set({ title: 'Đăng nhập', description: '', path: '/admin/dang-nhap', noindex: true });
  }

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.username.trim(), this.password);
      await this.router.navigateByUrl(this.auth.isAdmin() ? '/admin' : '/admin/viec-cho-ai');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
