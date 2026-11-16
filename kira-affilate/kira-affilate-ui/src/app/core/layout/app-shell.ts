import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthStore} from '../auth/auth.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'(document:keydown.escape)': 'drawerOpen.set(false)'}
})
export class AppShell {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly drawerOpen = signal(false);

  protected readonly nav = [
    {path: 'dashboard', label: 'Tổng quan'},
    {path: 'convert', label: 'Chuyển đổi liên kết'},
    {path: 'links', label: 'Quản lý liên kết'},
    {path: 'analytics', label: 'Thống kê'},
    {path: 'orders', label: 'Đơn hàng & Hoa hồng'},
    {path: 'offers', label: 'Sản phẩm & Chiến dịch'},
    {path: 'guides', label: 'Hướng dẫn Affiliate'},
    {path: 'tax', label: 'Thuế & Thu nhập'},
    {path: 'legal', label: 'Pháp luật Việt Nam'},
    {path: 'settings', label: 'Cài đặt'}
  ];

  protected logout(): void {
    this.auth.logout().subscribe({complete: () => this.toLogin(), error: () => this.toLogin()});
  }

  private toLogin(): void {
    void this.router.navigateByUrl('/login');
  }
}
