import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AuthService} from './config/AuthService';
import {MAIN_NAV_ITEMS} from './config/nav.config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isPublicPage = signal(false);
  private readonly navbarAvatarLoadFailed = signal(false);
  readonly visibleNavItems = computed(() =>
    MAIN_NAV_ITEMS.filter((item) => this.authService.hasRole(...item.roles)),
  );
  readonly navbarAvatarUrl = computed(() => {
    if (this.navbarAvatarLoadFailed()) {
      return null;
    }
    return this.authService.user()?.avatar?.trim() || null;
  });
  readonly navbarAvatarInitials = computed(() => this.getInitials(this.authService.user()?.username ?? 'User'));

  constructor() {
    if (window.location.pathname.startsWith('/tu-vi/') && !window.location.hash) {
      window.location.replace(`/#${window.location.pathname}`);
      return;
    }

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        const nav = event as NavigationEnd;
        const url = nav.urlAfterRedirects;
        const currentHref = window.location.href;
        this.isPublicPage.set(
          url === '/'
          || url === ''
          || url.includes('/login')
          || url.includes('/tu-vi/')
          || url.startsWith('/plan')
          || currentHref.includes('#/plan'),
        );
        window.scrollTo(0, 0);
      });
  }

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/']);
      },
      error: () => {
        this.authService.clearSession();
        void this.router.navigate(['/']);
      }
    });
  }

  onNavbarAvatarError(): void {
    this.navbarAvatarLoadFailed.set(true);
  }

  private getInitials(name: string): string {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) {
      return 'U';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
