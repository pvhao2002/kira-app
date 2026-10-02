import {ChangeDetectionStrategy, Component, computed, effect, inject} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthStore} from '../core/auth.store';
import {BranchStore} from '../core/branch.store';
import {AppLogo} from '../shared/logo';

@Component({
  selector: 'app-admin-shell',
  imports: [AppLogo, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css'
})
export class AdminShell {
  readonly auth = inject(AuthStore);
  readonly branch = inject(BranchStore);
  private readonly router = inject(Router);

  /** Staff/managers only see the branches they are assigned to; admin sees all. */
  readonly allowed = computed(() => this.auth.allowedBranches());
  readonly nav = computed(() => [
    {label: 'Tổng quan', link: '/admin', exact: true},
    {label: 'Đơn hàng', link: '/admin/orders'},
    {label: 'Sản phẩm', link: '/admin/products'},
    {label: 'Kho hàng', link: '/admin/inventory'},
    {label: 'Khách hàng', link: '/admin/customers'},
    {label: 'Khuyến mãi', link: '/admin/promotions'},
    {label: 'Chi nhánh', link: '/admin/branches'},
    ...(this.auth.user()?.role === 'admin' ? [{label: 'Người dùng', link: '/admin/users'}] : [])
  ]);

  constructor() {
    // Keep the working branch inside the user's assignment (e.g. staff of Q3 must not start on Q7).
    effect(() => {
      const ok = this.allowed();
      if (ok.length && !ok.includes(this.branch.index())) this.branch.select(ok[0]);
    });
  }

  pick(ev: Event): void {
    this.branch.select(Number((ev.target as HTMLSelectElement).value));
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
