import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, from, switchMap, throwError} from 'rxjs';
import {AuthStore} from './auth.store';

const isAuthCall = (url: string) => url.includes('/auth/');

/** Adds the in-memory access token and, on a 401, refreshes once (HttpOnly cookie) and retries. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const withToken = (token: string | null) =>
    token && req.url.startsWith('/api/') ? req.clone({setHeaders: {Authorization: `Bearer ${token}`}}) : req;

  return next(withToken(auth.accessToken())).pipe(
    catchError(err => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isAuthCall(req.url) || !auth.accessToken()) {
        return throwError(() => err);
      }
      return from(auth.refresh()).pipe(
        switchMap(ok => (ok ? next(withToken(auth.accessToken())) : throwError(() => err)))
      );
    })
  );
};
