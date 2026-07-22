import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthStore} from '../auth/auth.store';
import {ToastService} from '../services/toast.service';

interface NavItem {
  label: string;
  icon: string;
  path: string
}

interface NavGroup {
  label: string;
  flow: 'credit' | 'investment' | 'system';
  items: NavItem[]
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `<div class="app-layout" [class.sidebar-open]="menuOpen()"><aside><a routerLink="/app" class="brand"><span class="brand-mark">K</span>Kira Bank</a><button class="close-menu" (click)="menuOpen.set(false)" aria-label="Đóng menu">×</button><nav class="side-nav"><a routerLink="/app" [routerLinkActiveOptions]="{exact:true}" routerLinkActive="active"><span>⌂</span>Tổng quan</a>@for(group of nav;track group.label){<div class="nav-group"><small [class]="group.flow">{{group.label}}</small>@for(item of group.items;track item.path){<a [routerLink]="item.path" routerLinkActive="active" (click)="menuOpen.set(false)"><span>{{item.icon}}</span>{{item.label}}</a>}</div>}</nav><div class="secure-note"><span>◈</span><div><b>Kết nối bảo mật</b><small>Dữ liệu được bảo vệ</small></div></div></aside><div class="page-area"><header class="topbar"><button class="menu-button" (click)="menuOpen.set(true)" aria-label="Mở menu">☰</button><div class="global-search">⌕ <input placeholder="Tìm giao dịch, sao kê, nhiệm vụ…" aria-label="Tìm kiếm toàn cục"><kbd>⌘ K</kbd></div><div class="top-actions"><button (click)="cycleTheme()" [attr.aria-label]="'Theme '+theme()">{{themeIcon()}}</button><a routerLink="/app/notifications" aria-label="Thông báo">♢<i></i></a><button class="avatar" (click)="userMenu.set(!userMenu())">{{initials()}}</button></div>@if(userMenu()){<div class="user-menu"><b>{{auth.user()?.fullName}}</b><small>{{auth.user()?.email}}</small><a routerLink="/app/profile">Hồ sơ cá nhân</a><button (click)="logout()">Đăng xuất</button></div>}</header><main class="app-main"><router-outlet /></main></div>@if(menuOpen()){<button class="overlay" (click)="menuOpen.set(false)" aria-label="Đóng menu"></button>}@if(toast.current();as t){<div class="toast" [class]="t.kind">{{t.message}}</div>}</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShell {
  readonly auth = inject(AuthStore);
  readonly toast = inject(ToastService);
  private router = inject(Router);
  readonly menuOpen = signal(false);
  readonly userMenu = signal(false);
  readonly theme = signal<'light' | 'dark' | 'system'>((localStorage.getItem('kira-theme') as 'light' | 'dark' | 'system') || 'system');
  readonly themeIcon = computed(() => this.theme() === 'dark' ? '☾' : this.theme() === 'light' ? '☀' : '◐');
  readonly initials = computed(() => this.auth.user()?.fullName.split(' ').slice(-2).map(x => x[0]).join('').toUpperCase() ?? 'KB');
  readonly nav: NavGroup[] = [{
    label: 'THẺ TÍN DỤNG',
    flow: 'credit',
    items: [{label: 'Dashboard', icon: '▦', path: '/app/credit-card/dashboard'}, {
      label: 'Thẻ của tôi',
      icon: '▭',
      path: '/app/credit-cards'
    }, {label: 'Giao dịch', icon: '↔', path: '/app/card-transactions'}, {
      label: 'Sao kê',
      icon: '▤',
      path: '/app/statements'
    }, {label: 'Thanh toán', icon: '✓', path: '/app/payments'}, {
      label: 'Cashback',
      icon: '◇',
      path: '/app/cashbacks'
    }, {label: 'Hóa đơn chiết khấu', icon: '%', path: '/app/discount-invoices'}]
  }, {
    label: 'ĐẦU TƯ WEBSITE',
    flow: 'investment',
    items: [{label: 'Dashboard', icon: '▦', path: '/app/investment/dashboard'}, {
      label: 'Tài khoản',
      icon: '◉',
      path: '/app/investment/accounts'
    }, {label: 'Nạp tiền', icon: '↓', path: '/app/investment/deposits'}, {
      label: 'Nhiệm vụ',
      icon: '☷',
      path: '/app/investment/tasks'
    }, {label: 'Reward', icon: '☆', path: '/app/investment/rewards'}, {
      label: 'Rút tiền',
      icon: '↑',
      path: '/app/investment/withdrawals'
    }, {label: 'Ledger', icon: '≡', path: '/app/investment/ledger'}]
  }, {
    label: 'HỆ THỐNG',
    flow: 'system',
    items: [{label: 'Thông báo', icon: '♢', path: '/app/notifications'}, {
      label: 'Cài đặt',
      icon: '⚙',
      path: '/app/settings'
    }]
  }];

  constructor() {
    this.applyTheme();
  }

  cycleTheme(): void {
    const next = this.theme() === 'system' ? 'light' : this.theme() === 'light' ? 'dark' : 'system';
    this.theme.set(next);
    localStorage.setItem('kira-theme', next);
    this.applyTheme();
  }

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/'));
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.theme();
  }
}

