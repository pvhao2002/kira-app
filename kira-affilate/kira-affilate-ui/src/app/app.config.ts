import {ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {routes} from './app.routes';
import {AuthStore} from './core/auth/auth.store';
import {authInterceptor, refreshInterceptor} from './core/interceptors/http.interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
    provideAppInitializer(() => inject(AuthStore).restore())
  ]
};
