import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IssuedKey, Provider, User } from '../core/models';
import { ConfirmService } from '../shared/kit';
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

  const KEY = { id: 'k1', keyId: 'abcdefghijkl', label: null, scopes: ['PREDICTIONS'], status: 'ACTIVE', createdAt: '', lastUsedAt: null, revokedAt: null };
  const ISSUED: IssuedKey = { id: 'k2', keyId: 'zzzzzzzzzzzz', label: null, apiKey: SECRET, scopes: ['PREDICTIONS'], createdAt: '' };

  async function openKeys(prompts: unknown[] = []) {
    const f = await open(admin);
    q<HTMLButtonElement>(f, '[data-testid="keys-acme"]').click();
    http.expectOne('/api/v1/providers/p1/keys').flush([KEY]);
    http.expectOne('/api/v1/prompts').flush(prompts);
    f.detectChanges();
    return f;
  }

  it('rotating asks first and sends nothing when declined (PROV-1)', async () => {
    const f = await openKeys();
    const confirm = TestBed.inject(ConfirmService);
    let rotating = f.componentInstance.rotate(KEY as never);
    await vi.waitFor(() => expect(confirm.current()?.header).toBe('Rotate key abcdefghijkl?'));
    expect(confirm.current()?.danger).toBe(true);
    confirm.answer(false);
    await rotating;
    http.expectNone(r => r.url.endsWith('/rotate'));

    rotating = f.componentInstance.rotate(KEY as never);
    await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
    confirm.answer(true);
    await rotating;
    http.expectOne('/api/v1/providers/p1/keys/k1/rotate').flush(ISSUED);
    http.expectOne('/api/v1/providers/p1/keys').flush([KEY]);
    expect(f.componentInstance.issued()?.apiKey).toBe(SECRET);
  });

  it('masks the issued key, copies the raw value, and warns before closing while it is uncopied (PROV-12, PROV-2)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const f = await openKeys();
    q<HTMLButtonElement>(f, '[data-testid="issue-key"]').click();
    http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/providers/p1/keys').flush(ISSUED);
    http.expectOne('/api/v1/providers/p1/keys').flush([KEY]);
    f.detectChanges();
    const input = q<HTMLInputElement>(f, '#pv-key');
    expect(input.type).toBe('password');
    q<HTMLButtonElement>(f, 'button[aria-label="Show key"]').click();
    f.detectChanges();
    expect(input.type).toBe('text');

    // Uncopied: closing asks first, and declining keeps the key on screen.
    const confirm = TestBed.inject(ConfirmService);
    const closing = f.componentInstance.askCloseKeys();
    await vi.waitFor(() => expect(confirm.current()?.header).toBe('Close without copying the key?'));
    confirm.answer(false);
    await closing;
    expect(f.componentInstance.issued()).not.toBeNull();

    // Copied: closing is silent.
    q<HTMLButtonElement>(f, '[data-testid="copy-key"]').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET));
    await f.componentInstance.askCloseKeys();
    TestBed.tick();
    http.expectOne(r => r.url === '/api/v1/providers').flush([acme]);
    expect(confirm.current()).toBeNull();
    expect(f.componentInstance.keysFor()).toBeNull();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('a key-list failure is its own error with a Retry, not the issue-form error (PROV-5)', async () => {
    const f = await open(admin);
    q<HTMLButtonElement>(f, '[data-testid="keys-acme"]').click();
    http.expectOne('/api/v1/providers/p1/keys').flush({ status: 500, code: 'INTERNAL', message: 'Keys are down' }, { status: 500, statusText: 'Server Error' });
    http.expectOne('/api/v1/prompts').flush([]);
    f.detectChanges();
    expect(text(q(f, '[data-testid="keys-error"]'))).toContain('Keys are down');
    expect(f.componentInstance.formError()).toBe('');
    q<HTMLButtonElement>(f, '[data-testid="keys-error"] button').click();
    http.expectOne('/api/v1/providers/p1/keys').flush([KEY]);
    f.detectChanges();
    expect(q(f, '[data-testid="keys-error"]')).toBeNull();
  });

  it('does not say "No keys yet" while the keys load (PROV-4)', async () => {
    const f = await open(admin);
    q<HTMLButtonElement>(f, '[data-testid="keys-acme"]').click();
    f.detectChanges();
    expect(text(f.nativeElement)).not.toContain('No keys yet');
    http.expectOne('/api/v1/providers/p1/keys').flush([]);
    http.expectOne('/api/v1/prompts').flush([]);
    f.detectChanges();
    expect(text(f.nativeElement)).toContain('No keys yet');
  });

  it('explains an empty prompt list instead of showing an empty select (PROV-11)', async () => {
    const f = await openKeys([{ id: 't1', name: 'No key slot', content: 'nothing here' }]);
    f.componentInstance.issued.set(ISSUED);
    f.detectChanges();
    expect(text(q(f, '[data-testid="no-prompt"]'))).toContain('No prompt contains {{EXTERNAL_API_KEY}}');
    expect(q(f, '[data-testid="copy-prompt-with-key"]')).toBeNull();
  });

  it('flags a code that breaks the rule (PROV-16)', async () => {
    const f = await open(admin);
    f.componentInstance.openEdit(null);
    f.detectChanges();
    f.componentInstance.patchEdit({ code: 'Bad Code', name: 'X' });
    f.detectChanges();
    expect(q<HTMLInputElement>(f, '#pv-code').getAttribute('aria-invalid')).toBe('true');
    expect(f.componentInstance.codeBad('ok_code-1')).toBe(false);
  });
});
