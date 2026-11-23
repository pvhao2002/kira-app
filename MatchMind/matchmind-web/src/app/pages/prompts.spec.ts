import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../core/auth.service';
import { authInterceptor } from '../core/http';
import { PromptTemplate } from '../core/models';
import { CopyService } from '../shared/copy';
import { ConfirmService, ToastService } from '../shared/kit';
import { PromptsPage, lineDiff } from './prompts';

const admin = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const viewer = { ...admin, id: 'u2', username: 'kim', role: 'VIEWER' };
const signIn = (u: object = admin) => sessionStorage.setItem('matchmind.session',
  JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: u }));
const prompt: PromptTemplate = {
  id: 'p1', name: 'Prediction', templateType: 'AI_PREDICTION', content: 'line one\nline two\nkey {{EXTERNAL_API_KEY}}', description: null,
  version: 3, active: true, updatedBy: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
};
const other: PromptTemplate = { ...prompt, id: 'p2', name: 'Settlement', templateType: 'AI_SETTLEMENT', content: 'settle' };
const providers = [
  { id: 'pv1', code: 'openclaw', name: 'OpenClaw', status: 'ACTIVE', activeKeys: 2, models: 0, predictions: 0, lastCallbackAt: null, createdAt: '' },
  { id: 'pv2', code: 'newbie', name: 'Newbie', status: 'ACTIVE', activeKeys: 0, models: 0, predictions: 0, lastCallbackAt: null, createdAt: '' },
];
const key = (id: string, keyId: string, lastUsedAt: string | null) =>
  ({ id, keyId, label: null, scopes: ['PREDICTIONS'], status: 'ACTIVE', createdAt: '2026-11-01T00:00:00Z', lastUsedAt, revokedAt: null });
const issued = (id: string) => ({ id, keyId: 'k-new', label: null, apiKey: 'mmk_new_secret', scopes: ['PREDICTIONS'], createdAt: '' });
const forAgentNoShared = (r: { url: string; params: { get(k: string): string | null } }) =>
  r.url === '/api/v1/prompts/p1/for-agent' && r.params.get('sharedKey') === 'false';
const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

describe('lineDiff', () => {
  it('marks removed and added lines and keeps the common ones', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc\nd')).toEqual([
      { op: ' ', text: 'a' }, { op: '-', text: 'b' }, { op: '+', text: 'B' }, { op: ' ', text: 'c' }, { op: '+', text: 'd' },
    ]);
    expect(lineDiff('same', 'same')).toEqual([{ op: ' ', text: 'same' }]);
  });
});

