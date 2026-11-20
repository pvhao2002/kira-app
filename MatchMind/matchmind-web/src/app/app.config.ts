import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ApplicationConfig, Injectable, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor, errorInterceptor } from './core/http';

const leaf = (r: ActivatedRouteSnapshot) => { while (r.firstChild) r = r.firstChild; return r; };
const samePage = (a: ActivatedRouteSnapshot, b: ActivatedRouteSnapshot) =>
  leaf(a).routeConfig === leaf(b).routeConfig && JSON.stringify(leaf(a).params) === JSON.stringify(leaf(b).params);

/** Routes carry just the page name; the browser tab gets "<page> · MatchMind". */
@Injectable({ providedIn: 'root' })
class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · MatchMind` : 'MatchMind');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // Cross-fade between pages. Skipped for people who ask for less motion, and for query-only changes (applying a
      // filter, switching a report tab), which would otherwise freeze the page for the length of the fade.
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: ({ transition, from, to }) => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || samePage(from, to)) transition.skipTransition();
      } })),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
