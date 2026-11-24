import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage, recordVisit } from './login';

// The login page logs a visit through fetch (ipify + our API); never reach the network from a test.
beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) })));
afterEach(() => vi.unstubAllGlobals());

describe('recordVisit', () => {
  it('sends the ipify address once per browser session, and still logs when ipify is blocked', async () => {
    sessionStorage.clear();
    const fetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ ip: '203.0.113.7' }) })
      .mockResolvedValueOnce({ status: 204 });
    vi.stubGlobal('fetch', fetch);
    await recordVisit();
    await recordVisit();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://api.ipify.org?format=json');
    expect(fetch.mock.calls[1][0]).toBe('/api/v1/visits');
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{"ip":"203.0.113.7"}' });

    sessionStorage.clear();
    const blocked = vi.fn().mockRejectedValueOnce(new TypeError('blocked')).mockResolvedValueOnce({ status: 204 });
    vi.stubGlobal('fetch', blocked);
    await recordVisit();
    expect(blocked.mock.calls[1][1]).toMatchObject({ body: '{}' });
  });
});

const user = { id: 'u1', username: 'kim', role: 'VIEWER', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };

describe('LoginPage redirects', () => {
  let http: HttpTestingController;

  function setup(query: Record<string, string>) {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }],
    });
    http = TestBed.inject(HttpTestingController);
    return vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }
  afterEach(() => http.verify());

  async function signIn(u: object) {
    const f = TestBed.createComponent(LoginPage);
    await f.whenStable();
    f.componentInstance.form.setValue({ username: 'kim', password: 'temporary-pass' });
    f.componentInstance.submit();
    http.expectOne('/api/v1/auth/login').flush({ accessToken: 'jwt', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: u });
  }

  beforeEach(() => sessionStorage.clear());

  it('a user with a temporary password goes to Settings to change it first (UX-059)', async () => {
    const navigate = setup({ returnUrl: '/matches' });
    await signIn({ ...user, mustChangePassword: true });
    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('returns to the page the session ended on (UX-035)', async () => {
    const navigate = setup({ returnUrl: '/prompts', expired: '1' });
    await signIn(user);
    expect(navigate).toHaveBeenCalledWith('/prompts');
  });

  it('never returns to the login page itself', async () => {
    const navigate = setup({ returnUrl: '/login?expired=1' });
    await signIn(user);
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
});

describe('LoginPage validation (LOGIN-1..3)', () => {
  function create() {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }] });
    const f = TestBed.createComponent(LoginPage);
    document.body.appendChild(f.nativeElement);
    return f;
  }
  afterEach(() => { document.body.innerHTML = ''; });

  it('says "too long", not "required", for an over-long username or password', async () => {
    const f = create();
    await f.whenStable();
    f.componentInstance.form.setValue({ username: 'a'.repeat(65), password: 'b'.repeat(73) });
    f.componentInstance.submit();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#username-error')?.textContent).toBe('Username can be 64 characters at most.');
    expect(el.querySelector('#password-error')?.textContent).toBe('Password can be 72 characters at most.');
  });

  it('links each error to its field and focuses the first invalid one; "Sign in" is the page h1', async () => {
    const f = create();
    await f.whenStable();
    f.componentInstance.submit();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#username')?.getAttribute('aria-describedby')).toBe('username-error');
    expect(el.querySelector('#password')?.getAttribute('aria-describedby')).toBe('password-error');
    expect(document.activeElement).toBe(el.querySelector('#username'));
    expect([...el.querySelectorAll('h1')].map(h => h.textContent)).toEqual(['Sign in']);
  });
});
