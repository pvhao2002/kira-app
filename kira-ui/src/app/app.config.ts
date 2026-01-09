import {
  ApplicationConfig,
  ErrorHandler,
  provideZoneChangeDetection,
  provideZonelessChangeDetection
} from '@angular/core';
import {PreloadAllModules, provideRouter, withHashLocation, withPreloading} from '@angular/router';

import {routes} from './app.routes';
import {provideHttpClient, withFetch, withInterceptors, withInterceptorsFromDi} from '@angular/common/http';
import {authInterceptor} from './config/AuthInterceptor';
import {httpErrorInterceptor} from './config/HttpErrorInterceptor';
import {GlobalErrorHandler} from './config/GlobalErrorHandler';
import {provideAnimations} from '@angular/platform-browser/animations';
import {provideToastr} from 'ngx-toastr';
import {provideClientHydration, withNoHttpTransferCache} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), provideClientHydration(),
    provideRouter(routes, withHashLocation()),
    provideClientHydration(withNoHttpTransferCache()),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    provideAnimations(),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    provideToastr({
      timeOut: 2500,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      closeButton: true,
      progressBar: true,
      newestOnTop: true,
    }),
  ]
};


