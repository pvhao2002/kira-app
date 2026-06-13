import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AuthService} from './config/AuthService';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isPublicPage = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        const nav = event as NavigationEnd;
        const url = nav.urlAfterRedirects;
        this.isPublicPage.set(url === '/' || url === '' || url.includes('/login'));
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
}
