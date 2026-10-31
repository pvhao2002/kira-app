import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { routes } from './app.routes';
import { apiOriginInterceptor } from './core/api-origin.interceptor';
import { sessionExpiredInterceptor } from './core/auth-store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    // XSRF-TOKEN cookie → X-XSRF-TOKEN header is on by default for mutating same-origin requests.
    provideHttpClient(withFetch(), withInterceptors([apiOriginInterceptor, sessionExpiredInterceptor])),
    // Protobuf GETs fetched during SSR are replayed on hydration instead of being fetched twice.
    provideClientHydration(withEventReplay(), withHttpTransferCacheOptions({})),
    provideSpartanHlm(),
  ],
};
