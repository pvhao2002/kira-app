import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportPage, SAMPLE_PREDICTION, previewOf, readAgentOutput } from './import';

describe('readAgentOutput', () => {
  it('takes the model name and the JSON body out of what a sandboxed agent printed', () => {
    const out = readAgentOutput('CANNOT_CALL_API\nX-Model-Name: gpt-5.1\n```json\n{ "match": { "homeTeam": "A" }, "odds": [ { "x": 1 } ] }\n```\nGood luck!');
    expect(out.model).toBe('gpt-5.1');
    expect(JSON.parse(out.json!)).toEqual({ match: { homeTeam: 'A' }, odds: [{ x: 1 }] });
    expect(out.error).toBe('');
  });

  it('accepts bare JSON and explains what is wrong otherwise', () => {
    expect(readAgentOutput(' {"a":1} ').json).toBe('{"a":1}');
    expect(readAgentOutput('no json here').error).toContain('No JSON object');
    expect(readAgentOutput('{"a": 1 "b": 2}').error).toContain('not valid JSON');
  });

  it('says where the JSON breaks, also when it is cut off (UX-015)', () => {
    const broken = readAgentOutput('{\n  "a": 1\n  "b": 2\n}');
    expect(broken.error).toContain('line 3');
    const cut = readAgentOutput('{ "eventId": "x",');
    expect(cut.error).toContain('not valid JSON');
    expect(cut.error).not.toContain('No JSON object');
  });

  it('cleans curly quotes and trailing commas and says so (UX-093)', () => {
    const out = readAgentOutput('{“a”: 1, “b”: [1, 2,],}');
    expect(out.error).toBe('');
    expect(out.cleaned).toBe(true);
    expect(out.items[0].data).toEqual({ a: 1, b: [1, 2] });
    expect(readAgentOutput('{"a": "it’s fine"}').cleaned).toBe(false);
  });

  it('reads a JSON array or several JSON blocks as several predictions (UX-055)', () => {
    expect(readAgentOutput('[{"a":1},{"a":2}]').items.map(i => i.data)).toEqual([{ a: 1 }, { a: 2 }]);
    const two = readAgentOutput('First:\n```json\n{"a":1}\n```\nSecond:\n```json\n{"a":2, "s": "}{"}\n```');
    expect(two.items.map(i => i.data)).toEqual([{ a: 1 }, { a: 2, s: '}{' }]);
  });

  it('recognises a match result pasted here (UX-066)', () => {
    const out = readAgentOutput('{"externalMatchId":"epl-1","status":"FINISHED","finalScore":{"home":2,"away":1}}');
    expect(out.items).toEqual([]);
    expect(out.error).toContain('match result');
  });

  it('previews match, picks and odds and lists missing required fields (UX-015)', () => {
    const p = previewOf(JSON.parse(SAMPLE_PREDICTION));
    expect(p).toEqual(expect.objectContaining({ match: 'Real Madrid v Barcelona', type: 'PRE_MATCH', picks: 2, odds: 5, model: 'GoalNet', missing: [] }));
    expect(previewOf({ match: { homeTeam: 'A' }, predictionType: 'LIVE' }).missing).toEqual(['match.awayTeam', 'odds', 'picks', 'correctScore', 'matchMinute', 'currentScore']);
  });
});

