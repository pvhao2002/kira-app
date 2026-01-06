import {ApplicationConfig, ErrorHandler, provideZonelessChangeDetection} from '@angular/core';
import {PreloadAllModules, provideRouter, withHashLocation, withPreloading} from '@angular/router';

import {routes} from './app.routes';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {authInterceptor} from './config/AuthInterceptor';
import {httpErrorInterceptor} from './config/HttpErrorInterceptor';
import {GlobalErrorHandler} from './config/GlobalErrorHandler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation(), withPreloading(PreloadAllModules)),
    provideRouter(
      routes,
    ),

    // Http
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        httpErrorInterceptor
      ])
    ),

    // Zoneless (optional – chỉ bật khi chắc chắn)
    provideZonelessChangeDetection(),

    // Global error handler
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    }
  ]
};
