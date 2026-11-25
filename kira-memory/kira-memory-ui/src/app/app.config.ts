import {ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {PreloadAllModules, provideRouter, withPreloading} from '@angular/router';
import {routes} from './app.routes';
import {AuthStore, sessionInterceptor} from './core/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([sessionInterceptor])),
    provideAppInitializer(() => inject(AuthStore).restore())
  ]
};
