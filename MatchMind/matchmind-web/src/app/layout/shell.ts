import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { LiveService } from '../core/live.service';
import { PageTitle } from '../core/page-title';
import { tzLabel } from '../shared/format';

interface NavItem { path: string; label: string; icon: string; adminOnly?: boolean; }

const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'pi-th-large' },
  { path: '/matches', label: 'Matches', icon: 'pi-calendar' },
  { path: '/predictions', label: 'Predictions', icon: 'pi-bolt' },
  { path: '/models', label: 'AI Models', icon: 'pi-microchip-ai' },
  { path: '/providers', label: 'Providers', icon: 'pi-server' },
  { path: '/reports', label: 'Reports', icon: 'pi-chart-bar' },
  { path: '/account', label: 'Account Management', icon: 'pi-wallet' },
  { path: '/prompts', label: 'Prompt Notes', icon: 'pi-file-edit' },
  { path: '/import', label: 'Import', icon: 'pi-upload', adminOnly: true },
  { path: '/api-logs', label: 'API Logs', icon: 'pi-list', adminOnly: true },
  { path: '/settings', label: 'Settings', icon: 'pi-cog' },
];

const MOBILE_MAX = 900;   // keep in step with the drawer breakpoint in styles.scss

@Component({
  selector: 'mm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'onResize()' },
  template: `
    <div class="shell" [class.nav-collapsed]="compact()" [class.nav-open]="mobileOpen()" (keydown.escape)="closeNav(true)">
      <button type="button" class="skip-link" (click)="mainEl.focus()">Skip to content</button>
      <aside id="mm-sidebar" class="sidebar" aria-label="Main navigation" (keydown)="trapTab($event)">
        <a routerLink="/dashboard" class="brand">
          <span class="brand-mark" aria-hidden="true">M</span>
          @if (!compact()) { <span class="brand-text"><strong>MatchMind</strong><small>Private workspace</small></span> }
        </a>
        <nav>
          @for (item of nav; track item.path) {
            @if (!item.adminOnly || auth.isAdmin()) {
            <a [routerLink]="item.path" routerLinkActive="active" ariaCurrentWhenActive="page" class="nav-link"
               [attr.title]="compact() ? item.label : null" [attr.aria-label]="compact() ? item.label : null" (click)="closeNav(false)">
              <i class="pi {{ item.icon }}" aria-hidden="true"></i>
              @if (!compact()) { <span>{{ item.label }}</span> }
            </a>
            }
          }
          @if (auth.isAdmin()) {
            <!-- Grafana logs and Swagger: full pages outside the SPA, signed in by the cookie monitorSession() sets. -->
            <a href="/monitor/" target="_blank" class="nav-link" (click)="openAdminPage($event, '/monitor/')"
               [attr.title]="compact() ? 'Monitor' : null" [attr.aria-label]="compact() ? 'Monitor (opens a new tab)' : null">
              <i class="pi pi-chart-line" aria-hidden="true"></i>
              @if (!compact()) { <span>Monitor</span> }
            </a>
            <a href="/swagger/index.html" target="_blank" class="nav-link" (click)="openAdminPage($event, '/swagger/index.html')"
               [attr.title]="compact() ? 'API Docs' : null" [attr.aria-label]="compact() ? 'API Docs (opens a new tab)' : null">
              <i class="pi pi-book" aria-hidden="true"></i>
              @if (!compact()) { <span>API Docs</span> }
            </a>
          }
        </nav>
        <button type="button" class="collapse-btn" (click)="toggle()" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
          <i class="pi" aria-hidden="true" [class.pi-angle-double-left]="!collapsed()" [class.pi-angle-double-right]="collapsed()"></i>
        </button>
      </aside>
      <div class="scrim" (click)="closeNav(true)"></div>
      <!-- While the drawer is open the page behind it is inert: no focus, no screen-reader browsing. -->
      <div class="main" [attr.inert]="mobileOpen() ? '' : null">
        <header class="topbar">
          <button #menuBtn type="button" class="btn btn-text btn-icon menu-btn" aria-label="Open navigation" aria-controls="mm-sidebar"
            [attr.aria-expanded]="mobileOpen()" (click)="openNav()"><i class="pi pi-bars" aria-hidden="true"></i></button>
          <h1 #pageTitle class="page-title" tabindex="-1">{{ heading() }}</h1>
          <div class="topbar-right">
            <span class="tz-chip" [title]="tzNote">{{ tz }}</span><span class="sr-only">{{ tzNote }}</span>
            <span class="user-chip"><span class="avatar" aria-hidden="true">{{ auth.user()?.username?.charAt(0) }}</span><span class="user-name">{{ auth.user()?.username }}</span><small>{{ auth.user()?.role === 'ADMIN' ? 'Admin' : 'Viewer' }}</small></span>
            <button type="button" class="btn btn-text btn-sm" aria-label="Sign out" (click)="auth.logout()"><i class="pi pi-sign-out" aria-hidden="true"></i><span class="label">Sign out</span></button>
          </div>
        </header>
        <main class="content" #mainEl tabindex="-1"><router-outlet /></main>
      </div>
      <div class="sr-only" aria-live="polite">{{ announced() }}</div>
    </div>`,
})
export class Shell {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly live = inject(LiveService); // the shell exists only while signed in: listen for new predictions
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly menuBtn = viewChild.required<ElementRef<HTMLElement>>('menuBtn');
  private readonly pageTitle = viewChild.required<ElementRef<HTMLElement>>('pageTitle');
  readonly nav = NAV;
  readonly tz = tzLabel();
  readonly tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly tzNote = `Times are shown in your time zone (${this.tzName})`;
  readonly collapsed = signal(Shell.storedCollapsed());
  private readonly narrow = signal(innerWidth <= MOBILE_MAX);
  /** The icon-only rail is a desktop state: the mobile drawer always shows labels (its collapse button is hidden). */
  readonly compact = computed(() => this.collapsed() && !this.narrow());
  readonly mobileOpen = signal(false);
  /** Polite live region: the new page's name after a route change (UX-123). */
  readonly announced = signal('');
  readonly title = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.routeTitle()), startWith(this.routeTitle())),
    { requireSync: true });
  private readonly page = inject(PageTitle);
  /** The name a detail page gives itself (UX-005), else the route title. */
  readonly heading = computed(() => this.page.value() || this.title());

  constructor() {
    // A new page (not a query-only change such as a filter or a tab): focus its heading and announce it.
    // The shell is built during the first navigation into it: that one is the initial load, not a page change.
    let path: string | null = null;
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(e => {
      const next = Shell.path(e.urlAfterRedirects);
      const first = path === null;
      if (next === path) return;
      path = next;
      this.page.value.set(null);   // the previous page's own name does not carry over
      if (first) return;
      this.announced.set(this.routeTitle());
      afterNextRender(() => this.pageTitle().nativeElement.focus({ preventScroll: true }), { injector: this.injector });
    });
  }

  /** Opens the tab at once (inside the click, so no popup blocker), then points it at the page once the cookie is set. */
  openAdminPage(e: Event, url: string): void {
    e.preventDefault();
    this.closeNav(false);
    const tab = window.open('', '_blank');
    if (!tab) return;
    tab.opener = null;
    this.api.monitorSession().subscribe({
      next: () => { tab.location.href = url; },
      error: () => tab.close(),   // the error interceptor already shows why
    });
  }

  toggle(): void {
    this.collapsed.update(v => !v);
    try { localStorage.setItem('matchmind.nav-collapsed', String(this.collapsed())); } catch { /* optional */ }
  }

  openNav(): void {
    this.mobileOpen.set(true);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#mm-sidebar a[href]')?.focus(), { injector: this.injector });
  }

  /** `returnFocus`: Esc or the scrim; a nav link instead leads to a new page, whose heading takes focus. */
  closeNav(returnFocus: boolean): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    if (returnFocus) this.menuBtn().nativeElement.focus();
  }

  /** Keeps Tab inside the open drawer (its focusable items are links; the collapse button is hidden on mobile). */
  trapTab(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !this.mobileOpen()) return;
    const links = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('a[href]')];
    const edge = e.shiftKey ? links[0] : links.at(-1);
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? links.at(-1) : links[0])?.focus();
  }

  /** Rotating or widening past the breakpoint hides the drawer; it must not leave the page inert. */
  onResize(): void {
    this.narrow.set(innerWidth <= MOBILE_MAX);
    if (this.mobileOpen() && innerWidth > MOBILE_MAX) this.mobileOpen.set(false);
  }

  /** The deepest active route's title. */
  private routeTitle(): string {
    let r = this.route.snapshot;
    while (r.firstChild) r = r.firstChild;
    return r.title ?? '';
  }

  private static path(url: string): string { return url.split(/[?#]/)[0]; }

  private static storedCollapsed(): boolean {
    try { return localStorage.getItem('matchmind.nav-collapsed') === 'true'; } catch { return false; }
  }
}
