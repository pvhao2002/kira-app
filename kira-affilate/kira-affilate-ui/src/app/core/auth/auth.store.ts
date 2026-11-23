import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, finalize, Observable, of, shareReplay, tap} from 'rxjs';
import {API} from '../api/http';
import {AuthResponse, Profile} from '../api/models';

/** Marks that this browser had a session. It holds no token: it only says a refresh is worth trying on startup. */
const SESSION_HINT = 'kira-affilate.session';

/** The access token lives in memory only; the session survives reloads through the HttpOnly refresh cookie. */
@Injectable({providedIn: 'root'})
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly tokenState = signal<string | null>(null);
  readonly token = this.tokenState.asReadonly();
  private readonly userState = signal<Profile | null>(null);
  private refreshInFlight: Observable<AuthResponse> | null = null;
  readonly user = this.userState.asReadonly();
  readonly authenticated = computed(() => this.userState() !== null);

  register(body: {email: string; password: string; fullName: string}): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API}/auth/register`, body, {withCredentials: true}).pipe(tap(r => this.accept(r)));
  }

  login(body: {email: string; password: string}): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API}/auth/login`, body, {withCredentials: true}).pipe(tap(r => this.accept(r)));
  }

  refresh(): Observable<AuthResponse> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = this.http.post<AuthResponse>(`${API}/auth/refresh`, {}, {withCredentials: true}).pipe(
      tap(r => this.accept(r)),
      finalize(() => this.refreshInFlight = null),
      shareReplay({bufferSize: 1, refCount: true})
    );
    return this.refreshInFlight;
  }

  /**
   * On startup, brings back the session after a reload, so public pages show the signed-in user too. Only browsers
   * that had a session try: anonymous visitors of the public pages send no refresh request.
   */
  restore(): Observable<unknown> {
    if (!hint()) return of(null);
    return this.refresh().pipe(catchError(() => {
      this.clear();
      return of(null);
    }));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${API}/auth/logout`, {}, {withCredentials: true}).pipe(finalize(() => this.clear()));
  }

  updateProfile(fullName: string): Observable<Profile> {
    const version = this.userState()?.version ?? 0;
    return this.http.put<Profile>(`${API}/auth/profile`, {fullName, version}).pipe(tap(p => this.userState.set(p)));
  }

  /** The server revokes every session on success, so the caller must send the user back to login. */
  changePassword(body: {currentPassword: string; newPassword: string}): Observable<void> {
    return this.http.post<void>(`${API}/auth/change-password`, body);
  }

  clear(): void {
    this.tokenState.set(null);
    this.userState.set(null);
    setHint(false);
  }

  private accept(r: AuthResponse): void {
    this.tokenState.set(r.accessToken);
    this.userState.set(r.user);
    setHint(true);
  }
}

// Storage can be blocked (private mode, site data off): then a reload on a public page shows the visitor view.
function hint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return false;
  }
}

function setHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    // ignore: see hint()
  }
}
