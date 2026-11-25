import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {computed, inject, Injectable, signal} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {catchError, firstValueFrom, of, tap, throwError} from 'rxjs';
import {Api, User} from './api';

@Injectable({providedIn: 'root'})
export class AuthStore {
  private api = inject(Api);
  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  /** The session lives in an HttpOnly cookie; ask the server who we are. */
  restore() {
    return firstValueFrom(this.api.me().pipe(tap(u => this.user.set(u)), catchError(() => of(null))));
  }

  login(username: string, password: string) {
    return this.api.login(username, password).pipe(tap(u => this.user.set(u)));
  }

  logout() {
    return this.api.logout().pipe(tap(() => this.user.set(null)));
  }
}

export const authGuard: CanActivateFn = () =>
  inject(AuthStore).user() ? true : inject(Router).parseUrl('/dang-nhap');

export const guestGuard: CanActivateFn = () =>
  inject(AuthStore).user() ? inject(Router).parseUrl('/') : true;

export const adminGuard: CanActivateFn = () =>
  inject(AuthStore).isAdmin() ? true : inject(Router).parseUrl('/');

/** A 401 on any call but login means the session ended: go back to the login page. */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return next(req).pipe(catchError((err: HttpErrorResponse) => {
    if (err.status === 401 && !req.url.startsWith('/api/auth/')) {
      auth.user.set(null);
      router.navigateByUrl('/dang-nhap');
    }
    return throwError(() => err);
  }));
};
