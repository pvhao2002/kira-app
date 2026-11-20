import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '../shared/kit';
import { ApiService } from './api.service';
import { AuthService, passwordChangeGuard } from './auth.service';
import { authGuard, authInterceptor, errorInterceptor, guestGuard, safeReturnUrl } from './http';

@Component({ template: '' })
class Blank {}

const MIN = 60_000;
const user = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();
const store = (expiresInMs = 3_600_000, u: object = user) =>
  sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 'jwt-1', expiresAt: inMs(expiresInMs), user: u }));
const state = (url: string) => ({ url }) as RouterStateSnapshot;
const route = {} as ActivatedRouteSnapshot;

describe('AuthService session', () => {
  let http: HttpTestingController;
  let peer: BroadcastChannel;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'matches', component: Blank }, { path: 'settings', component: Blank }, { path: 'login', component: Blank }]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    peer = new BroadcastChannel('matchmind.auth');
  });

  afterEach(() => {
    peer.close();
    vi.useRealTimers();
    http.verify();
    TestBed.resetTestingModule();
  });

  it('keeps the page the user was on as returnUrl when the session expires (UX-035)', async () => {
    store();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/matches?league=EPL');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    TestBed.inject(AuthService).expire();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1, returnUrl: '/matches?league=EPL' } });
  });

  it('a new tab without a session borrows it from an open tab (UX-035)', async () => {
    peer.onmessage = e => { if (e.data?.type === 'ask') peer.postMessage({ type: 'session', session: { token: 'jwt-peer', expiresAt: inMs(3_600_000), user } }); };
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(await auth.fromOtherTab()).toBe(true);
    expect(auth.token()).toBe('jwt-peer');
    expect(JSON.parse(sessionStorage.getItem('matchmind.session')!).token).toBe('jwt-peer');
  });

  it('answers another tab that asks for the session, and gives up when nobody answers', async () => {
    const auth = TestBed.inject(AuthService);
    expect(await auth.fromOtherTab(50)).toBe(false);

    store();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService);
    const answer = new Promise<{ type: string; session?: { token: string } }>(resolve => { peer.onmessage = e => resolve(e.data); });
    peer.postMessage({ type: 'ask' });
    const msg = await answer;
    expect(msg.type).toBe('session');
    expect(msg.session?.token).toBe('jwt-1');
  });

  it('a sign-out in another tab ends the session here too', async () => {
    store();
    const auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    peer.postMessage({ type: 'logout' });
    await vi.waitFor(() => expect(auth.isAuthenticated()).toBe(false));
  });

  it('Sign out ends only this session; Sign out everywhere calls logout-all (UX-090)', () => {
    store();
    const auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.logoutAll();
    http.expectOne('/api/v1/auth/logout-all').flush(null);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('renews the token 30 minutes before it expires (UX-124)', () => {
    vi.useFakeTimers();
    store(40 * MIN);
    const auth = TestBed.inject(AuthService);
    vi.advanceTimersByTime(9 * MIN);
    http.expectNone('/api/v1/auth/refresh');
    vi.advanceTimersByTime(2 * MIN);
    const req = http.expectOne('/api/v1/auth/refresh');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-1');
    req.flush({ accessToken: 'jwt-2', expiresAt: inMs(8 * 60 * MIN), user });
    expect(auth.token()).toBe('jwt-2');
    expect(JSON.parse(sessionStorage.getItem('matchmind.session')!).token).toBe('jwt-2');
    expect(auth.expiringSoon()).toBe(false);
  });

  it('at the 24 h cap it stops renewing and warns 5 minutes before the end (UX-124)', () => {
    vi.useFakeTimers();
    store(20 * MIN);
    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    const auth = TestBed.inject(AuthService);
    const expiresAt = JSON.parse(sessionStorage.getItem('matchmind.session')!).expiresAt;
    vi.advanceTimersByTime(1); // less than 30 min left: renew at once
    http.expectOne('/api/v1/auth/refresh').flush({ accessToken: 'jwt-2', expiresAt, user }); // no later than before: capped
    vi.advanceTimersByTime(14 * MIN);
    http.expectNone('/api/v1/auth/refresh');
    expect(auth.expiringSoon()).toBe(false);
    vi.advanceTimersByTime(2 * MIN);
    expect(auth.expiringSoon()).toBe(true);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn', summary: 'Session ending soon' }));
  });

  it('403 PASSWORD_CHANGE_REQUIRED sends the user to change the password, without the generic toast (UX-059)', () => {
    store();
    const auth = TestBed.inject(AuthService);
    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(ApiService).prompts().subscribe({ error: () => undefined });
    http.expectOne('/api/v1/prompts').flush({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your password first' }, { status: 403, statusText: 'Forbidden' });
    expect(navigate).toHaveBeenCalledWith(['/settings']);
    expect(auth.user()?.mustChangePassword).toBe(true);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ summary: 'Not allowed' }));
  });

  it('passwordChangeGuard keeps a flagged user on Settings', () => {
    store(3_600_000, { ...user, mustChangePassword: true });
    const guard = (url: string) => TestBed.runInInjectionContext(() => passwordChangeGuard(route, state(url)));
    expect(guard('/dashboard')).toBeInstanceOf(UrlTree);
    expect(String(guard('/dashboard'))).toBe('/settings');
    expect(guard('/settings')).toBe(true);
  });

  it('authGuard waits for another tab before sending the user to login', async () => {
    peer.onmessage = e => { if (e.data?.type === 'ask') peer.postMessage({ type: 'session', session: { token: 'jwt-peer', expiresAt: inMs(3_600_000), user } }); };
    const res = await TestBed.runInInjectionContext(() => authGuard(route, state('/matches')));
    expect(res).toBe(true);
  });

  it('a signed-in user opening /login?returnUrl=… goes to that page (UX-070)', async () => {
    store();
    const router = TestBed.inject(Router);
    const res = await TestBed.runInInjectionContext(() => guestGuard({ queryParamMap: router.parseUrl('/login?returnUrl=%2Fmatches').queryParamMap } as ActivatedRouteSnapshot, state('/login?returnUrl=%2Fmatches')));
    expect(String(res)).toBe('/matches');
  });

  it('safeReturnUrl accepts only in-app paths', () => {
    expect(safeReturnUrl('/matches?x=1')).toBe('/matches?x=1');
    expect(safeReturnUrl('//evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('https://evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('/login?expired=1')).toBe('/dashboard');
    expect(safeReturnUrl(null)).toBe('/dashboard');
  });
});
