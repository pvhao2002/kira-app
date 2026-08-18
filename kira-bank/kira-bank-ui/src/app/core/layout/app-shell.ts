import {ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, HostListener, inject, signal, viewChild} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, map, Observable, of, Subject, switchMap} from 'rxjs';
import {AuthStore} from '../auth/auth.store';
import {LanguageService} from '../i18n/language.service';
import {TranslationKey} from '../i18n/translations';
import {ApiService} from '../services/api.service';
import {ToastService} from '../services/toast.service';
import {LanguageSwitcherComponent} from '../../shared/language-switcher/language-switcher';
import {IconComponent, IconName} from '../../shared/icon/icon';
import {PageResponse, UserCreditCard} from '../../shared/models/api.models';

interface NavItem {
  labelKey: TranslationKey;
  icon: IconName;
  path: string
}

interface NavGroup {
  labelKey: TranslationKey;
  flow: 'credit' | 'investment' | 'system';
  items: NavItem[]
}

type SearchResultGroup = 'pages' | 'cards' | 'banks' | 'accounts';

interface GlobalSearchResult {
  id: string;
  group: SearchResultGroup;
  title: string;
  subtitle: string;
  icon: IconName;
  imageUrl?: string | null;
  path: string;
  filtered: boolean;
}

interface GlobalSearchGroup {
  key: TranslationKey;
  results: GlobalSearchResult[];
}

interface InvestmentAccountSearchRow {
  id: number;
  accountCode: string | null;
  accountName: string;
  accountUsername: string | null;
}

