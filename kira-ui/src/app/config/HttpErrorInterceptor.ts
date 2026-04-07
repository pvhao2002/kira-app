import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, throwError} from 'rxjs';
import {AuthService} from './AuthService';
import {Router} from '@angular/router';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (shouldHandleUnauthorized(req.url, err)) {
        authService.handleUnauthorized(router.url);
      }
      return throwError(() => err);
    })
  );
};

function shouldHandleUnauthorized(url: string, err: HttpErrorResponse): boolean {
  return isUnauthorizedGatewayError(url, err) && !isAuthRoute(url) && !isSessionProbeRoute(url);
}

function isUnauthorizedGatewayError(url: string, err: HttpErrorResponse): boolean {
  return url.startsWith('/gateway/') && (err.status === 401 || err.status === 403);
}

function isAuthRoute(url: string): boolean {
  return url.includes('/gateway/auth/login') || url.includes('/gateway/auth/logout');
}

function isSessionProbeRoute(url: string): boolean {
  return url.includes('/gateway/auth/me');
}
