import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { LiveService } from '../core/live.service';

interface NavItem { path: string; label: string; icon: string; }

const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'pi-th-large' },
  { path: '/matches', label: 'Matches', icon: 'pi-calendar' },
  { path: '/predictions', label: 'Predictions', icon: 'pi-bolt' },
  { path: '/models', label: 'AI Models', icon: 'pi-microchip-ai' },
  { path: '/reports', label: 'Reports', icon: 'pi-chart-bar' },
  { path: '/prompts', label: 'Prompt Notes', icon: 'pi-file-edit' },
  { path: '/api-logs', label: 'API Logs', icon: 'pi-list' },
  { path: '/settings', label: 'Settings', icon: 'pi-cog' },
];

@Component({
  selector: 'mm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.nav-collapsed]="collapsed()" [class.nav-open]="mobileOpen()">
      <aside class="sidebar" aria-label="Main navigation">
        <a routerLink="/dashboard" class="brand">
          <span class="brand-mark" aria-hidden="true">M</span>
          @if (!collapsed()) { <span class="brand-text"><strong>MatchMind</strong><small>Private workspace</small></span> }
        </a>
        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-link"
               [attr.title]="collapsed() ? item.label : null" [attr.aria-label]="collapsed() ? item.label : null" (click)="mobileOpen.set(false)">
              <i class="pi {{ item.icon }}" aria-hidden="true"></i>
              @if (!collapsed()) { <span>{{ item.label }}</span> }
            </a>
          }
        </nav>
        <button type="button" class="collapse-btn" (click)="toggle()" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
          <i class="pi" [class.pi-angle-double-left]="!collapsed()" [class.pi-angle-double-right]="collapsed()"></i>
        </button>
      </aside>
      <div class="scrim" (click)="mobileOpen.set(false)"></div>
      <div class="main">
        <header class="topbar">
          <button type="button" class="btn btn-text btn-icon menu-btn" aria-label="Open navigation" (click)="mobileOpen.set(true)"><i class="pi pi-bars"></i></button>
          <h1 class="page-title">{{ title() }}</h1>
          <div class="topbar-right">
            <span class="user-chip"><i class="pi pi-user"></i>{{ auth.user()?.username }}<small>{{ auth.user()?.role === 'ADMIN' ? 'Admin' : 'Viewer' }}</small></span>
            <button type="button" class="btn btn-text btn-sm" (click)="auth.logout()"><i class="pi pi-sign-out"></i><span class="label">Sign out</span></button>
          </div>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>`,
})
export class Shell {
  readonly auth = inject(AuthService);
  private readonly live = inject(LiveService); // the shell exists only while signed in: listen for new predictions
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly nav = NAV;
  readonly collapsed = signal(Shell.storedCollapsed());
  readonly mobileOpen = signal(false);
  readonly title = signal('');

  constructor() {
    this.updateTitle();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.updateTitle());
  }

  toggle(): void {
    this.collapsed.update(v => !v);
    try { localStorage.setItem('matchmind.nav-collapsed', String(this.collapsed())); } catch { /* optional */ }
  }

  private updateTitle(): void {
    let r = this.route.snapshot;
    while (r.firstChild) r = r.firstChild;
    this.title.set((r.title ?? '').split(' · ')[0]);
  }

  private static storedCollapsed(): boolean {
    try { return localStorage.getItem('matchmind.nav-collapsed') === 'true'; } catch { return false; }
  }
}
