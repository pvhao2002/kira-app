import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, map, Observable, of, tap} from 'rxjs';
import {Router} from '@angular/router';
import {AppRole} from './nav.config';

type SessionUser = {
  userId: number;
  username: string;
  role: string;
  avatar?: string | null;
};

type SessionResponse = {
  status: string;
  data: SessionUser;
};

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly isAuthenticated = signal(false);
  readonly user = signal<SessionUser | null>(null);

  readonly role = computed<AppRole>(() => {
    const raw = this.user()?.role?.trim().toLowerCase();
    return raw === 'admin' ? 'admin' : 'user';
  });

  readonly isAdmin = computed(() => this.role() === 'admin');

  hasRole(...roles: AppRole[]): boolean {
    return roles.includes(this.role());
  }

  login(username: string, password: string): Observable<SessionUser> {
    return this.http.post<SessionResponse>('/gateway/auth/login', {username, password})
      .pipe(
        map(res => res.data),
        tap(user => {
          this.user.set(user);
          this.isAuthenticated.set(true);
        })
      );
  }

  logout(): Observable<void> {
    return this.http.post('/gateway/auth/logout', {})
      .pipe(
        map(() => {
          this.clearSession();
        })
      );
  }

  checkSession(): Observable<boolean> {
    if (this.isAuthenticated()) {
      return of(true);
    }

    return this.http.get<SessionResponse>('/gateway/auth/me')
      .pipe(
        map(res => res.data),
        tap(user => {
          this.user.set(user);
          this.isAuthenticated.set(true);
        }),
        map(() => true),
        catchError(() => {
          this.clearSession();
          return of(false);
        })
      );
  }

  handleUnauthorized(): void {
    this.clearSession();
    void this.router.navigate(['/']);
  }

  clearSession(): void {
    this.isAuthenticated.set(false);
    this.user.set(null);
  }
}
