import {signal} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {throwError} from 'rxjs';
import {vi} from 'vitest';
import {routes} from './app.routes';
import {AuthStore} from './core/auth/auth.store';

describe('anonymous route access', () => {
  const refresh = vi.fn(() => throwError(() => new Error('Unauthenticated')));

  beforeEach(() => {
    refresh.mockClear();
    TestBed.configureTestingModule({providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(),
      {provide: AuthStore, useValue: {authenticated: signal(false), user: signal(null), refresh}}
    ]});
  });

  it('opens legal content from the home page without attempting authentication', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/app/legal');
    expect(harness.routeNativeElement?.textContent).toContain('Pháp luật Việt Nam');
    expect(harness.routeNativeElement?.textContent).toContain('Đăng nhập');
    expect(harness.routeNativeElement?.textContent).not.toContain('Đăng xuất');
    expect(refresh).not.toHaveBeenCalled();
  });

  for (const [path, title] of [['guides', 'Hướng dẫn Affiliate'], ['tax', 'Thuế & Thu nhập']]) {
    it(`opens ${path} without authentication`, async () => {
      const harness = await RouterTestingHarness.create(`/app/${path}`);
      expect(TestBed.inject(Router).url).toBe(`/app/${path}`);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(title);
      expect(refresh).not.toHaveBeenCalled();
    });
  }

  for (const path of ['dashboard', 'convert', 'links', 'analytics', 'orders', 'offers', 'settings']) {
    it(`requires login when navigating from legal content to ${path}`, async () => {
      const harness = await RouterTestingHarness.create('/app/legal');
      await harness.navigateByUrl(`/app/${path}`);
      expect(TestBed.inject(Router).url).toBe('/login');
      expect(refresh).toHaveBeenCalled();
    });
  }
});
