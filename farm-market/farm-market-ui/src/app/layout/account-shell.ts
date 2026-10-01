import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {Api} from '../core/api';
import {AuthStore} from '../core/auth.store';
import type {LoyaltySummary} from '../features/account/account.data';

@Component({
  selector: 'app-account-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container wrap">
      <aside class="menu card">
        <div class="who">
          <span class="av">{{ auth.user()?.name?.[0] }}</span>
          <div><b>{{ auth.user()?.fullName ?? auth.user()?.name }}</b>@if (tier()) {<div class="tier">Thành viên {{ tier() }}</div>}</div>
        </div>
        @for (m of items; track m.link) {
          <a [routerLink]="m.link" routerLinkActive="on" [routerLinkActiveOptions]="{exact: m.link === '/account'}">{{ m.label }}</a>
        }
        <button type="button" class="out" (click)="logout()">Đăng xuất</button>
      </aside>
      <section class="content"><router-outlet /></section>
    </div>
  `,
  styles: `
    .wrap { display: grid; grid-template-columns: 260px 1fr; gap: 32px; padding-top: 40px; align-items: start; }
    .menu { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
    .who { display: flex; gap: 12px; align-items: center; padding: 8px 8px 16px; }
    .av { width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: var(--brown-dark); display: grid; place-items: center; font-weight: 700; }
    .tier { color: var(--brown); font-size: 12px; font-weight: 600; }
    .menu a { padding: 10px 12px; border-radius: 12px; font-weight: 500; }
    .menu a.on { background: var(--tint); color: var(--primary); font-weight: 700; }
    .out { margin-top: 8px; border: 0; background: transparent; color: var(--danger); text-align: left; padding: 10px 12px; font-weight: 600; }
    .content { min-width: 0; }
    @media (max-width: 900px) {
      .wrap { grid-template-columns: 1fr; padding-top: 20px; }
      .menu { flex-direction: row; overflow-x: auto; }
      .menu a { white-space: nowrap; }
      .who { display: none; }
    }
  `
})
export class AccountShell {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  protected readonly tier = signal('');
  readonly items = [
    {label: 'Thông tin cá nhân', link: '/account'},
    {label: 'Đơn hàng của tôi', link: '/account/orders'},
    {label: 'Sổ địa chỉ', link: '/account/addresses'},
    {label: 'Sản phẩm yêu thích', link: '/account/wishlist'},
    {label: 'Điểm thưởng', link: '/account/rewards'},
    {label: 'Đánh giá của tôi', link: '/account/reviews'}
  ];

  constructor() {
    // tier label is decorative; ignore failures
    this.api.get<LoyaltySummary>('/loyalty/summary').then(s => this.tier.set(s.tier.label), () => undefined);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
