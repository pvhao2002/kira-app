import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider, User } from '../core/models';
import { ProvidersPage } from './providers';

const admin: User = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const viewer: User = { ...admin, id: 'u2', username: 'kim', role: 'VIEWER' };
const acme: Provider = {
  id: 'p1', code: 'acme', name: 'Acme', models: 2, predictions: 5, lastCallbackAt: null, createdAt: '', archivedAt: null,
  status: 'ACTIVE', activeKeys: 1,
};
const old: Provider = { ...acme, id: 'p2', code: 'old', name: 'Old', archivedAt: '2026-11-01T00:00:00Z' };
const SECRET = 'mmk_abcdefghijkl_secret-secret-secret-secret-secret-secret-0';
const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';
const q = <T extends HTMLElement>(f: ComponentFixture<unknown>, sel: string) => f.nativeElement.querySelector(sel) as T;

describe('ProvidersPage (UX-019)', () => {
  let http: HttpTestingController;
  afterEach(() => http.verify());

  async function open(user: User) {
    sessionStorage.clear();
    sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(ProvidersPage);
    f.detectChanges();
    TestBed.tick();
    http.expectOne(r => r.url === '/api/v1/providers' && r.params.get('includeArchived') === 'true').flush([acme, old]);
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  it('a viewer sees the list without any action', async () => {
    const f = await open(viewer);
    expect(text(f.nativeElement)).toContain('acme');
    expect(text(f.nativeElement)).not.toContain('Old'); // archived rows hidden by default
    expect(q(f, '[data-testid="add-provider"]')).toBeNull();
    expect(q(f, '[data-testid="keys-acme"]')).toBeNull();
    expect(q(f, '[data-testid="archive-acme"]')).toBeNull();
  });

  it('shows an issued key once and clears it when the keys dialog closes', async () => {
    const f = await open(admin);
    q<HTMLButtonElement>(f, '[data-testid="keys-acme"]').click();
    http.expectOne('/api/v1/providers/p1/keys').flush([]);
    http.expectOne('/api/v1/prompts').flush([]);
    f.detectChanges();

    q<HTMLButtonElement>(f, '[data-testid="issue-key"]').click();
    const issue = http.expectOne('/api/v1/providers/p1/keys');
    expect(issue.request.method).toBe('POST');
    expect(issue.request.body.scopes).toEqual(['PREDICTIONS', 'SETTLE_REQUEST']);
    issue.flush({ id: 'k1', keyId: 'abcdefghijkl', label: null, apiKey: SECRET, scopes: ['PREDICTIONS', 'SETTLE_REQUEST'], createdAt: '' });
    http.expectOne('/api/v1/providers/p1/keys').flush([{ id: 'k1', keyId: 'abcdefghijkl', label: null, scopes: ['PREDICTIONS', 'SETTLE_REQUEST'],
      status: 'ACTIVE', createdAt: '', lastUsedAt: null, revokedAt: null }]);
    f.detectChanges();
    expect(text(f.nativeElement)).toContain('You will not see this key again');
    expect(q<HTMLInputElement>(f, '#pv-key').value).toBe(SECRET);

    f.componentInstance.closeKeys();
    TestBed.tick();
    http.expectOne(r => r.url === '/api/v1/providers').flush([acme, old]);
    f.detectChanges();
    expect(f.componentInstance.issued()).toBeNull();
    expect(f.nativeElement.innerHTML).not.toContain(SECRET);
  });

  it('copies the prompt with the new key filled in by the browser, asking the API not to add the shared key', async () => {
    const f = await open(admin);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    f.componentInstance.promptId.set('t1');
    f.componentInstance.copyPrompt({ id: 'k1', keyId: 'abcdefghijkl', label: null, apiKey: SECRET, scopes: ['PREDICTIONS'], createdAt: '' });
    const req = http.expectOne(r => r.url === '/api/v1/prompts/t1/for-agent');
    expect(req.request.params.get('sharedKey')).toBe('false');
    req.flush({ content: 'X-Api-Key: {{EXTERNAL_API_KEY}}', keyRendered: false });
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(`X-Api-Key: ${SECRET}`));
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('archives a provider with a reason', async () => {
    const f = await open(admin);
    q<HTMLButtonElement>(f, '[data-testid="archive-acme"]').click();
    f.detectChanges();
    const action = f.componentInstance.action()!;
    expect(action.header).toContain('Archive provider Acme');
    action.run('duplicate').subscribe();
    const req = http.expectOne('/api/v1/providers/p1/archive');
    expect(req.request.body).toEqual({ reason: 'duplicate' });
    req.flush(acme);
  });
});
