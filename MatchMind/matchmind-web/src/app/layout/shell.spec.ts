import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../app.routes';
import { LiveService } from '../core/live.service';
import { PageTitle } from '../core/page-title';

const user = (role: 'ADMIN' | 'VIEWER') => ({ id: 'u1', username: 'kim', role, status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' });
const signIn = (role: 'ADMIN' | 'VIEWER', extra: object = {}) => sessionStorage.setItem('matchmind.session',
  JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { ...user(role), ...extra } }));

async function start(role: 'ADMIN' | 'VIEWER', url: string, extra: object = {}) {
  sessionStorage.clear();
  signIn(role, extra);
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
    expect(navLabels(h)).not.toContain('Visitors');
    await TestBed.inject(Router).navigateByUrl('/api-logs');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('gives every menu icon its own colour', async () => {
    const h = await start('ADMIN', '/no-such-page');
    const colours = [...root(h).querySelectorAll<HTMLElement>('.nav-link')].map(a => a.style.getPropertyValue('--nav-c'));
    expect(colours.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it('admins see API Logs', async () => {
    const h = await start('ADMIN', '/no-such-page');
    expect(navLabels(h)).toContain('API Logs');
    expect(navLabels(h)).toContain('Visitors');
  });

  it('Monitor is admin only and opens /monitor/ in a new tab after the API sets its cookie', async () => {
    const viewer = await start('VIEWER', '/no-such-page');
    expect(navLabels(viewer)).not.toContain('Monitor');
    TestBed.resetTestingModule();

    const h = await start('ADMIN', '/no-such-page');
    const link = root(h).querySelector<HTMLAnchorElement>('a.nav-link[href="/monitor/"]');
    expect(link?.textContent?.trim()).toBe('Monitor');
    expect(link?.target).toBe('_blank');
    const tab = { opener: {}, location: { href: '' } };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    link!.click();
    expect(open).toHaveBeenCalledWith('', '_blank');
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/monitor-session').flush(null, { status: 204, statusText: 'No Content' });
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe('/monitor/');
    open.mockRestore();
  });

  it('API Docs is admin only and opens Swagger in a new tab after the API sets its cookie', async () => {
    const viewer = await start('VIEWER', '/no-such-page');
    expect(navLabels(viewer)).not.toContain('API Docs');
    TestBed.resetTestingModule();

    const h = await start('ADMIN', '/no-such-page');
    const link = root(h).querySelector<HTMLAnchorElement>('a.nav-link[href="/swagger/index.html"]');
    expect(link?.textContent?.trim()).toBe('API Docs');
    const tab = { opener: {}, location: { href: '' } };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    link!.click();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/monitor-session').flush(null, { status: 204, statusText: 'No Content' });
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe('/swagger/index.html');
    open.mockRestore();
  });

  it('Google Sheet is admin only and opens the configured sheet in a new tab', async () => {
    const viewer = await start('VIEWER', '/no-such-page');
    expect(navLabels(viewer)).not.toContain('Google Sheet');
    TestBed.resetTestingModule();

    const h = await start('ADMIN', '/no-such-page');
    const link = root(h).querySelector<HTMLAnchorElement>('a.nav-link[data-nav="sheet"]');
    expect(link?.textContent?.trim()).toBe('Google Sheet');
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    link!.click();
    expect(open).toHaveBeenCalledWith('', '_blank');
    const url = 'https://docs.google.com/spreadsheets/d/abc/edit';
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/sheet').flush({ url });
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe(url);
    open.mockRestore();
  });

  it('keeps a user who must change the password on Settings (UX-059)', async () => {
    await start('VIEWER', '/dashboard', { mustChangePassword: true });
    expect(TestBed.inject(Router).url).toBe('/settings');
    await TestBed.inject(Router).navigateByUrl('/predictions');
    expect(TestBed.inject(Router).url).toBe('/settings');
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

describe('shell header and rail', () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('Sign out keeps its accessible name when the label is hidden on phones (DS-1)', async () => {
    const h = await start('ADMIN', '/x');
    const out = [...root(h).querySelectorAll('button')].find(b => b.querySelector('.pi-sign-out'))!;
    expect(out.getAttribute('aria-label')).toBe('Sign out');
    expect(out.querySelector('i')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('a rail collapsed on desktop still shows labels in the mobile drawer (DS-4)', async () => {
    localStorage.setItem('matchmind.nav-collapsed', 'true');
    vi.stubGlobal('innerWidth', 600);
    const phone = await start('ADMIN', '/x');
    expect(root(phone).querySelector('.nav-link span')?.textContent).toBe('Dashboard');
    expect(root(phone).querySelector('.shell')!.classList.contains('nav-collapsed')).toBe(false);
    TestBed.resetTestingModule();
    vi.stubGlobal('innerWidth', 1280);
    const desktop = await start('ADMIN', '/x');
    expect(root(desktop).querySelector('.nav-link span')).toBeNull();
    expect(root(desktop).querySelector('.shell')!.classList.contains('nav-collapsed')).toBe(true);
  });
});
