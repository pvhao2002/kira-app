import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveService } from '../core/live.service';
import { AiModel, ApiLogRow, MatchRow, PredictionRow } from '../core/models';
import { ApiLogsPage } from './api-logs';
import { MatchesPage } from './matches';
import { ModelsPage } from './models';
import { PredictionsPage } from './predictions';

const page = <T>(data: T[]) => ({ data, meta: { page: 0, size: 25, totalElements: data.length, totalPages: 1 } });
const PAGED = ['/api/v1/matches', '/api/v1/predictions', '/api/v1/api-logs'];
const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ') ?? '';

/** Opens a list page through the real router; `answer` replies to each request by URL (lookups get []). */
async function open<T>(url: string, cmp: Type<T>) {
  const live = { refresh: new Subject<void>(), predictions: new Subject<unknown>() };
  TestBed.configureTestingModule({ providers: [
    provideRouter([{ path: url.slice(1).split('?')[0], component: cmp }]), provideHttpClient(), provideHttpClientTesting(),
    { provide: LiveService, useValue: live }] });
  const harness = await RouterTestingHarness.create();
  const pageCmp = await harness.navigateByUrl(url, cmp);
  const http = TestBed.inject(HttpTestingController);
  const seen: TestRequest[] = [];
  /** Answers every open request: `bodies` by URL, an Error to fail with 503, anything else []. */
  const answer = async (bodies: Record<string, unknown> = {}) => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      for (const r of http.match(() => true)) {
        seen.push(r);
        const body = bodies[r.request.url];
        if (body instanceof Error) r.flush({ status: 503, code: 'DOWN', message: body.message }, { status: 503, statusText: 'Down' });
        else r.flush(body ?? (PAGED.includes(r.request.url) ? page([]) : []));
      }
      await new Promise(res => setTimeout(res));
    }
    harness.fixture.detectChanges();
  };
  const requests = (path: string) => seen.filter(r => r.request.url === path);
  return { page: pageCmp, harness, http, answer, requests, live, el: () => harness.routeNativeElement!, router: TestBed.inject(Router) };
}

const match = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: 'm1', externalMatchId: 'e1', providerId: 'p1', providerName: 'Agent One', league: 'Premier League', homeTeam: 'Arsenal',
  awayTeam: 'Chelsea', startTime: '2026-11-19T10:00:00Z', status: 'LIVE', finalHomeScore: null, finalAwayScore: null,
  finalHomeCorners: null, finalAwayCorners: null, htHomeScore: null, htAwayScore: null, htHomeCorners: null, htAwayCorners: null,
  resultUpdatedAt: null, predictionCount: 1, modelCount: 1, createdAt: '', updatedAt: '', overdue: false, ...over,
});