describe('ImportPage', () => {
  let http: HttpTestingController;
  const admin = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
  const json = (eventId: string) => JSON.stringify({ ...JSON.parse(SAMPLE_PREDICTION), eventId });
  const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: admin }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function open(): Promise<ComponentFixture<ImportPage>> {
    const f = TestBed.createComponent(ImportPage);
    f.detectChanges();
    http.expectOne('/api/v1/models').flush([{ id: 'm1', providerId: 'p1', providerName: 'ChatGPT', name: 'GoalNet', version: '2.1' }]);
    http.expectOne('/api/v1/providers').flush([{ id: 'p1', code: 'chatgpt', name: 'ChatGPT' }]);
    await f.whenStable();
    return f;
  }

  it('uses the JSON model when the Model field is empty and says which value wins (UX-033)', async () => {
    const f = await open();
    const c = f.componentInstance;
    c.provider.set('chatgpt');
    c.onPaste(SAMPLE_PREDICTION);
    await f.whenStable();
    expect(c.canSend()).toBe(true);
    expect(text(f.nativeElement)).toContain('GoalNet (from the JSON)');
    c.model.set('gpt-x');
    await f.whenStable();
    expect(text(f.nativeElement)).toContain('the Model field wins over "GoalNet" in the JSON');
    expect(text(f.nativeElement)).toContain('New model');
  });

  it('explains why Send is disabled (UX-066)', async () => {
    const f = await open();
    f.componentInstance.onPaste(SAMPLE_PREDICTION);
    await f.whenStable();
    expect(text(f.nativeElement.querySelector('#imp-hint'))).toContain('Enter the provider');
  });

  it('sends several predictions one after the other and lists each result (UX-055, UX-046)', async () => {
    const f = await open();
    const c = f.componentInstance;
    c.provider.set('chatgpt');
    c.onPaste(`[${json('e1')}, ${json('e2')}]`);
    const done = c.send();
    const first = http.expectOne(r => r.url === '/api/v1/predictions/import');
    expect(first.request.params.get('provider')).toBe('chatgpt');
    expect(first.request.params.has('model')).toBe(false);
    first.flush({ predictionId: 'pr1', matchId: 'm', duplicate: false, possibleDuplicateOf: null });
    (await vi.waitFor(() => http.expectOne(r => r.url === '/api/v1/predictions/import'))).flush({ predictionId: 'pr2', matchId: 'm', duplicate: false, possibleDuplicateOf: 'pr1' });
    await done;
    await f.whenStable();
    expect(c.results().map(r => r.status)).toEqual(['stored', 'stored']);
    const page = text(f.nativeElement);
    expect(page).toContain('Looks like a retry');
    expect(f.nativeElement.querySelector('a[href="/predictions/pr1"]')).not.toBeNull();
  });

  it('shows a match mismatch with the stored and sent teams, and a too-large body in plain words (UX-045, UX-055)', async () => {
    const f = await open();
    const c = f.componentInstance;
    c.provider.set('chatgpt');
    c.onPaste(`${json('e1')}\n${json('e2')}`);
    const done = c.send();
    http.expectOne(r => r.url === '/api/v1/predictions/import').flush({ status: 409, code: 'MATCH_MISMATCH',
      message: 'externalMatchId laliga-2026-rma-bar is already a match between other teams',
      fieldErrors: { 'match.homeTeam': "stored 'Real Madrid', sent 'Real Sociedad'" } }, { status: 409, statusText: 'Conflict' });
    (await vi.waitFor(() => http.expectOne(r => r.url === '/api/v1/predictions/import'))).flush('too big', { status: 413, statusText: 'Payload Too Large' });
    await done;
    await f.whenStable();
    const page = text(f.nativeElement);
    expect(page).toContain('belongs to a match between other teams');
    expect(page).toContain("stored 'Real Madrid', sent 'Real Sociedad'");
    expect(page).toContain('at most 1 MB');
  });

  it('Import another clears the reply and the results but keeps the provider (UX-015)', async () => {
    const f = await open();
    const c = f.componentInstance;
    c.provider.set('chatgpt');
    c.onPaste(SAMPLE_PREDICTION);
    const done = c.send();
    http.expectOne(r => r.url === '/api/v1/predictions/import').flush({ predictionId: 'pr1', matchId: 'm', duplicate: false, possibleDuplicateOf: null });
    await done;
    c.importAnother();
    expect(c.text()).toBe('');
    expect(c.results()).toEqual([]);
    expect(c.provider()).toBe('chatgpt');
  });

  it('Use example loads a sample reply (UX-082)', async () => {
    const f = await open();
    f.componentInstance.useExample();
    expect(f.componentInstance.parsed().items).toHaveLength(1);
    expect(text(f.nativeElement)).toContain('CANNOT_CALL_API');
  });
});
