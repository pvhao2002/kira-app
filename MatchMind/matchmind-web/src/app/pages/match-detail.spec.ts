import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchDetail, ReviewItem } from '../core/models';
import { MatchDetailPage } from './match-detail';

const admin = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const signIn = (role = 'ADMIN') => sessionStorage.setItem('matchmind.session',
  JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { ...admin, role } }));

const match = {
  id: 'm1', externalMatchId: 'x1', providerId: 'p1', providerName: 'Prov', league: 'League', homeTeam: 'Home FC',
  awayTeam: 'Away FC', startTime: '2026-11-01T19:00:00Z', status: 'FINISHED', finalHomeScore: 1, finalAwayScore: 1,
  finalHomeCorners: null, finalAwayCorners: null, htHomeScore: 0, htAwayScore: 0, htHomeCorners: null, htAwayCorners: null,
  resultUpdatedAt: null, predictionCount: 2, modelCount: 1, createdAt: '', updatedAt: '', overdue: false,
} as const;
const detail = {
  match,
  models: [{
    modelId: 'md1', modelName: 'GPT', modelVersion: 'v1', predictions: 2, picks: 2, wins: 1, losses: 0, pushOrVoid: 0,
    pending: 0, winRate: 1, lastPredictedAt: '',
    latest: {
      predictionId: 'pr2', modelId: 'md1', predictedAt: '2026-11-01T19:30:00Z', predictionType: 'LIVE', matchMinute: 20,
      predictedHomeScore: 2, predictedAwayScore: 1, correctScoreProbability: 0.1, topPickMarket: 'OU', topPick: 'OVER',
      topPickProbability: 0.6, topPickLine: 2.5, topPickPrice: 1.9, topPickResult: 'WIN',
    },
  }],
  latestStats: null,
  resultHistory: [{
    id: 'h1', changeSource: 'ADMIN', changedAt: '2026-11-01T21:00:00Z',
    previousResult: { status: 'LIVE', finalHomeScore: null, finalAwayScore: null },
    newResult: { status: 'FINISHED', finalHomeScore: 1, finalAwayScore: 1, changedBy: 'admin', reason: 'typo fix', resultAt: '2026-11-01T21:00:00Z' },
  }, {
    id: 'h0', changeSource: 'PROVIDER', changedAt: '2026-10-30T10:00:00Z',
    previousResult: { startTime: '2026-10-31T19:00:00Z', status: 'POSTPONED' },
    newResult: { startTime: '2026-11-01T19:00:00Z', status: 'SCHEDULED' },
  }],
} as unknown as MatchDetail;
const review: ReviewItem[] = [{
  pickId: 'k1', predictionId: 'pr2', matchId: 'm1', homeTeam: 'Home FC', awayTeam: 'Away FC', matchStatus: 'FINISHED',
  market: 'OU', pick: 'OVER', currentResult: 'WIN', newResult: 'LOSS', reason: null, settledAt: '2026-11-01T21:00:00Z',
}];
const preds = [
  { id: 'pr2', predictedAt: '2026-11-01T19:30:00Z', predictionType: 'LIVE', matchMinute: 20, currentHomeScore: 0, currentAwayScore: 0,
    modelId: 'md1', modelName: 'GPT', modelVersion: 'v1', topPickMarket: 'OU', topPick: 'OVER', topPickLine: 2.5, topPickLineDisplay: null,
    topPickProbability: 0.6, settlementStatus: 'WIN' },
  { id: 'pr1', predictedAt: '2026-11-01T18:00:00Z', predictionType: 'PRE_MATCH', matchMinute: null, currentHomeScore: null, currentAwayScore: null,
    modelId: 'md1', modelName: 'GPT', modelVersion: 'v1', topPickMarket: 'AH', topPick: 'HOME', topPickLine: -0.25, topPickLineDisplay: '0/-0.5',
    topPickProbability: 0.55, settlementStatus: 'HALF_LOSS' },
];

let http: HttpTestingController;
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ') ?? '';
const q = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

