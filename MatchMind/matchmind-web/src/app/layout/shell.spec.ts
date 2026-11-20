import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../app.routes';
import { LiveService } from '../core/live.service';
import { PageTitle } from '../core/page-title';

const user = (role: 'ADMIN' | 'VIEWER') => ({ id: 'u1', username: 'kim', role, status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' });
const signIn = (role: 'ADMIN' | 'VIEWER') => sessionStorage.setItem('matchmind.session',
  JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: user(role) }));

async function start(role: 'ADMIN' | 'VIEWER', url: string) {
  sessionStorage.clear();
  signIn(role);
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting(),
      { provide: LiveService, useValue: { refresh: new Subject<void>(), predictions: new Subject() } }],
  });
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return harness;
}

const root = (h: RouterTestingHarness) => h.fixture.nativeElement as HTMLElement;
const navLabels = (h: RouterTestingHarness) => [...root(h).querySelectorAll('.nav-link')].map(a => a.textContent?.trim());

describe('routing', () => {
  beforeEach(() => sessionStorage.clear());

  it('shows a 404 page for an unknown URL instead of silently redirecting (UX-023)', async () => {
    const h = await start('ADMIN', '/no-such-page');
    expect(TestBed.inject(Router).url).toBe('/no-such-page');
    expect(root(h).querySelector('h1')?.textContent).toContain('Page not found');
    expect(root(h).querySelector('a[href="/dashboard"].btn')).not.toBeNull();
  });

  it('API Logs is admin only: hidden from viewers and guarded (UX-026)', async () => {
    const h = await start('VIEWER', '/no-such-page');
    expect(navLabels(h)).not.toContain('API Logs');
    await TestBed.inject(Router).navigateByUrl('/api-logs');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('admins see API Logs', async () => {
    const h = await start('ADMIN', '/no-such-page');
    expect(navLabels(h)).toContain('API Logs');
  });
});

describe('shell a11y', () => {
  it('moves focus to the page heading and announces the new page on navigation (UX-123, UX-078)', async () => {
    const h = await start('ADMIN', '/first-missing');
    const h1 = root(h).querySelector('h1') as HTMLElement;
    expect(document.activeElement).not.toBe(h1);   // not on the first load
    await h.navigateByUrl('/second-missing');
    await h.fixture.whenStable();
    expect(h1.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(h1);
    expect(root(h).querySelector('[aria-live="polite"].sr-only')?.textContent).toContain('Page not found');
  });

  it('heads the page with the name a page gives itself, until the next page (UX-005)', async () => {
    const h = await start('ADMIN', '/first-missing');
    const h1 = root(h).querySelector('h1') as HTMLElement;
    TestBed.inject(PageTitle).set('Home FC – Away FC');
    await h.fixture.whenStable();
    expect(h1.textContent?.trim()).toBe('Home FC – Away FC');
    expect(document.title).toBe('Home FC – Away FC · MatchMind');
    await h.navigateByUrl('/second-missing');
    await h.fixture.whenStable();
    expect(h1.textContent?.trim()).toBe('Page not found');
    expect(document.activeElement).toBe(h1);
  });

  it('mobile drawer: menu button controls it, focus moves in, Tab wraps, Esc closes and returns focus (UX-036)', async () => {
    const h = await start('ADMIN', '/x');
    const el = root(h);
    const menu = el.querySelector('.menu-btn') as HTMLButtonElement;
    expect(menu.getAttribute('aria-controls')).toBe(el.querySelector('aside')!.id);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.click();
    await h.fixture.whenStable();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.main')!.hasAttribute('inert')).toBe(true);
    const links = [...el.querySelectorAll<HTMLElement>('aside a[href]')];
    expect(document.activeElement).toBe(links[0]);

    links.at(-1)!.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    links.at(-1)!.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(links[0]);

    links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await h.fixture.whenStable();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.main')!.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(menu);
  });

  it('labels the time zone of all times in the header (UX-021)', async () => {
    const h = await start('ADMIN', '/x');
    expect(root(h).querySelector('.tz-chip')?.textContent?.trim()).toMatch(/^GMT/);
  });
});
