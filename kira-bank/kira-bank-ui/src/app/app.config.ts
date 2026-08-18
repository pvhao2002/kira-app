import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideRouter, TitleStrategy, withComponentInputBinding} from '@angular/router';
import {routes} from './app.routes';
import {authInterceptor, errorInterceptor} from './core/interceptors/http.interceptors';
import {LocalizedTitleStrategy} from './core/routing/localized-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    {provide: TitleStrategy, useClass: LocalizedTitleStrategy}
  ]
};
