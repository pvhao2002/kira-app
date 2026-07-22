import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthStore} from '../auth/auth.store';
import {ToastService} from '../services/toast.service';

interface NavItem { label: string; icon: string; path: string }
interface NavGroup { label: string; flow: 'credit' | 'investment' | 'system'; items: NavItem[] }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShell {
  readonly auth = inject(AuthStore);
  readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);
  readonly userMenu = signal(false);
  readonly theme = signal<'light' | 'dark' | 'system'>((localStorage.getItem('kira-theme') as 'light' | 'dark' | 'system') || 'system');
  readonly themeIcon = computed(() => this.theme() === 'dark' ? '☾' : this.theme() === 'light' ? '☀' : '◐');
  readonly initials = computed(() => this.auth.user()?.fullName.split(' ').slice(-2).map(part => part[0]).join('').toUpperCase() ?? 'KB');
  readonly nav: NavGroup[] = [
    {label: 'THẺ TÍN DỤNG', flow: 'credit', items: [
      {label: 'Dashboard', icon: '▦', path: '/app/credit-card/dashboard'}, {label: 'Thẻ của tôi', icon: '▭', path: '/app/credit-cards'},
      {label: 'Giao dịch', icon: '↔', path: '/app/card-transactions'}, {label: 'Sao kê', icon: '▤', path: '/app/statements'},
      {label: 'Thanh toán', icon: '✓', path: '/app/payments'}, {label: 'Cashback', icon: '◇', path: '/app/cashbacks'},
      {label: 'Hóa đơn chiết khấu', icon: '%', path: '/app/discount-invoices'}
    ]},
    {label: 'ĐẦU TƯ WEBSITE', flow: 'investment', items: [
      {label: 'Dashboard', icon: '▦', path: '/app/investment/dashboard'}, {label: 'Tài khoản', icon: '◉', path: '/app/investment/accounts'},
      {label: 'Nạp tiền', icon: '↓', path: '/app/investment/deposits'}, {label: 'Nhiệm vụ', icon: '☷', path: '/app/investment/tasks'},
      {label: 'Reward', icon: '☆', path: '/app/investment/rewards'}, {label: 'Rút tiền', icon: '↑', path: '/app/investment/withdrawals'},
      {label: 'Ledger', icon: '≡', path: '/app/investment/ledger'}
    ]},
    {label: 'HỆ THỐNG', flow: 'system', items: [
      {label: 'Thông báo', icon: '♢', path: '/app/notifications'}, {label: 'Cài đặt', icon: '⚙', path: '/app/settings'}
    ]}
  ];

  constructor() { this.applyTheme(); }

  cycleTheme(): void {
    const next = this.theme() === 'system' ? 'light' : this.theme() === 'light' ? 'dark' : 'system';
    this.theme.set(next);
    localStorage.setItem('kira-theme', next);
    this.applyTheme();
  }

  logout(): void { this.auth.logout().subscribe(() => this.router.navigateByUrl('/')); }
  private applyTheme(): void { document.documentElement.dataset['theme'] = this.theme(); }
}
