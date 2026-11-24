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
    else if (isApi && err.status === 403 && apiError(err).code === 'PASSWORD_CHANGE_REQUIRED') auth.requirePasswordChange();
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
    } else if (err.status === 403 && apiError(err).code === 'PASSWORD_CHANGE_REQUIRED') {
      messages.add({ severity: 'warn', summary: 'Change your password', detail: 'Choose a new password to continue.' });
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
export function apiError(raw: unknown): ApiError {
  // A resource may hand the HttpErrorResponse back wrapped in an Error (`cause`).
  const err = raw instanceof HttpErrorResponse ? raw : raw instanceof Error && raw.cause instanceof HttpErrorResponse ? raw.cause : raw;
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object' && 'code' in err.error) {
    return err.error as ApiError;
  }
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  return { status, code: 'UNKNOWN', message: status ? `Request failed (${status})` : 'Request failed' };
}

/** The API message plus its field errors ("Password is too common"), for inline form errors. */
export function apiErrorText(raw: unknown): string {
  const e = apiError(raw);
  const extra = Object.values(e.fieldErrors ?? {}).filter(m => m && !e.message.includes(m));
  return [e.message, ...extra].join(' ');
}

/** Only same-app paths: never redirect to an absolute/external URL taken from the query string, nor back to login. */
export function safeReturnUrl(target: string | null | undefined): string {
  return target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\') && !target.startsWith('/login')
    ? target : '/';
}

/** No session in this tab: borrow one from another open tab (Ctrl+click) before sending the user to login. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() || await auth.fromOtherTab() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Signed in already (here or in another tab): go where `returnUrl` points instead of showing the login form. */
export const guestGuard: CanActivateFn = async route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() || await auth.fromOtherTab()
    ? router.parseUrl(safeReturnUrl(route.queryParamMap?.get('returnUrl'))) : true;
};
