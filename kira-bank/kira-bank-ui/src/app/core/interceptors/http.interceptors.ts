import {inject} from '@angular/core';
import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {catchError, throwError} from 'rxjs';
import {AuthStore} from '../auth/auth.store';
import {LanguageService} from '../i18n/language.service';
import {ToastService} from '../services/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  return next(token ? req.clone({setHeaders: {Authorization: `Bearer ${token}`}}) : req);
};
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const i18n = inject(LanguageService);
  return next(req).pipe(catchError((e: HttpErrorResponse) => {
    toast.show(e.error?.message ?? i18n.t('error.serverUnavailable'), 'error');
    return throwError(() => e);
  }));
};
