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
  readonly nav = computed<NavGroup[]>(() => {
    const groups: NavGroup[] = [
      {
        labelKey: 'shell.groupCredit', flow: 'credit', items: [
          {labelKey: 'shell.dashboard', icon: '▦', path: '/app/credit-card/dashboard'},
          {labelKey: 'shell.myCards', icon: '▭', path: '/app/credit-cards'},
          {labelKey: 'shell.banks', icon: '🏦', path: '/app/banks'}
        ]
      },
      {
        labelKey: 'shell.groupInvestment', flow: 'investment', items: [
          {labelKey: 'shell.dashboard', icon: '▦', path: '/app/investment/dashboard'},
          {labelKey: 'shell.accounts', icon: '◉', path: '/app/investment/accounts'},
          {labelKey: 'shell.addTransaction', icon: '＋', path: '/app/investment/add-transaction'}
        ]
      }
    ];

    if (this.auth.admin()) {
      groups.push({
        labelKey: 'shell.groupAdmin', flow: 'system', items: [
          {labelKey: 'shell.adminUsers', icon: '👥', path: '/app/admin/users'},
          {labelKey: 'shell.adminBanks', icon: '🏦', path: '/app/admin/banks'}
        ]
      });
    }

    groups.push({
      labelKey: 'shell.groupSystem', flow: 'system', items: [
        {labelKey: 'shell.notifications', icon: '♢', path: '/app/notifications'},
        {labelKey: 'shell.settings', icon: '⚙', path: '/app/settings'}
      ]
    });

    return groups;
  });
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
