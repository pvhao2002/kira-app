import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, tap } from 'rxjs';
import { ApiService } from './api.service';
import { LoginResponse, User } from './models';

const STORAGE_KEY = 'matchmind.session';

interface Session { token: string; expiresAt: string; user: User; }

/**
 * Holds the JWT for this browser tab only (sessionStorage: gone when the tab closes, never sent as a cookie,
 * so there is no CSRF surface). Expiry is enforced client-side by a timer and server-side by the token itself.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(AuthService.restore());
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.session()?.user.role === 'ADMIN');

  constructor() {
    this.scheduleExpiry();
  }

  token(): string | null {
    return this.session()?.token ?? null;
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.api.login(username, password).pipe(tap(res => {
      this.set({ token: res.accessToken, expiresAt: res.expiresAt, user: res.user });
    }));
  }

  /** Revokes every token of this user server-side, then clears the local session either way. */
  logout(): void {
    if (!this.session()) {
      void this.router.navigate(['/login']);
      return;
    }
    this.api.logout().pipe(finalize(() => {
      this.clear();
      void this.router.navigate(['/login']);
    })).subscribe({ error: () => undefined });
  }

  /** Called on 401 or when the token reaches its expiry time. */
  expire(): void {
    if (!this.session()) return;
    this.clear();
    void this.router.navigate(['/login'], { queryParams: { expired: 1 } });
  }

  private set(s: Session): void {
    this.session.set(s);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage may be unavailable */ }
    this.scheduleExpiry();
  }

  private clear(): void {
    this.session.set(null);
    clearTimeout(this.expiryTimer);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const s = this.session();
    if (!s) return;
    const ms = new Date(s.expiresAt).getTime() - Date.now();
    // setTimeout overflows above ~24.8 days; tokens live hours, but clamp anyway.
    this.expiryTimer = setTimeout(() => this.expire(), Math.max(0, Math.min(ms, 2_000_000_000)));
  }

  private static restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return new Date(s.expiresAt).getTime() > Date.now() ? s : null;
    } catch {
      return null;
    }
  }
}
