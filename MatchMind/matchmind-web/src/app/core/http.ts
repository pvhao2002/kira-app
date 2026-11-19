import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API } from './api.service';
import { AuthService } from './auth.service';
import { ApiError } from './models';
import { ToastService } from '../shared/kit';

/** Adds the bearer token to API calls and turns an expired/invalid session into a redirect to login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isApi = req.url.startsWith(API);
  const request = isApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request).pipe(catchError((err: HttpErrorResponse) => {
    if (isApi && err.status === 401 && !req.url.endsWith('/auth/login')) auth.expire();
    return throwError(() => err);
  }));
};

/**
 * Global toasts for failures a page cannot do anything about (network down, forbidden, rate limited, server error).
 * Validation (400), not-found and conflict errors are shown by the page that made the request.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messages = inject(ToastService);
  return next(req).pipe(catchError((err: HttpErrorResponse) => {
    if (err.status === 0) {
      messages.add({ severity: 'error', summary: 'Server unreachable', detail: 'Check your connection and try again.' });
    } else if (err.status === 403) {
      messages.add({ severity: 'warn', summary: 'Not allowed', detail: 'Your role cannot perform this action.' });
    } else if (err.status === 429) {
      messages.add({ severity: 'warn', summary: 'Too many requests', detail: apiError(err).message });
    } else if (err.status >= 500) {
      messages.add({ severity: 'error', summary: 'Server error', detail: `Something failed on the server (trace ${apiError(err).traceId ?? 'n/a'}).` });
    }
    return throwError(() => err);
  }));
};

/** Normalizes any HTTP failure to the backend's ErrorResponse shape. */
export function apiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object' && 'code' in err.error) {
    return err.error as ApiError;
  }
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  return { status, code: 'UNKNOWN', message: status ? `Request failed (${status})` : 'Request failed' };
}

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