describe('PromptsPage (W5)', () => {
  let http: HttpTestingController;

  function setup(u: object = admin) {
    sessionStorage.clear();
    signIn(u);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  }
  afterEach(() => { http.verify(); Reflect.deleteProperty(navigator, 'clipboard'); });

  async function open(list = [prompt, other]) {
    const f = TestBed.createComponent(PromptsPage);
    f.detectChanges();
    http.expectOne('/api/v1/prompts').flush(list);
    TestBed.tick();
    http.match('/api/v1/providers').forEach(r => r.flush(providers));   // admins load the provider picker
    await f.whenStable();
    return f;
  }

  describe('as admin', () => {
    beforeEach(() => setup());

    it('labels template types with capitalised acronyms (UX-007)', async () => {
      const f = await open();
      expect(text(f.nativeElement)).toContain('AI prediction');
      expect(text(f.nativeElement)).not.toContain('Ai prediction');
    });

    it('re-selecting the template being edited does not ask to discard (UX-056)', async () => {
      const f = await open();
      const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask');
      f.componentInstance.startEdit();
      f.componentInstance.draft.set('changed');
      await f.componentInstance.select(prompt);
      expect(ask).not.toHaveBeenCalled();
      expect(f.componentInstance.editing()).toBe(true);
      expect(f.componentInstance.draft()).toBe('changed');
    });

    it('shows the 200 000 character limit and blocks Save above it (UX-116)', async () => {
      const f = await open();
      f.componentInstance.startEdit();
      f.componentInstance.draft.set('x'.repeat(200_001));
      await f.whenStable();
      expect(text(f.nativeElement)).toContain('200,001 / 200,000');
      expect((f.nativeElement.querySelector('[data-testid="prompt-save"]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows the field error of a rejected save (UX-116)', async () => {
      const f = await open();
      f.componentInstance.startEdit();
      f.componentInstance.draft.set('new text');
      f.componentInstance.save();
      http.expectOne('/api/v1/prompts/p1').flush({ status: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed',
        fieldErrors: { description: 'size must be between 0 and 2000' } }, { status: 400, statusText: 'Bad Request' });
      await f.whenStable();
      expect(text(f.nativeElement)).toContain('size must be between 0 and 2000');
    });

    it('lists versions, shows a diff against the current text and restores with expectedVersion (UX-060)', async () => {
      const f = await open();
      f.componentInstance.openHistory();
      http.expectOne('/api/v1/prompts/p1/versions').flush([
        { version: 3, description: null, active: true, updatedBy: 'u1', updatedByUsername: 'admin', createdAt: '2026-01-02T00:00:00Z' },
        { version: 2, description: null, active: true, updatedBy: 'u1', updatedByUsername: 'admin', createdAt: '2026-01-01T00:00:00Z' },
      ]);
      await f.whenStable();
      f.componentInstance.viewVersion(2);
      http.expectOne('/api/v1/prompts/p1/versions/2').flush({ version: 2, description: null, active: true, updatedBy: 'u1',
        updatedByUsername: 'admin', createdAt: '2026-01-01T00:00:00Z', content: 'line one\nold line\nkey {{EXTERNAL_API_KEY}}' });
      await f.whenStable();
      const diff = text(document.querySelector('[data-testid="prompt-diff"]') as HTMLElement);
      expect(diff).toContain('- old line');
      expect(diff).toContain('+ line two');

      const restoring = f.componentInstance.restore();
      const confirm = TestBed.inject(ConfirmService);
      await vi.waitFor(() => expect(confirm.current()?.header).toBe('Restore v2?'));   // PROMPT-10
      http.expectNone('/api/v1/prompts/p1/versions/2/restore');
      confirm.answer(true);
      await restoring;
      const req = http.expectOne('/api/v1/prompts/p1/versions/2/restore');
      expect(req.request.body).toEqual({ expectedVersion: 3 });
      req.flush({ ...prompt, content: 'line one\nold line\nkey {{EXTERNAL_API_KEY}}', version: 4 });
      await f.whenStable();
      expect(f.componentInstance.selected()?.version).toBe(4);
      expect(f.componentInstance.history()).toBeNull();
    });

    it('declining the restore confirm sends nothing (PROMPT-10)', async () => {
      const f = await open();
      f.componentInstance.openHistory();
      http.expectOne('/api/v1/prompts/p1/versions').flush([{ version: 2, description: null, active: true, updatedBy: 'u1', updatedByUsername: 'admin', createdAt: '' }]);
      await f.whenStable();
      f.componentInstance.viewVersion(2);
      http.expectOne('/api/v1/prompts/p1/versions/2').flush({ version: 2, description: null, active: true, updatedBy: 'u1', updatedByUsername: 'admin', createdAt: '', content: 'old' });
      await f.whenStable();
      const restoring = f.componentInstance.restore();
      const confirm = TestBed.inject(ConfirmService);
      await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
      confirm.answer(false);
      await restoring;
      http.expectNone(r => r.url.endsWith('/restore'));
    });

    it('History shows a busy state, and a repeat click sends no second request (PROMPT-6)', async () => {
      const f = await open();
      const btn = f.nativeElement.querySelector('[data-testid="prompt-history"]') as HTMLButtonElement;
      btn.click();
      f.detectChanges();
      expect(btn.disabled).toBe(true);
      expect(btn.querySelector('.pi-spinner')).not.toBeNull();
      f.componentInstance.openHistory();
      http.expectOne('/api/v1/prompts/p1/versions').flush([]);
      f.detectChanges();
      expect(btn.disabled).toBe(false);
    });

    it('picking a version clears the old diff and shows a loading state until the new one arrives (PROMPT-7)', async () => {
      const f = await open();
      f.componentInstance.openHistory();
      http.expectOne('/api/v1/prompts/p1/versions').flush([]);
      f.componentInstance.viewVersion(2);
      http.expectOne('/api/v1/prompts/p1/versions/2').flush({ version: 2, content: 'two', description: null, active: true, updatedBy: null, updatedByUsername: null, createdAt: '' });
      f.componentInstance.viewVersion(1);
      f.componentInstance.viewVersion(2);
      expect(f.componentInstance.version()).toBeNull();
      expect(f.componentInstance.loadingVersion()).toBe(true);
      const [v1, v2] = [http.expectOne('/api/v1/prompts/p1/versions/1'), http.expectOne('/api/v1/prompts/p1/versions/2')];
      v2.flush({ version: 2, content: 'two', description: null, active: true, updatedBy: null, updatedByUsername: null, createdAt: '' });
      v1.flush({ version: 1, content: 'one', description: null, active: true, updatedBy: null, updatedByUsername: null, createdAt: '' });   // late answer of an older click
      expect(f.componentInstance.version()?.version).toBe(2);
      expect(f.componentInstance.loadingVersion()).toBe(false);
    });

    it('closing the create dialog with typed text asks first; an empty one closes at once (PROMPT-2)', async () => {
      const f = await open();
      f.componentInstance.openCreate();
      await f.componentInstance.closeCreate();
      expect(f.componentInstance.creating()).toBe(false);

      f.componentInstance.openCreate();
      f.componentInstance.newName.set('Draft');
      const confirm = TestBed.inject(ConfirmService);
      const closing = f.componentInstance.closeCreate();
      await vi.waitFor(() => expect(confirm.current()?.header).toBe('Discard changes?'));
      confirm.answer(false);
      await closing;
      expect(f.componentInstance.creating()).toBe(true);
      const again = f.componentInstance.closeCreate();
      await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
      confirm.answer(true);
      await again;
      expect(f.componentInstance.creating()).toBe(false);
    });

    it('an invalid type is marked aria-invalid in the create dialog (PROMPT-4)', async () => {
      const f = await open();
      f.componentInstance.openCreate();
      f.componentInstance.newType.set('bad type');
      f.detectChanges();
      const input = document.querySelector('#np-type') as HTMLInputElement;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('np-type-hint');
    });

    it('Copy has a busy state on the shared-key path too, and a double click sends one request (PROMPT-8)', async () => {
      const f = await open();
      f.componentInstance.copy();
      f.componentInstance.copy();
      expect(f.componentInstance.copying()).toBe(true);
      http.expectOne('/api/v1/prompts/p1/for-agent').flush({ content: 'x', keyRendered: true });
      expect(f.componentInstance.copying()).toBe(false);
    });

    it('"Copy for:" is a visible label of the provider select (PROMPT-14)', async () => {
      const f = await open();
      const label = f.nativeElement.querySelector('label[for="prompt-provider"]') as HTMLElement;
      expect(label.textContent).toContain('Copy for:');
      expect(f.nativeElement.querySelector('button#prompt-provider[role="combobox"]')).not.toBeNull();
    });

    it('a session that ends while editing keeps the draft without a blocking dialog and restores it after sign-in (UX-048)', async () => {
      const f = await open();
      f.componentInstance.startEdit();
      f.componentInstance.draft.set('half-written prompt');
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask');
      TestBed.inject(AuthService).expire();
      expect(f.componentInstance.canLeave()).toBe(true);
      expect(ask).not.toHaveBeenCalled();
      f.destroy();

      TestBed.resetTestingModule();
      signIn();
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
      http = TestBed.inject(HttpTestingController);
      const g = TestBed.createComponent(PromptsPage);
      g.detectChanges();
      http.expectOne('/api/v1/prompts').flush([prompt, other]);
      TestBed.tick();
      http.match('/api/v1/providers').forEach(r => r.flush(providers));
      await g.whenStable();
      expect(g.componentInstance.editing()).toBe(true);
      expect(g.componentInstance.draft()).toBe('half-written prompt');
      expect(text(g.nativeElement)).toContain('Restored your unsaved changes');
    });
  });

  it('a draft saved by another user is not restored', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('matchmind.prompt-draft', JSON.stringify({ user: 'admin', promptId: 'p1', content: 'theirs', description: '', active: true, version: 3 }));
    signIn(viewer);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const f = await open();
    expect(f.componentInstance.editing()).toBe(false);
    expect(sessionStorage.getItem('matchmind.prompt-draft')).toBeNull();
  });

  it('an admin copy without a shared key points to the Providers screen (per-provider keys)', async () => {
    setup(admin);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    const f = await open();
    (f.nativeElement.querySelector('[data-testid="prompt-copy"]') as HTMLElement).click();
    http.expectOne('/api/v1/prompts/p1/for-agent').flush({ content: 'key {{EXTERNAL_API_KEY}}', keyRendered: false });
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn', detail: expect.stringContaining('Providers') })));
  });

  it('a viewer copy says the key placeholder is still in the text (UX-060)', async () => {
    setup(viewer);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    const f = await open();
    (f.nativeElement.querySelector('[data-testid="prompt-copy"]') as HTMLElement).click();
    http.expectOne('/api/v1/prompts/p1/for-agent').flush({ content: 'key {{EXTERNAL_API_KEY}}', keyRendered: false });
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('key {{EXTERNAL_API_KEY}}'));
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn', detail: expect.stringContaining('{{EXTERNAL_API_KEY}}') })));
    expect(TestBed.inject(CopyService).manual()).toBeNull();
  });

  describe('copy for a provider (admin)', () => {
    const withProvider = 'key {{EXTERNAL_API_KEY}} X-Provider: <your provider name>';
    let writeText: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      setup(admin);
      writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });
    const copyFor = async (providerId: string) => {
      const f = await open();
      f.componentInstance.providerId.set(providerId);
      f.componentInstance.copy();
      return f;
    };

    it('rotates the most recently used active key after a confirm, and fills the new key and the provider code', async () => {
      await copyFor('pv1');
      http.expectOne('/api/v1/providers/pv1/keys').flush([key('r1', 'k-old', '2026-11-01T00:00:00Z'), key('r2', 'k-recent', '2026-11-20T00:00:00Z')]);
      const confirm = TestBed.inject(ConfirmService);
      await vi.waitFor(() => expect(confirm.current()?.message).toContain('k-recent'));
      confirm.answer(true);
      await vi.waitFor(() => http.expectOne(forAgentNoShared).flush({ content: withProvider, keyRendered: false }));
      await vi.waitFor(() => http.expectOne('/api/v1/providers/pv1/keys/r2/rotate').flush(issued('r3')));
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('key mmk_new_secret X-Provider: openclaw'));
    });

    it('declining the rotation confirm rotates and copies nothing', async () => {
      await copyFor('pv1');
      http.expectOne('/api/v1/providers/pv1/keys').flush([key('r1', 'k-old', null)]);
      const confirm = TestBed.inject(ConfirmService);
      await vi.waitFor(() => expect(confirm.current()).not.toBeNull());
      confirm.answer(false);
      await Promise.resolve();
      http.expectNone(r => r.url.includes('/rotate'));
      expect(writeText).not.toHaveBeenCalled();
    });

    it('a provider without keys uses the shared key and names the provider in X-Provider', async () => {
      await copyFor('pv2');
      http.expectOne('/api/v1/providers/pv2/keys').flush([key('r9', 'k-gone', null), { ...key('r8', 'k-x', null), status: 'REVOKED' }].slice(1));
      await vi.waitFor(() => http.expectOne(r => r.url === '/api/v1/prompts/p1/for-agent' && r.params.get('sharedKey') === null)
        .flush({ content: 'key shared-secret X-Provider: <your provider name>', keyRendered: true }));
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('key shared-secret X-Provider: newbie'));
      http.expectNone('/api/v1/providers/pv2/keys');
    });

    it('a provider without keys, on a server without a shared key, gets a new key issued and filled in', async () => {
      await copyFor('pv2');
      http.expectOne('/api/v1/providers/pv2/keys').flush([]);
      await vi.waitFor(() => http.expectOne(r => r.url === '/api/v1/prompts/p1/for-agent' && r.params.get('sharedKey') === null)
        .flush({ content: withProvider, keyRendered: false }));
      await vi.waitFor(() => http.expectOne(forAgentNoShared).flush({ content: withProvider, keyRendered: false }));
      await vi.waitFor(() => {
        const r = http.expectOne(x => x.method === 'POST' && x.url === '/api/v1/providers/pv2/keys');
        expect(r.request.body.scopes).toEqual(['PREDICTIONS', 'SETTLE_REQUEST']);
        r.flush(issued('r10'));
      });
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('key mmk_new_secret X-Provider: newbie'));
    });
  });
});
