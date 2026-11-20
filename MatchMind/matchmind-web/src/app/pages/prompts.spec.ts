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

      f.componentInstance.restore();
      const req = http.expectOne('/api/v1/prompts/p1/versions/2/restore');
      expect(req.request.body).toEqual({ expectedVersion: 3 });
      req.flush({ ...prompt, content: 'line one\nold line\nkey {{EXTERNAL_API_KEY}}', version: 4 });
      await f.whenStable();
      expect(f.componentInstance.selected()?.version).toBe(4);
      expect(f.componentInstance.history()).toBeNull();
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
});
