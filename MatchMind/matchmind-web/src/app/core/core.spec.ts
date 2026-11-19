import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ToastService } from '../shared/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { authInterceptor, errorInterceptor } from './http';

const future = () => new Date(Date.now() + 3_600_000).toISOString();
const user = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };

describe('ApiService + interceptors', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        ToastService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends only the filters the user set', () => {
    TestBed.inject(ApiService).predictions({ league: 'EPL', market: '', search: undefined, result: 'WIN' }, { page: 1, size: 25, sort: 'predictedAt,desc' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/v1/predictions');
    expect(req.request.params.keys().sort()).toEqual(['league', 'page', 'result', 'size', 'sort']);
    expect(req.request.params.get('league')).toBe('EPL');
    req.flush({ data: [], meta: { page: 1, size: 25, totalElements: 0, totalPages: 0 } });
  });

  it('logs in, stores the session for this tab and attaches the bearer token afterwards', () => {
    const auth = TestBed.inject(AuthService);
    auth.login('admin', 'secret-pass').subscribe();
    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.body).toEqual({ username: 'admin', password: 'secret-pass' });
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush({ accessToken: 'jwt-1', expiresAt: future(), user });

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('matchmind.session')!).token).toBe('jwt-1');

    TestBed.inject(ApiService).me().subscribe();
    expect(http.expectOne('/api/v1/auth/me').request.headers.get('Authorization')).toBe('Bearer jwt-1');
  });

  it('does not leak the token to non-API URLs', () => {
    sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 'jwt-1', expiresAt: future(), user }));
    TestBed.inject(HttpClient).get('https://fonts.example/x.css').subscribe();
    expect(http.expectOne('https://fonts.example/x.css').request.headers.has('Authorization')).toBe(false);
  });

  it('a 401 from the API ends the session and sends the user to login', () => {
    sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 'jwt-1', expiresAt: future(), user }));
    const auth = TestBed.inject(AuthService);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(ApiService).dashboard({}, 'UTC').subscribe({ error: () => undefined });
    http.expectOne(r => r.url === '/api/v1/dashboard').flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('matchmind.session')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1 } });
  });

  it('a wrong password on login does not trigger the session-expired redirect', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(AuthService).login('admin', 'nope').subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/login').flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores an expired stored session', () => {
    sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 'old', expiresAt: new Date(Date.now() - 1000).toISOString(), user }));
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });

  it('shows a toast for server errors', () => {
    const add = vi.spyOn(TestBed.inject(ToastService), 'add');
    TestBed.inject(ApiService).leagues().subscribe({ error: () => undefined });
    http.expectOne('/api/v1/matches/leagues').flush({ code: 'INTERNAL_ERROR', message: 'x', traceId: 't-1' }, { status: 500, statusText: 'Server Error' });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', summary: 'Server error' }));
  });
});
