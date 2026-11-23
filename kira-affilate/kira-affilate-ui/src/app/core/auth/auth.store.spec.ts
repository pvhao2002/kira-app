import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {AuthStore} from './auth.store';

describe('AuthStore.restore', () => {
  let store: AuthStore;
  let http: HttpTestingController;
  const user = {id: 1, email: 'a@b.vn', fullName: 'A', version: 0};

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends no refresh for a browser that never had a session', async () => {
    await firstValueFrom(store.restore());
    expect(store.authenticated()).toBe(false);
  });

  it('brings the session back after a reload once the user has signed in', async () => {
    const login = firstValueFrom(store.login({email: user.email, password: 'x'}));
    http.expectOne(r => r.url.endsWith('/auth/login')).flush({accessToken: 't1', user});
    await login;

    // A reload: a fresh store in the same browser.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
    const restored = firstValueFrom(store.restore());
    http.expectOne(r => r.url.endsWith('/auth/refresh')).flush({accessToken: 't2', user});
    await restored;
    expect(store.user()?.fullName).toBe('A');
  });

  it('forgets an expired session so the next reload does not try again', async () => {
    localStorage.setItem('kira-affilate.session', '1');
    const restored = firstValueFrom(store.restore());
    http.expectOne(r => r.url.endsWith('/auth/refresh')).flush(null, {status: 401, statusText: 'Unauthorized'});
    await restored;
    expect(store.authenticated()).toBe(false);
    await firstValueFrom(store.restore()); // no second request: verify() in afterEach fails on one
  });
});