interface SearchBatch<T> {
  items: T[];
  failed: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LanguageSwitcherComponent, IconComponent],
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
  readonly themeIcon = computed<IconName>(() => this.theme() === 'dark' ? 'moon' : this.theme() === 'light' ? 'sun' : 'monitor');
  readonly globalSearchInput = viewChild<ElementRef<HTMLInputElement>>('globalSearchInput');
  readonly globalSearchRoot = viewChild<ElementRef<HTMLElement>>('globalSearchRoot');
  readonly mobileSearchTrigger = viewChild<ElementRef<HTMLButtonElement>>('mobileSearchTrigger');
  readonly avatarButton = viewChild<ElementRef<HTMLButtonElement>>('avatarButton');
  readonly userMenuPanel = viewChild<ElementRef<HTMLElement>>('userMenuPanel');
  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly searchLoading = signal(false);
  readonly searchPartialError = signal(false);
  readonly selectedSearchIndex = signal(-1);
  readonly remoteSearchResults = signal<GlobalSearchResult[]>([]);
  readonly initials = computed(() => this.auth.user()?.fullName.split(' ').slice(-2).map(part => part[0]).join('').toUpperCase() ?? 'KB');
  readonly themeLabel = computed(() => this.i18n.t(`theme.${this.theme()}`));
  readonly nav = computed<NavGroup[]>(() => {
    const groups: NavGroup[] = [
      {
        labelKey: 'shell.groupCredit', flow: 'credit', items: [
          {labelKey: 'shell.dashboard', icon: 'dashboard', path: '/app/credit-card/dashboard'},
          {labelKey: 'shell.myCards', icon: 'card', path: '/app/credit-cards'},
          {labelKey: 'shell.banks', icon: 'bank', path: '/app/banks'}
        ]
      },
      {
        labelKey: 'shell.groupInvestment', flow: 'investment', items: [
          {labelKey: 'shell.accounts', icon: 'account', path: '/app/investment/accounts'},
          {labelKey: 'shell.investmentTransactions', icon: 'receipt', path: '/app/investment/transactions'}
        ]
      }
    ];

    if (this.auth.admin()) {
      groups.push({
        labelKey: 'shell.groupAdmin', flow: 'system', items: [
          {labelKey: 'shell.adminUsers', icon: 'users', path: '/app/admin/users'},
          {labelKey: 'shell.adminBanks', icon: 'bank', path: '/app/admin/banks'}
        ]
      });
    }

    groups.push({
      labelKey: 'shell.groupSystem', flow: 'system', items: [
        {labelKey: 'shell.notifications', icon: 'bell', path: '/app/notifications'},
        {labelKey: 'shell.settings', icon: 'settings', path: '/app/settings'}
      ]
    });

    return groups;
  });
  readonly pageSearchResults = computed<GlobalSearchResult[]>(() => {
    const pages = [
      {labelKey: 'shell.overview' as TranslationKey, icon: 'home' as IconName, path: '/app'},
      ...this.nav().flatMap(group => group.items),
      {labelKey: 'shell.profile' as TranslationKey, icon: 'account' as IconName, path: '/app/profile'}
    ];
    const query = this.normalizedSearchQuery();

    return pages
      .map((page, index) => ({
        id: `search-page-${index}`,
        group: 'pages' as const,
        title: this.i18n.t(page.labelKey),
        subtitle: this.i18n.t('shell.searchOpenPage'),
        icon: page.icon,
        path: page.path,
        filtered: false
      }))
      .filter(page => !query || this.normalize(page.title).includes(query));
  });
  readonly searchGroups = computed<GlobalSearchGroup[]>(() => {
    const all = [...this.pageSearchResults(), ...this.remoteSearchResults()];
    const definitions: Array<{group: SearchResultGroup; key: TranslationKey}> = [
      {group: 'pages', key: 'shell.searchGroupPages'},
      {group: 'cards', key: 'shell.searchGroupCards'},
      {group: 'banks', key: 'shell.searchGroupBanks'},
      {group: 'accounts', key: 'shell.searchGroupAccounts'}
    ];

    return definitions
      .map(definition => ({
        key: definition.key,
        results: all.filter(result => result.group === definition.group)
      }))
      .filter(group => group.results.length > 0);
  });
  readonly selectableSearchResults = computed(() => this.searchGroups().flatMap(group => group.results));
  readonly activeSearchDescendant = computed(() => {
    const result = this.selectableSearchResults()[this.selectedSearchIndex()];
    return result?.id ?? null;
  });
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  private readonly mobileHeader = window.matchMedia('(max-width: 680px)');
  private readonly systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemThemeListener = () => {
    if (this.theme() === 'system') {
      this.applyTheme();
    }
  };

  constructor() {
    this.systemTheme.addEventListener('change', this.systemThemeListener);
    this.applyTheme();
    this.searchChanges.pipe(
      map(query => query.trim()),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) {
          this.remoteSearchResults.set([]);
          this.searchLoading.set(false);
          this.searchPartialError.set(false);
          return of(null);
        }
        this.searchLoading.set(true);
        this.searchPartialError.set(false);
        return this.loadRemoteSearch(query).pipe(finalize(() => this.searchLoading.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      if (!response || response.query !== this.searchQuery().trim()) return;
      this.remoteSearchResults.set(response.results);
      this.searchPartialError.set(response.failed);
      this.selectedSearchIndex.set(-1);
    });
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
    this.openGlobalSearch();
  }

  @HostListener('document:mousedown', ['$event'])
  closeTransientUiFromOutside(event: MouseEvent): void {
    const target = event.target as Node;
    const searchRoot = this.globalSearchRoot()?.nativeElement;
    const accountPanel = this.userMenuPanel()?.nativeElement;
    const avatar = this.avatarButton()?.nativeElement;

    if (this.searchOpen() && searchRoot && !searchRoot.contains(target)) {
      this.searchOpen.set(false);
      this.selectedSearchIndex.set(-1);
    }
    if (this.userMenu() && !accountPanel?.contains(target) && !avatar?.contains(target)) {
      this.userMenu.set(false);
    }
  }

  openGlobalSearch(): void {
    this.menuOpen.set(false);
    this.userMenu.set(false);
    this.searchOpen.set(true);
    requestAnimationFrame(() => this.globalSearchInput()?.nativeElement.focus());
  }

  closeMobileSearch(): void {
    this.closeGlobalSearch(true, true);
  }

  openNavigationMenu(): void {
    this.closeGlobalSearch(false);
    this.userMenu.set(false);
    this.menuOpen.set(true);
  }

  toggleUserMenu(): void {
    if (this.userMenu()) {
      this.userMenu.set(false);
      return;
    }
    this.searchOpen.set(false);
    this.selectedSearchIndex.set(-1);
    this.menuOpen.set(false);
    this.userMenu.set(true);
  }

  updateGlobalSearch(value: string): void {
    this.searchQuery.set(value);
    this.searchOpen.set(true);
    this.selectedSearchIndex.set(-1);
    if (value.trim().length < 2) {
      this.remoteSearchResults.set([]);
      this.searchPartialError.set(false);
    }
    this.searchChanges.next(value);
  }

  handleGlobalSearchKeydown(event: KeyboardEvent): void {
    const results = this.selectableSearchResults();
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeGlobalSearch(true, this.mobileHeader.matches);
      return;
    }
    if (!results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.searchOpen.set(true);
      this.selectedSearchIndex.update(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.searchOpen.set(true);
      this.selectedSearchIndex.update(index => index <= 0 ? results.length - 1 : index - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[this.selectedSearchIndex() < 0 ? 0 : this.selectedSearchIndex()];
      if (selected) this.selectSearchResult(selected);
    }
  }

  selectSearchResult(result: GlobalSearchResult): void {
    const search = this.searchQuery().trim();
    this.closeGlobalSearch(true);
    void this.router.navigate([result.path], {
      queryParams: result.filtered && search ? {search} : undefined
    });
  }

  isSearchResultSelected(result: GlobalSearchResult): boolean {
    return this.selectableSearchResults()[this.selectedSearchIndex()]?.id === result.id;
  }

  hideBrokenSearchImage(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/'));
  }

  @HostListener('document:keydown.escape', ['$event'])
  closeTransientUiFromEscape(event: Event): void {
    if (this.searchOpen()) {
      event.preventDefault();
      this.closeGlobalSearch(true, this.mobileHeader.matches);
      return;
    }
    if (this.userMenu()) {
      event.preventDefault();
      this.userMenu.set(false);
      requestAnimationFrame(() => this.avatarButton()?.nativeElement.focus());
      return;
    }
    if (this.menuOpen()) {
      event.preventDefault();
      this.menuOpen.set(false);
    }
  }

  private closeGlobalSearch(clear: boolean, restoreMobileFocus = false): void {
    this.searchOpen.set(false);
    this.selectedSearchIndex.set(-1);
    if (clear) {
      this.searchQuery.set('');
      this.remoteSearchResults.set([]);
      this.searchPartialError.set(false);
      this.searchChanges.next('');
      this.globalSearchInput()?.nativeElement.blur();
    }
    if (restoreMobileFocus) {
      requestAnimationFrame(() => this.mobileSearchTrigger()?.nativeElement.focus());
    }
  }

  private loadRemoteSearch(query: string): Observable<{query: string; results: GlobalSearchResult[]; failed: boolean}> {
    const safe = <T>(request: Observable<PageResponse<T>>): Observable<SearchBatch<T>> => request.pipe(
      map(response => ({items: response.data, failed: false})),
      catchError(() => of({items: [] as T[], failed: true}))
    );

    return forkJoin({
      cards: safe(this.api.page<UserCreditCard>('credit-cards', 0, 5, query)),
      banks: safe(this.api.banks(query, 0, 5)),
      accounts: safe(this.api.page<InvestmentAccountSearchRow>('investment/accounts', 0, 5, query))
    }).pipe(map(({cards, banks, accounts}) => ({
      query,
      failed: cards.failed || banks.failed || accounts.failed,
      results: [
        ...cards.items.map(card => ({
          id: `search-card-${card.id}`,
          group: 'cards' as const,
          title: card.nickname,
          subtitle: [card.bankName, card.lastFour ? `•••• ${card.lastFour}` : ''].filter(Boolean).join(' · '),
          icon: 'card' as IconName,
          imageUrl: card.bankLogoUrl,
          path: '/app/credit-cards',
          filtered: true
        })),
        ...banks.items.map(bank => ({
          id: `search-bank-${bank.id}`,
          group: 'banks' as const,
          title: bank.shortName || bank.name,
          subtitle: [bank.code, bank.name].filter(Boolean).join(' · '),
          icon: 'bank' as IconName,
          imageUrl: bank.logoUrl,
          path: '/app/banks',
          filtered: true
        })),
        ...accounts.items.map(account => ({
          id: `search-account-${account.id}`,
          group: 'accounts' as const,
          title: account.accountName,
          subtitle: [account.accountCode, account.accountUsername].filter(Boolean).join(' · '),
          icon: 'account' as IconName,
          path: '/app/investment/accounts',
          filtered: true
        }))
      ]
    })));
  }

  private normalizedSearchQuery(): string {
    return this.normalize(this.searchQuery().trim());
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private applyTheme(): void {
    const preference = this.theme();
    document.documentElement.dataset['theme'] =
      preference === 'system' ? (this.systemTheme.matches ? 'dark' : 'light') : preference;
  }
}
