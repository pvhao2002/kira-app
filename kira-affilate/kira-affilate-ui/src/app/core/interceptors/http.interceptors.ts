import {inject} from '@angular/core';
import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {Router} from '@angular/router';
import {catchError, switchMap, throwError} from 'rxjs';
import {AuthStore} from '../auth/auth.store';

const PUBLIC_AUTH = /\/api\/v1\/auth\/(?:register|login|refresh|logout)(?:[/?]|$)/;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  return next(token && !PUBLIC_AUTH.test(req.url) ? req.clone({setHeaders: {Authorization: `Bearer ${token}`}}) : req);
};

/** On a 401 the access token is refreshed once through the cookie and the request replayed. Pages show their own errors. */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return next(req).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status !== 401 || !req.headers.has('Authorization') || PUBLIC_AUTH.test(req.url)) return throwError(() => e);

    // Another request already refreshed while this one was in flight: replay with the new token.
    const currentToken = auth.token();
    if (currentToken && req.headers.get('Authorization') !== `Bearer ${currentToken}`) {
      return next(req.clone({setHeaders: {Authorization: `Bearer ${currentToken}`}}));
    }

    return auth.refresh().pipe(
      catchError(refreshError => {
        auth.clear();
        void router.navigateByUrl('/login');
        return throwError(() => refreshError);
      }),
      switchMap(r => next(req.clone({setHeaders: {Authorization: `Bearer ${r.accessToken}`}})))
    );
  }));
};
