import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ConfirmService, ResizableColumn, Sort, SortHeader } from '../shared/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptTemplate } from '../core/models';
import { LoginPage } from './login';
import { PromptsPage } from './prompts';

const admin = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const signIn = () => sessionStorage.setItem('matchmind.session',
  JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: admin }));

function setup() {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.inject(HttpTestingController);
}

const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

describe('LoginPage', () => {
  let http: HttpTestingController;
  beforeEach(() => { sessionStorage.clear(); http = setup(); });
  afterEach(() => http.verify());

  it('shows required-field errors and sends nothing when the form is empty', async () => {
    const f = TestBed.createComponent(LoginPage);
    await f.whenStable();
    (f.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await f.whenStable();
    expect(text(f.nativeElement)).toContain('Enter your username.');
    expect(text(f.nativeElement)).toContain('Enter your password.');
    http.expectNone('/api/v1/auth/login');
  });

  it('shows a clear message on wrong credentials', async () => {
    const f = TestBed.createComponent(LoginPage);
    await f.whenStable();
    f.componentInstance.form.setValue({ username: 'admin', password: 'wrong-password' });
    f.componentInstance.submit();
    http.expectOne('/api/v1/auth/login').flush({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }, { status: 401, statusText: 'Unauthorized' });
    await f.whenStable();
    expect(f.nativeElement.querySelector('[data-testid="login-error"]').textContent).toContain('Wrong username or password.');
    expect(f.componentInstance.busy()).toBe(false);
  });

  it('navigates to the dashboard after signing in', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(LoginPage);
    await f.whenStable();
    f.componentInstance.form.setValue({ username: ' admin ', password: 'right-password' });
    f.componentInstance.submit();
    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.body.username).toBe('admin');
    req.flush({ accessToken: 'jwt', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: admin });
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
});

describe('PromptsPage', () => {
  let http: HttpTestingController;
  const prompt: PromptTemplate = {
    id: 'p1', name: 'AI Football Prediction Prompt', templateType: 'AI_PREDICTION', content: 'Original prompt', description: null,
    version: 3, active: true, updatedBy: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
  };

  beforeEach(() => { sessionStorage.clear(); signIn(); http = setup(); });
  afterEach(() => http.verify());

  async function open() {
    const f = TestBed.createComponent(PromptsPage);
    f.detectChanges();
    http.expectOne('/api/v1/prompts').flush([prompt]);
    TestBed.tick();
    http.match('/api/v1/providers').forEach(r => r.flush([]));   // admins load the provider picker
    await f.whenStable();
    return f;
  }
  const q = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it('shows the prompt read-only until Edit, and Cancel restores the saved text', async () => {
    const f = await open();
    expect(q(f, 'prompt-view')!.textContent).toContain('Original prompt');
    expect(q(f, 'prompt-content')).toBeNull();

    f.componentInstance.startEdit();
    await f.whenStable();
    f.componentInstance.draft.set('Changed');
    const done = f.componentInstance.cancel();
    TestBed.inject(ConfirmService).answer(true);
    await done;
    await f.whenStable();
    expect(f.componentInstance.editing()).toBe(false);
    expect(q(f, 'prompt-view')!.textContent).toContain('Original prompt');
  });

  it('keeps editing when the discard dialog is declined, and asks before leaving the page', async () => {
    const f = await open();
    f.componentInstance.startEdit();
    f.componentInstance.draft.set('Changed');
    const done = f.componentInstance.cancel();
    TestBed.inject(ConfirmService).answer(false);
    await done;
    expect(f.componentInstance.editing()).toBe(true);
    const leave = f.componentInstance.canLeave() as Promise<boolean>;
    TestBed.inject(ConfirmService).answer(true);
    expect(await leave).toBe(true);
  });

  it('saves with the expected version and shows the new version', async () => {
    const f = await open();
    f.componentInstance.startEdit();
    f.componentInstance.draft.set('Improved prompt');
    f.componentInstance.save();
    const req = http.expectOne('/api/v1/prompts/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ content: 'Improved prompt', description: null, active: true, expectedVersion: 3 });
    req.flush({ ...prompt, content: 'Improved prompt', version: 4 });
    await f.whenStable();
    expect(f.componentInstance.editing()).toBe(false);
    expect(q(f, 'prompt-view')!.textContent).toContain('Improved prompt');
    expect(text(f.nativeElement)).toContain('version 4');
  });

  it('keeps the draft and warns on a version conflict', async () => {
    const f = await open();
    f.componentInstance.startEdit();
    f.componentInstance.draft.set('My edits');
    f.componentInstance.save();
    http.expectOne('/api/v1/prompts/p1').flush({ status: 409, code: 'PROMPT_VERSION_CONFLICT', message: 'stale' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    expect(f.componentInstance.conflict()).toBe(true);
    expect(f.componentInstance.editing()).toBe(true);
    expect(f.componentInstance.draft()).toBe('My edits');
    expect(text(f.nativeElement)).toContain('Someone saved a newer version');
  });

  it('after a conflict and reload, saving still sends the version the draft started from', async () => {
    const f = await open();
    f.componentInstance.startEdit();
    f.componentInstance.draft.set('My edits');
    f.componentInstance.save();
    http.expectOne('/api/v1/prompts/p1').flush({ status: 409, code: 'PROMPT_VERSION_CONFLICT', message: 'stale' }, { status: 409, statusText: 'Conflict' });
    f.componentInstance.reloadLatest();
    http.expectOne('/api/v1/prompts').flush([{ ...prompt, content: 'Their edits', version: 4 }]);
    await f.whenStable();
    expect(f.componentInstance.draft()).toBe('My edits');
    f.componentInstance.save();
    const req = http.expectOne('/api/v1/prompts/p1');
    expect(req.request.body.expectedVersion).toBe(3); // never 4: that would overwrite their save
    req.flush({ status: 409, code: 'PROMPT_VERSION_CONFLICT', message: 'stale' }, { status: 409, statusText: 'Conflict' });
  });

  it('an admin copies the prompt with the agent API key filled in by the server', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const f = await open();
    q(f, 'prompt-copy')!.click();
    http.expectOne('/api/v1/prompts/p1/for-agent').flush({ content: 'Original prompt, key filled in' });
    expect(writeText).toHaveBeenCalledWith('Original prompt, key filled in');
  });
});

describe('ConfirmService', () => {
  it('resolves the pending question with the answer, and a new question cancels the old one', async () => {
    const c = new ConfirmService();
    const first = c.ask({ header: 'Revoke key?', message: 'm', acceptLabel: 'Revoke', danger: true });
    const second = c.ask({ header: 'Disable provider?', message: 'm', acceptLabel: 'Disable' });
    expect(await first).toBe(false);
    expect(c.current()?.header).toBe('Disable provider?');
    c.answer(true);
    expect(await second).toBe(true);
    expect(c.current()).toBeNull();
  });
});

@Component({
  imports: [SortHeader, ResizableColumn],
  template: `<table><thead><tr><th mmResize mmSort="winRate" [(sort)]="sort">Win rate</th></tr></thead></table>`,
})
class SortableResizableHost { readonly sort = signal<Sort>(null); }

describe('table header kit', () => {
  it('a header can be both sortable and resizable; clicks cycle desc then asc', async () => {
    const f = TestBed.createComponent(SortableResizableHost);
    await f.whenStable();
    const th = f.nativeElement.querySelector('th') as HTMLElement;
    expect(th.querySelector('.col-resizer')).not.toBeNull();
    expect(th.getAttribute('aria-sort')).toBe('none');
    th.querySelector('button')!.click();
    await f.whenStable();
    expect(f.componentInstance.sort()).toEqual({ field: 'winRate', dir: 'desc' });
    expect(th.getAttribute('aria-sort')).toBe('descending');
    th.querySelector('button')!.click();
    await f.whenStable();
    expect(f.componentInstance.sort()).toEqual({ field: 'winRate', dir: 'asc' });
    expect(th.querySelector('.col-resizer')).not.toBeNull();
  });
});
