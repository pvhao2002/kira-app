import {inject} from '@angular/core';
import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {Router} from '@angular/router';
import {catchError, switchMap, throwError} from 'rxjs';
import {AuthStore} from '../auth/auth.store';
import {LanguageService} from '../i18n/language.service';
import {ToastService} from '../services/toast.service';
import {apiErrorMessage} from '../services/api-error';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  return next(token ? req.clone({setHeaders: {Authorization: `Bearer ${token}`}}) : req);
};
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const toast = inject(ToastService);
  const i18n = inject(LanguageService);
  return next(req).pipe(catchError((e: HttpErrorResponse) => {
    const isRefreshRequest = req.url.includes('/api/v1/auth/refresh');
    const isAuthLifecycleRequest = /\/api\/v1\/auth\/(?:mobile\/)?(?:login|refresh|logout)(?:[/?]|$)/.test(req.url);
    const hasAccessToken = req.headers.has('Authorization');

    if (e.status === 401 && hasAccessToken && !isAuthLifecycleRequest) {
      const currentToken = auth.token();
      const requestAuthorization = req.headers.get('Authorization');
      if (currentToken && requestAuthorization !== `Bearer ${currentToken}`) {
        return next(req.clone({setHeaders: {Authorization: `Bearer ${currentToken}`}}));
      }

      return auth.refresh().pipe(
        switchMap(() => {
          const token = auth.token();
          if (!token) return throwError(() => e);
          return next(req.clone({setHeaders: {Authorization: `Bearer ${token}`}}));
        }),
        catchError(refreshError => {
          auth.clear();
          void router.navigateByUrl('/login');
          toast.show(apiErrorMessage(refreshError, i18n.t('error.serverUnavailable')), 'error');
          return throwError(() => refreshError);
        })
      );
    }

    if (isRefreshRequest) return throwError(() => e);
    toast.show(apiErrorMessage(e, i18n.t('error.serverUnavailable')), 'error');
    return throwError(() => e);
  }));
};