describe('MatchesPage', () => {
  it('sends only From as an open range, and shows the From-after-To error without a request (UX-110)', async () => {
    const t = await open('/matches', MatchesPage);
    await t.answer();
    t.page.from.set('2026-12-01');
    t.page.apply();
    await t.answer();
    const last = t.requests('/api/v1/matches').at(-1)!.request.params;
    expect(last.get('from')).toBe(new Date(2026, 11, 1).toISOString());
    expect(last.has('to')).toBe(false);

    const before = t.requests('/api/v1/matches').length;
    t.page.from.set('2026-12-31');
    t.page.to.set('2026-12-01');
    t.page.apply();
    await t.answer();
    expect(t.requests('/api/v1/matches')).toHaveLength(before);
    expect(text(t.el())).toContain('From must be on or before To.');
  });

  it('filters overdue matches from the link and badges them (UX-113)', async () => {
    const t = await open('/matches?overdue=true', MatchesPage);
    await t.answer({ '/api/v1/matches': page([match({ overdue: true })]) });
    expect(t.requests('/api/v1/matches')[0].request.params.get('overdue')).toBe('true');
    expect(t.el().querySelector('[data-testid="overdue-chip"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(text(t.el().querySelector('tbody')!)).toContain('Overdue');
  });

  it('marks unapplied edits as pending (UX-079)', async () => {
    const t = await open('/matches', MatchesPage);
    await t.answer();
    t.page.league.set('EPL');
    expect(t.page.pending()).toBe(true);
    t.page.apply();
    expect(t.page.pending()).toBe(false);
  });

  describe('merge matches (UX-047)', () => {
    const signIn = (role: string) => sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 't',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 'u1', username: 'u', role, status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' } }));
    afterEach(() => sessionStorage.clear());
    const q = (el: Element, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

    it('an admin merges 2 or more selected rows, with a reason', async () => {
      signIn('ADMIN');
      const t = await open('/matches', MatchesPage);
      await t.answer({ '/api/v1/matches': page([match(), match({ id: 'm2', providerName: 'Agent Two' })]) });
      (q(t.el(), 'select-m1') as HTMLInputElement).click();
      t.harness.fixture.detectChanges();
      expect((q(t.el(), 'merge-open') as HTMLButtonElement).disabled).toBe(true);      // one row is not enough
      (q(t.el(), 'select-m2') as HTMLInputElement).click();
      t.harness.fixture.detectChanges();
      (q(t.el(), 'merge-open') as HTMLButtonElement).click();
      t.harness.fixture.detectChanges();
      const submit = q(t.el(), 'reason-submit') as HTMLButtonElement;
      expect(submit.disabled).toBe(true);                                             // the reason is required
      const reason = q(t.el(), 'reason') as HTMLTextAreaElement;
      reason.value = 'Same game';
      reason.dispatchEvent(new Event('input'));
      t.harness.fixture.detectChanges();
      submit.click();
      const req = t.http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/fixtures/merge');
      expect(req.request.body).toEqual({ matchIds: ['m1', 'm2'], reason: 'Same game' });
      req.flush({ id: 'fx1', members: [], resultMismatch: false });
      await t.answer();
      expect(q(t.el(), 'selection-bar')).toBeNull();
    });

    it('lists suggested merges in their own tab', async () => {
      signIn('ADMIN');
      const t = await open('/matches', MatchesPage);
      await t.answer();
      t.page.tab.set('suggestions');
      const side = (id: string, home: string) => ({ fixtureId: 'f' + id, matchId: id, providerName: 'P' + id, externalMatchId: 'x' + id,
        league: 'L', homeTeam: home, awayTeam: 'Leeds', startTime: '2026-11-19T10:00:00Z', status: 'SCHEDULED' });
      await t.answer({ '/api/v1/fixtures/suggestions': page([{ a: side('m1', 'Man Utd'), b: side('m2', 'Manchester United'), reason: 'SIMILAR_NAMES', score: 0.7 }]) });
      expect(text(q(t.el(), 'suggestions')!)).toContain('Manchester United');
      expect(q(t.el(), 'suggestion-merge')).not.toBeNull();
    });

    it('an admin links existing matches from the Suggested merges tab', async () => {
      signIn('ADMIN');
      const t = await open('/matches', MatchesPage);
      await t.answer();
      t.page.tab.set('suggestions');
      const sug = { '/api/v1/fixtures/suggestions': page([]) };
      await t.answer(sug);
      const before = t.requests('/api/v1/fixtures/suggestions').length;
      (q(t.el(), 'fixture-backfill') as HTMLButtonElement).click();
      t.harness.fixture.detectChanges();
      expect((q(t.el(), 'fixture-backfill') as HTMLButtonElement).disabled).toBe(true);   // busy: one call at a time
      const req = t.http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/fixtures/backfill');
      expect(req.request.body).toEqual({});
      req.flush({ linked: 3 });
      await t.answer(sug);
      expect(text(t.el())).toContain('Linked 3 matches');
      expect(t.requests('/api/v1/fixtures/suggestions').length).toBeGreaterThan(before); // suggestions reload
    });

    it('an admin adds and removes a league alias with a reason (UX-086)', async () => {
      signIn('ADMIN');
      const t = await open('/matches', MatchesPage);
      await t.answer();
      t.page.tab.set('leagues');
      const aliases = { '/api/v1/leagues/aliases': [{ id: 'a1', alias: 'EPL', canonical: 'Premier League', createdAt: '2026-11-20T10:00:00Z' }] };
      await t.answer(aliases);
      expect(text(q(t.el(), 'league-aliases')!)).toContain('EPL');

      (q(t.el(), 'alias-add') as HTMLButtonElement).click();
      t.harness.fixture.detectChanges();
      const submit = q(t.el(), 'reason-submit') as HTMLButtonElement;
      const type = (id: string, v: string) => {
        const el = q(t.el(), id) as HTMLInputElement | HTMLTextAreaElement;
        el.value = v; el.dispatchEvent(new Event('input'));
        t.harness.fixture.detectChanges();
      };
      type('reason', 'Same league');
      expect(submit.disabled).toBe(true);                                             // both names are required
      type('alias-name', ' English Premier League ');
      type('alias-canonical', 'Premier League');
      expect(submit.disabled).toBe(false);
      submit.click();
      const add = t.http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/leagues/aliases');
      expect(add.request.body).toEqual({ alias: 'English Premier League', canonical: 'Premier League', reason: 'Same league' });
      add.flush({ id: 'a2', alias: 'English Premier League', canonical: 'Premier League', createdAt: '2026-11-21T10:00:00Z' });
      await t.answer(aliases);
      expect(t.requests('/api/v1/matches/leagues').length).toBeGreaterThan(1);        // the league list reloads

      (q(t.el(), 'alias-remove-a1') as HTMLButtonElement).click();
      t.harness.fixture.detectChanges();
      type('reason', 'Different league');
      (q(t.el(), 'reason-submit') as HTMLButtonElement).click();
      const rm = t.http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/leagues/aliases/a1/remove');
      expect(rm.request.body).toEqual({ reason: 'Different league' });
      rm.flush(null);
      await t.answer();
    });

    it('shows a viewer no selection, merge or suggestions', async () => {
      signIn('VIEWER');
      const t = await open('/matches', MatchesPage);
      await t.answer({ '/api/v1/matches': page([match()]) });
      expect(q(t.el(), 'select-m1')).toBeNull();
      expect(t.el().querySelector('mm-tabs')).toBeNull();
      expect(t.requests('/api/v1/fixtures/suggestions')).toHaveLength(0);
    });
  });

  it('shows the API message with a Retry button instead of an empty pager (UX-037)', async () => {
    const t = await open('/matches', MatchesPage);
    await t.answer({ '/api/v1/matches': new Error('Database unavailable') });
    expect(text(t.el())).toContain('Database unavailable');
    expect(t.el().querySelector('mm-paginator')).toBeNull();
    (t.el().querySelector('[data-testid="retry"]') as HTMLButtonElement).click();
    await t.answer({ '/api/v1/matches': page([match()]) });
    expect(text(t.el().querySelector('tbody')!)).toContain('Arsenal');
  });
});

const prediction = (over: Partial<PredictionRow> = {}): PredictionRow => ({
  id: 'x1', predictedAt: '2026-11-19T08:00:00Z', predictionType: 'PRE_MATCH', matchMinute: null, currentHomeScore: null,
  currentAwayScore: null, eventId: 'ev', matchId: 'm1', league: 'EPL', homeTeam: 'Arsenal', awayTeam: 'Chelsea',
  startTime: '2026-11-19T10:00:00Z', matchStatus: 'FINISHED', finalHomeScore: 1, finalAwayScore: 0, modelId: 'md',
  modelName: 'GPT', modelVersion: '5', predictedHomeScore: 2, predictedAwayScore: 1, correctScoreProbability: null,
  topPickId: 'k1', topPickMarket: '1X2', topPick: 'HOME', topPickProbability: 0.6, topPickLine: null, topPickLineDisplay: null,
  topPickStage: 'PRE_MATCH', topPickPrice: 1.9, settlementStatus: 'WIN', pickCount: 3, pickWins: 2, pickHalfWins: 0,
  pickLosses: 1, pickHalfLosses: 0, pickPushOrVoid: 0, pickPending: 0, ...over,
} as PredictionRow);

describe('PredictionsPage', () => {
  it('names every column distinctly and hides the secondary ones by default (UX-070, UX-011, UX-075)', async () => {
    const t = await open('/predictions', PredictionsPage);
    await t.answer({ '/api/v1/predictions': page([prediction()]) });
    const heads = [...t.el().querySelectorAll('thead th')].map(th => text(th).trim());
    expect(heads).toContain('Predicted at');
    expect(heads).toContain('Predicted score');
    expect(heads).toContain('Top pick result');
    expect(heads).not.toContain('At capture');
    expect(heads).not.toContain('CS prob.');
    expect(new Set(heads).size).toBe(heads.length);
    expect(text(t.el().querySelector('tbody')!)).toContain('2 Win · 1 Loss');
  });

  it('quotes the top pick AH line one way, with the split as its tooltip (UX-008)', async () => {
    const t = await open('/predictions', PredictionsPage);
    await t.answer({ '/api/v1/predictions': page([prediction({ topPickMarket: 'AH', topPickLine: -0.25, topPickLineDisplay: '0/-0.5' })]) });
    const cell = t.el().querySelector('[data-testid="top-pick"]') as HTMLElement;
    expect(text(cell)).toContain('AH HOME -0.25');
    expect(text(cell)).not.toContain('0/-0.5');
    expect(cell.title).toBe('0/-0.5');
  });

  it('sends the result scope from the link (UX-075)', async () => {
    const t = await open('/predictions?result=WIN&resultScope=ANY', PredictionsPage);
    await t.answer();
    const p = t.requests('/api/v1/predictions')[0].request.params;
    expect([p.get('result'), p.get('resultScope')]).toEqual(['WIN', 'ANY']);
  });

  it('reloads page 1 on a live event, but only offers a refresh on later pages (UX-071)', async () => {
    const t = await open('/predictions?page=2', PredictionsPage);
    await t.answer();
    const before = t.requests('/api/v1/predictions').length;
    t.live.predictions.next({});
    t.live.refresh.next();
    await t.answer();
    expect(t.requests('/api/v1/predictions')).toHaveLength(before);
    const btn = t.el().querySelector('[data-testid="new-predictions"]') as HTMLButtonElement;
    expect(text(btn)).toContain('1 new');
    btn.click();
    await t.answer();
    expect(t.requests('/api/v1/predictions')).toHaveLength(before + 1);
    expect(t.el().querySelector('[data-testid="new-predictions"]')).toBeNull();
  });
});

const model = (i: number): AiModel => ({
  id: `m${i}`, providerId: 'p', providerName: i % 2 ? 'OpenAI' : 'Anthropic', name: i === 7 ? 'Gémini' : `Model ${String(i).padStart(2, '0')}`,
  version: '1', description: null, status: 'ACTIVE', totalPredictions: i, settledPicks: 0, wins: 0, losses: 0, pendingPicks: 0,
  winRate: null, lastPredictionAt: null, createdAt: '', updatedAt: '', units: null, staked: 0, roi: null,
});

describe('ModelsPage', () => {
  const models = Array.from({ length: 30 }, (_, i) => model(i + 1));

  it('pages the list and keeps the page in the URL (UX-016, UX-010)', async () => {
    const t = await open('/models', ModelsPage);
    await t.answer({ '/api/v1/models': models });
    expect(t.el().querySelectorAll('tbody tr.clickable')).toHaveLength(25);
    t.page.setPage({ page: 1 });
    await t.answer();
    expect(t.el().querySelectorAll('tbody tr.clickable')).toHaveLength(5);
    expect(t.router.url).toContain('page=2');
  });

  it('searches name, version and provider ignoring accents and case, from the link (UX-016)', async () => {
    const t = await open('/models?search=GEMINI', ModelsPage);
    await t.answer({ '/api/v1/models': models });
    const rows = t.el().querySelectorAll('tbody tr.clickable');
    expect(rows).toHaveLength(1);
    expect(text(rows[0])).toContain('Gémini');
  });

  it('Show archived refetches with includeArchived=true; a merged model shows "merged into X" (archive plan Task 5)', async () => {
    const t = await open('/models', ModelsPage);
    const few = models.slice(0, 3);
    await t.answer({ '/api/v1/models': few });
    expect(t.requests('/api/v1/models')[0].request.params.has('includeArchived')).toBe(false);
    (t.el().querySelector('[data-testid="show-archived"]') as HTMLInputElement).click();
    const merged: AiModel = { ...model(9), id: 'src', name: 'gpt-5.1-', mergedIntoId: 'm2' };
    await t.answer({ '/api/v1/models': [...few, merged] });
    expect(t.requests('/api/v1/models').at(-1)!.request.params.get('includeArchived')).toBe('true');
    const row = [...t.el().querySelectorAll('tbody tr.clickable')].find(r => text(r).includes('gpt-5.1-'))!;
    expect(text(row)).toContain('merged into Model 02');
  });

  it('offers Retry when the list fails (UX-037)', async () => {
    const t = await open('/models', ModelsPage);
    await t.answer({ '/api/v1/models': new Error('Database unavailable') });
    (t.el().querySelector('[data-testid="retry"]') as HTMLButtonElement).click();
    await t.answer({ '/api/v1/models': models });
    expect(t.el().querySelectorAll('tbody tr.clickable')).toHaveLength(25);
  });
});

/** UX-040: the row's link is its one tab stop (a routerLink row is focusable unless told not to), and the table has a name. */
function expectOneTabStopPerRow(el: HTMLElement) {
  expect(el.querySelector('table')!.getAttribute('aria-label')).toBeTruthy();
  const rows = [...el.querySelectorAll('tbody tr.clickable')];
  expect(rows.length).toBeGreaterThan(0);
  for (const tr of rows) {
    expect(tr.getAttribute('tabindex')).toBe('-1');
    expect(tr.querySelector('a[href]')).not.toBeNull();
  }
}

describe('list rows (UX-040)', () => {
  it('matches', async () => {
    const t = await open('/matches', MatchesPage);
    await t.answer({ '/api/v1/matches': page([match()]) });
    expectOneTabStopPerRow(t.el());
  });

  it('predictions', async () => {
    const t = await open('/predictions', PredictionsPage);
    await t.answer({ '/api/v1/predictions': page([prediction()]) });
    expectOneTabStopPerRow(t.el());
  });

  it('models', async () => {
    const t = await open('/models', ModelsPage);
    await t.answer({ '/api/v1/models': [model(1)] });
    expectOneTabStopPerRow(t.el());
  });
});

describe('ApiLogsPage', () => {
  const log: ApiLogRow = {
    id: 'l1', receivedAt: '2026-11-19T08:00:00Z', providerId: '0fb8f294-uuid', providerName: 'Agent One', endpoint: '/api/v1/predictions/import',
    httpMethod: 'POST', requestId: 'r1', eventId: null, httpStatus: 201, requestStatus: 'SUCCESS', durationMs: 12, errorMessage: null,
    clientIp: null, actor: 'admin',
  };

  it('shows the provider name and the acting admin, in the row and the detail (UX-052)', async () => {
    const t = await open('/api-logs', ApiLogsPage);
    await t.answer({ '/api/v1/api-logs': page([log]) });
    expect(text(t.el().querySelector('tbody')!)).toContain('admin');
    (t.el().querySelector('tbody tr') as HTMLElement).click();
    await t.answer({ '/api/v1/api-logs/l1': { ...log, apiKeyId: null, processingResult: null } });
    const dl = text(t.el().querySelector('dl')!);
    expect(dl).toContain('Agent One');
    expect(dl).toContain('admin');
    expect(dl).not.toContain('0fb8f294');
  });

  it('opens a call from one keyboard stop per row, the row itself, and names the table (UX-040)', async () => {
    const t = await open('/api-logs', ApiLogsPage);
    await t.answer({ '/api/v1/api-logs': page([log]) });
    expect(t.el().querySelector('table')!.getAttribute('aria-label')).toBeTruthy();
    const tr = t.el().querySelector('tbody tr') as HTMLElement;
    expect(tr.getAttribute('tabindex')).toBe('0');
    expect(tr.querySelectorAll('a[href], button, [tabindex]')).toHaveLength(0);
  });

  it('shows the From-after-To error and sends nothing (UX-110)', async () => {
    const t = await open('/api-logs', ApiLogsPage);
    await t.answer();
    const before = t.requests('/api/v1/api-logs').length;
    t.page.from.set('2026-12-31');
    t.page.to.set('2026-12-01');
    t.page.apply();
    await t.answer();
    expect(t.requests('/api/v1/api-logs')).toHaveLength(before);
    expect(text(t.el())).toContain('From must be on or before To.');
  });
});