beforeEach(() => {
  signIn();
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => sessionStorage.clear());

async function flushLoads(f: { whenStable(): Promise<unknown>; detectChanges(): void }, items: ReviewItem[] = review, d = detail) {
  TestBed.tick();
  http.expectOne('/api/v1/matches/m1').flush(d);
  http.expectOne(r => r.url === '/api/v1/settlements/needs-review' && r.params.get('matchId') === 'm1').flush(items);
  http.expectOne(r => r.url === '/api/v1/predictions' && r.params.get('matchId') === 'm1')
    .flush({ data: preds, meta: { page: 0, size: 100, totalElements: 2, totalPages: 1 } });
  await f.whenStable();
  f.detectChanges();
}

async function open(items: ReviewItem[] = review, d = detail) {
  const f = TestBed.createComponent(MatchDetailPage);
  f.componentRef.setInput('id', 'm1');
  f.detectChanges();
  await flushLoads(f, items, d);
  return f;
}

describe('MatchDetailPage', () => {
  it('titles the page with the teams (UX-005)', async () => {
    await open();
    expect(document.title).toBe('Home FC – Away FC · MatchMind');
  });

  it('an admin enters a result and sees the settlement outcome (UX-001)', async () => {
    const f = await open([]);
    const c = f.componentInstance;
    q(f, 'result-open')!.click();
    f.detectChanges();
    expect(c.resultForm.status).toBe('FINISHED');          // prefilled from the stored result
    c.resultForm.finalHome = 2;
    c.resultForm.reason = 'Agent sent no result';
    c.submitResult();
    const req = http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/matches/m1/result');
    expect(req.request.body).toEqual({ status: 'FINISHED', finalScore: { home: 2, away: 1 }, halfTimeScore: { home: 0, away: 0 },
      reason: 'Agent sent no result' });
    req.flush({ matchId: 'm1', status: 'FINISHED', changed: true,
      settlement: { matchId: 'm1', matchStatus: 'FINISHED', settled: 1, alreadySettled: 2, pending: 0, needsReview: 2, picks: [] } });
    await flushLoads(f, review);
    expect(text(q(f, 'result-outcome'))).toContain('1 settled, 2 already settled, 0 pending, 2 need review');
  });

  it('locks the result dialog while it saves (UX-109)', async () => {
    const f = await open([]);
    q(f, 'result-open')!.click();
    f.detectChanges();
    f.componentInstance.submitResult();
    f.detectChanges();
    const dlg = f.nativeElement.querySelector('mm-dialog dialog') as HTMLElement;
    expect(dlg.getAttribute('aria-busy')).toBe('true');
    expect((dlg.querySelector('fieldset.dialog-body') as HTMLFieldSetElement).disabled).toBe(true);
    http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/matches/m1/result');
  });

  it('asks for the final score of a FINISHED match and sends nothing without it (UX-001)', async () => {
    const f = await open([]);
    const c = f.componentInstance;
    c.openResult();
    c.resultForm.finalHome = null;
    c.resultForm.finalAway = null;
    c.submitResult();
    http.expectNone(r => r.method === 'POST');
    expect(c.resultError()).toContain('final score');
  });

  it('flags picks that need review instead of showing the stale result, and recalculates them all (UX-051)', async () => {
    const f = await open();
    const c = f.componentInstance;
    expect(text(q(f, 'review-badge'))).toContain('1 pick needs review');
    expect(text(q(f, 'model-result'))).toContain('Needs review');
    expect(text(q(f, 'model-result'))).toContain('Win → Loss');
    q(f, 'review-recalc')!.click();
    f.detectChanges();
    c.recalcReason = 'Score corrected';
    c.recalculateAll();
    c.recalculateAll();   // a double click sends once (UX-109)
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('mm-dialog dialog')[1].getAttribute('aria-busy')).toBe('true');
    const req = http.expectOne(r => r.method === 'POST' && r.url === '/api/v1/settlements/matches/m1/recalculate');
    expect(req.request.body).toEqual({ reason: 'Score corrected' });
    req.flush([{ pickId: 'k1', market: 'OU', pick: 'OVER', result: 'LOSS', status: 'SUPERSEDED', reason: 'Score corrected', aiResult: null, aiAgrees: null }]);
    await flushLoads(f, []);
    expect(q(f, 'review-badge')).toBeNull();
  });

  it('shows result history as changed fields with who and why, and kick-off moves (UX-003, UX-105)', async () => {
    const f = await open([]);
    const hist = text(q(f, 'result-history'));
    const rows = [...q(f, 'result-history')!.querySelectorAll('tbody tr')]
      .map(tr => [...(tr as HTMLTableRowElement).cells].map(c => c.textContent!.trim()).join(' | '));
    expect(rows).toContain('Status | Live | Finished');
    expect(rows).toContain('Final score | — | 1–1');
    expect(rows).toContain('Status | Postponed | Scheduled');
    expect(hist).toContain('by admin');
    expect(hist).toContain('typo fix');
    expect(hist).toContain('Kick-off');
    expect(hist).not.toContain('Changed by');
    expect(hist).toContain('View JSON');
  });

  it('lists every prediction of the match with links (UX-050)', async () => {
    const f = await open([]);
    const links = [...q(f, 'prediction-history')!.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(links).toContain('/predictions/pr1');
    expect(links).toContain('/predictions/pr2');
    expect(text(q(f, 'prediction-history'))).toContain('AH HOME -0.25');
  });

  it('copies the settlement prompt input (UX-119)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const f = await open([]);
    q(f, 'prompt-input-copy')!.click();
    http.expectOne('/api/v1/settlements/matches/m1/prompt-input').flush({ matchId: 'm1', picks: [{ pickId: 'k1' }] });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"pickId": "k1"'));
  });

  it('shows no admin actions to a viewer, but still the review badge', async () => {
    sessionStorage.clear();
    signIn('VIEWER');
    const f = await open();
    expect(q(f, 'result-open')).toBeNull();
    expect(q(f, 'review-recalc')).toBeNull();
    expect(q(f, 'review-badge')).not.toBeNull();
  });
});
