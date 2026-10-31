import { computed, inject, Injectable, signal } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import { EmptySchema, LoginRequestSchema, MeSchema, Role, type Me } from '../gen/kira/news/v1/news_pb';
import { ProtoApi } from './proto-api';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(ProtoApi);
  readonly me = signal<Me | undefined>(undefined);
  readonly signedIn = computed(() => (this.me()?.role ?? Role.UNSPECIFIED) !== Role.UNSPECIFIED);
  readonly isAdmin = computed(() => this.me()?.role === Role.ADMIN);

  async ensure(): Promise<Me> {
    const known = this.me();
    if (known) {
      return known;
    }
    const me = await firstValueFrom(this.api.get('/api/v1/auth/me', MeSchema));
    this.me.set(me);
    return me;
  }

  async login(username: string, password: string): Promise<void> {
    // Any GET makes the service set the XSRF-TOKEN cookie that HttpClient echoes on the POST below.
    await firstValueFrom(this.api.get('/api/v1/auth/me', MeSchema));
    this.me.set(await firstValueFrom(this.api.send('POST', '/api/v1/auth/login', LoginRequestSchema, { username, password }, MeSchema)));
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.api.send('POST', '/api/v1/auth/logout', EmptySchema, {}, EmptySchema));
    this.me.set(undefined);
  }
}

export const signedInGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router); // inject before the first await: guards lose the injection context after it
  const me = await auth.ensure().catch(() => undefined);
  return (me && me.role !== Role.UNSPECIFIED) || router.parseUrl('/admin/dang-nhap');
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const me = await auth.ensure().catch(() => undefined);
  return me?.role === Role.ADMIN || router.parseUrl('/admin/bai-viet');
};

/** A 401 from the admin API means the session expired: forget the user and go to the login page. */
export const sessionExpiredInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/v1/admin/')) {
    return next(request);
  }
  const auth = inject(AuthStore);
  const router = inject(Router);
  return next(request).pipe(
    tap({
      error: (error: { status?: number }) => {
        if (error.status === 401) {
          auth.me.set(undefined);
          void router.navigateByUrl('/admin/dang-nhap');
        }
      },
    }),
  );
};
