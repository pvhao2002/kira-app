import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { Observable, finalize, tap } from 'rxjs';
import { ToastService } from '../shared/kit';
import { ApiService } from './api.service';
import { LoginResponse, User } from './models';

const STORAGE_KEY = 'matchmind.session';
const CHANNEL = 'matchmind.auth';
const MIN = 60_000;
/** Renew this long before `expiresAt`, and warn this long before a session that cannot be renewed ends. */
const REFRESH_BEFORE = 30 * MIN;
const WARN_BEFORE = 5 * MIN;

interface Session { token: string; expiresAt: string; user: User; }
type TabMessage = { type: 'ask' } | { type: 'session'; session: Session } | { type: 'logout' };

/**
 * Holds the JWT for this browser tab (sessionStorage: gone when the last tab closes, never sent as a cookie, so there is
 * no CSRF surface). Open tabs of the same origin share it over a BroadcastChannel: a new tab (Ctrl+click) asks the
 * others instead of forcing a new sign-in, renewals reach every tab, and Sign out in one tab ends all of them.
 * Trade-off: any script of this origin can ask for the token, which is no more than what it could already read from
 * sessionStorage; the token never reaches localStorage, so it does not outlive the browser session.
 * The token is renewed 30 min before it expires, up to the server's 24 h cap; 5 min before the cap a warning shows.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly session = signal<Session | null>(AuthService.restore());
  private readonly channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  private waiters: ((ok: boolean) => void)[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** The last renewal did not move `expiresAt`: the 24 h cap is reached, so stop asking. */
  private capped = false;
  private warnedFor = '';

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.session()?.user.role === 'ADMIN');
  /** True in the last minutes of a session that can no longer be renewed (the shell may show a banner). */
  readonly expiringSoon = signal(false);

  constructor() {
    this.schedule();
    // Timers stall while a laptop sleeps or a tab is frozen: re-check the expiry as soon as the tab is shown again.
    const onVisible = () => { if (!document.hidden) this.schedule(); };
    document.addEventListener('visibilitychange', onVisible);
    if (this.channel) this.channel.onmessage = e => this.onTabMessage(e.data as TabMessage);
    inject(DestroyRef).onDestroy(() => {
      this.clearTimers();
      this.channel?.close();
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  token(): string | null {
    return this.session()?.token ?? null;
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.api.login(username, password).pipe(tap(res => {
      this.capped = false;
      this.set({ token: res.accessToken, expiresAt: res.expiresAt, user: res.user });
    }));
  }

  /** Ends this session (this browser, all its tabs) server-side, then clears it locally either way. */
  logout(): void {
    this.endWith(this.api.logout());
  }

  /** Ends every session of this user on every device. */
  logoutAll(): void {
    this.endWith(this.api.logoutAll());
  }

  /** Called on 401 or when the token reaches its expiry time. Keeps the current page as `returnUrl`. */
  expire(): void {
    if (!this.session()) return;
    const url = this.router.url;
    this.clear(true);
    const keep = url && url !== '/' && !url.startsWith('/login');
    void this.router.navigate(['/login'], { queryParams: keep ? { expired: 1, returnUrl: url } : { expired: 1 } });
  }

  /** A call answered 403 PASSWORD_CHANGE_REQUIRED: flag the user and open Settings, where the password is changed. */
  requirePasswordChange(): void {
    const s = this.session();
    if (s && !s.user.mustChangePassword) this.set({ ...s, user: { ...s.user, mustChangePassword: true } }, false);
    void this.router.navigate(['/settings']);
  }

  /** No session in this tab: ask the other open tabs for theirs. Resolves false when none answers in time. */
  fromOtherTab(timeoutMs = 300): Promise<boolean> {
    if (this.session()) return Promise.resolve(true);
    if (!this.channel) return Promise.resolve(false);
    return new Promise(resolve => {
      const done = (ok: boolean) => { clearTimeout(t); this.waiters = this.waiters.filter(w => w !== done); resolve(ok); };
      const t = setTimeout(() => done(false), timeoutMs);
      this.waiters.push(done);
      this.post({ type: 'ask' });
    });
  }

  private onTabMessage(m: TabMessage): void {
    const s = this.session();
    if (m?.type === 'ask' && s) this.post({ type: 'session', session: s });
    else if (m?.type === 'session' && AuthService.valid(m.session) && m.session.token !== s?.token) {
      this.set(m.session, false);
      for (const w of [...this.waiters]) w(true);
    } else if (m?.type === 'logout' && s) {
      this.clear(false);
      void this.router.navigate(['/login']);
    }
  }

  private endWith(call: Observable<void>): void {
    if (!this.session()) {
      void this.router.navigate(['/login']);
      return;
    }
    call.pipe(finalize(() => {
      this.clear(true);
      void this.router.navigate(['/login']);
    })).subscribe({ error: () => undefined });
  }

  private set(s: Session, broadcast = true): void {
    this.session.set(s);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage may be unavailable */ }
    if (broadcast) this.post({ type: 'session', session: s });
    this.schedule();
  }

  private clear(broadcast: boolean): void {
    this.session.set(null);
    this.clearTimers();
    this.expiringSoon.set(false);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    if (broadcast) this.post({ type: 'logout' });
  }

  private post(m: TabMessage): void {
    try { this.channel?.postMessage(m); } catch { /* channel closed */ }
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private schedule(): void {
    this.clearTimers();
    const s = this.session();
    if (!s) return;
    const left = new Date(s.expiresAt).getTime() - Date.now();
    // setTimeout overflows above ~24.8 days; tokens live hours, but clamp anyway.
    const at = (ms: number, fn: () => void) => this.timers.push(setTimeout(fn, Math.max(0, Math.min(ms, 2_000_000_000))));
    at(left, () => this.expire());
    if (!this.capped) at(left - REFRESH_BEFORE, () => this.refresh());
    this.expiringSoon.set(left <= WARN_BEFORE);
    at(left - WARN_BEFORE, () => this.warn());
  }

  private refresh(): void {
    const before = this.session()?.expiresAt;
    if (!before) return;
    this.api.refreshToken().subscribe({
      next: res => {
        this.capped = new Date(res.expiresAt).getTime() < new Date(before).getTime() + MIN;
        this.set({ token: res.accessToken, expiresAt: res.expiresAt, user: res.user });
      },
      // 401 is handled by the interceptor (expire); otherwise try again in a minute while the token still lives.
      error: e => { if (e?.status !== 401 && this.session()) this.timers.push(setTimeout(() => this.refresh(), MIN)); },
    });
  }

  private warn(): void {
    const s = this.session();
    this.expiringSoon.set(!!s);
    if (!s || this.warnedFor === s.expiresAt) return; // once per session end, not on every tab re-show
    this.warnedFor = s.expiresAt;
    const time = new Date(s.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.toasts.add({ severity: 'warn', summary: 'Session ending soon', detail: `Your session ends at ${time}. Save your work, then sign in again.` });
  }

  private static valid(s: Session | undefined): s is Session {
    return !!s && typeof s.token === 'string' && new Date(s.expiresAt).getTime() > Date.now();
  }

  private static restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return AuthService.valid(s) ? s : null;
    } catch {
      return null;
    }
  }
}

/** Route hook (shell children): a user flagged `mustChangePassword` stays on Settings until the password is changed. */
export const passwordChangeGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.user()?.mustChangePassword && !state.url.startsWith('/settings') ? inject(Router).createUrlTree(['/settings']) : true;
};
