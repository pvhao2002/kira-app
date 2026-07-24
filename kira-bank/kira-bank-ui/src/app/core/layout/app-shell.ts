import {ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, signal, viewChild} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthStore} from '../auth/auth.store';
import {LanguageService} from '../i18n/language.service';
import {TranslationKey} from '../i18n/translations';
import {ToastService} from '../services/toast.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';

interface NavItem {
  labelKey: TranslationKey;
  icon: string;
  path: string
}

interface NavGroup {
  labelKey: TranslationKey;
  flow: 'credit' | 'investment' | 'system';
  items: NavItem[]
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LanguageSwitcherComponent],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShell {
  readonly auth = inject(AuthStore);
  readonly i18n = inject(LanguageService);
  readonly toast = inject(ToastService);
  readonly menuOpen = signal(false);
  readonly userMenu = signal(false);
  readonly theme = signal<'light' | 'dark' | 'system'>((localStorage.getItem('kira-theme') as 'light' | 'dark' | 'system') || 'system');
  readonly themeIcon = computed(() => this.theme() === 'dark' ? '☾' : this.theme() === 'light' ? '☀' : '◐');
  readonly globalSearchInput = viewChild<ElementRef<HTMLInputElement>>('globalSearchInput');
  readonly initials = computed(() => this.auth.user()?.fullName.split(' ').slice(-2).map(part => part[0]).join('').toUpperCase() ?? 'KB');
  readonly nav: NavGroup[] = [
    {
      labelKey: 'shell.groupCredit', flow: 'credit', items: [
        {labelKey: 'shell.dashboard', icon: '▦', path: '/app/credit-card/dashboard'}, {
          labelKey: 'shell.myCards',
          icon: '▭',
          path: '/app/credit-cards'
        },
        {labelKey: 'shell.transactions', icon: '↔', path: '/app/card-transactions'}, {
          labelKey: 'shell.statements',
          icon: '▤',
          path: '/app/statements'
        },
        {labelKey: 'shell.payments', icon: '✓', path: '/app/payments'}, {labelKey: 'shell.cashback', icon: '◇', path: '/app/cashbacks'},
        {labelKey: 'shell.discountInvoices', icon: '%', path: '/app/discount-invoices'}
      ]
    },
    {
      labelKey: 'shell.groupInvestment', flow: 'investment', items: [
        {labelKey: 'shell.dashboard', icon: '▦', path: '/app/investment/dashboard'}, {
          labelKey: 'shell.accounts',
          icon: '◉',
          path: '/app/investment/accounts'
        },
        {labelKey: 'shell.deposits', icon: '↓', path: '/app/investment/deposits'}, {
          labelKey: 'shell.tasks',
          icon: '☷',
          path: '/app/investment/tasks'
        },
        {labelKey: 'shell.rewards', icon: '☆', path: '/app/investment/rewards'}, {
          labelKey: 'shell.withdrawals',
          icon: '↑',
          path: '/app/investment/withdrawals'
        },
        {labelKey: 'shell.ledger', icon: '≡', path: '/app/investment/ledger'}
      ]
    },
    {
      labelKey: 'shell.groupSystem', flow: 'system', items: [
        {labelKey: 'shell.notifications', icon: '♢', path: '/app/notifications'}, {
          labelKey: 'shell.settings',
          icon: '⚙',
          path: '/app/settings'
        }
      ]
    }
  ];
  private readonly router = inject(Router);
  private readonly systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemThemeListener = () => {
    if (this.theme() === 'system') {
      this.applyTheme();
    }
  };

  constructor() {
    this.systemTheme.addEventListener('change', this.systemThemeListener);
    this.applyTheme();
  }

  ngOnDestroy(): void {
    this.systemTheme.removeEventListener('change', this.systemThemeListener);
  }

  cycleTheme(): void {
    const next = this.theme() === 'system' ? 'light' : this.theme() === 'light' ? 'dark' : 'system';
    this.theme.set(next);
    localStorage.setItem('kira-theme', next);
    this.applyTheme();
  }

  @HostListener('document:keydown', ['$event'])
  focusGlobalSearch(event: KeyboardEvent): void {
    const target = event.target;
    const isEditing = target instanceof HTMLElement
      && target.matches('input, textarea, select, [contenteditable="true"]');

    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || isEditing) {
      return;
    }

    event.preventDefault();
    this.globalSearchInput()?.nativeElement.focus();
  }

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/'));
  }

  private applyTheme(): void {
    const preference = this.theme();
    document.documentElement.dataset['theme'] =
      preference === 'system' ? (this.systemTheme.matches ? 'dark' : 'light') : preference;
  }
}
