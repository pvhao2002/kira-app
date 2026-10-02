import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {apiResource} from '../core/api';
import {AuthStore} from '../core/auth.store';
import {type LoyaltySummary, valueOr} from '../features/account/account.data';

@Component({
  selector: 'app-account-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-shell.html',
  styleUrl: './account-shell.css'
})
export class AccountShell {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  // decorative: while loading or on failure the tier label is simply empty
  private readonly summary = apiResource<LoyaltySummary>(() => ({path: '/loyalty/summary'}));
  protected readonly tier = computed(() => valueOr(this.summary, null)?.tier.label ?? '');
  protected readonly loggingOut = signal(false);
  readonly items = [
    {label: 'Thông tin cá nhân', link: '/account'},
    {label: 'Đơn hàng của tôi', link: '/account/orders'},
    {label: 'Sổ địa chỉ', link: '/account/addresses'},
    {label: 'Sản phẩm yêu thích', link: '/account/wishlist'},
    {label: 'Điểm thưởng', link: '/account/rewards'},
    {label: 'Đánh giá của tôi', link: '/account/reviews'}
  ];

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
      await this.router.navigate(['/']);
    } finally {
      this.loggingOut.set(false);
    }
  }
}
