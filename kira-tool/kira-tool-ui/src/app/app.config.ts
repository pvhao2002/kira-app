import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideHttpClient, withXsrfConfiguration} from '@angular/common/http';
import {provideRouter, withHashLocation} from '@angular/router';
import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash routing: the SPA can be served from any static path without server-side rewrites.
    provideRouter(routes, withHashLocation()),
    // Same-origin only (proxy.conf.js in dev, nginx in prod): the anonymous owner cookie is sent automatically.
    provideHttpClient(withXsrfConfiguration({cookieName: 'TOOL-XSRF-TOKEN', headerName: 'X-TOOL-XSRF-TOKEN'}))
  ]
};
