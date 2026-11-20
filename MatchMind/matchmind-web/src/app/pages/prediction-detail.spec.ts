import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PredictionDetail, ReviewItem } from '../core/models';
import { PredictionDetailPage } from './prediction-detail';

const admin = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };

const base = {
  id: 'p1', eventId: 'e1', predictionType: 'LIVE', matchMinute: 55, currentHomeScore: 1, currentAwayScore: 0,
  currentHomeCorners: 3, currentAwayCorners: 2, predictedAt: '2026-11-01T20:00:00Z', createdAt: '',
  match: { id: 'm1', externalMatchId: 'x1', providerId: 'p', providerName: 'Prov', league: 'League', homeTeam: 'Home FC',
    awayTeam: 'Away FC', startTime: '2026-11-01T19:00:00Z', status: 'FINISHED', finalHomeScore: 2, finalAwayScore: 1,
    finalHomeCorners: null, finalAwayCorners: null, htHomeScore: 1, htAwayScore: 0 },
  model: { id: 'md1', name: 'GPT', version: 'v1' },
  odds: [{ id: 'o1', ref: 'a', market: 'AH', stage: 'LIVE', snapshotOrder: 2, line: -0.25, lineDisplay: '0/-0.5', homeOdds: 1.9,
    drawOdds: null, awayOdds: 1.95, overOdds: null, underOdds: null, settlementBasis: 'REMAINING_MATCH', homeScoreAtCapture: 1,
    awayScoreAtCapture: 0, homeCornersAtCapture: null, awayCornersAtCapture: null, capturedAt: '2026-11-01T20:00:00Z', extra: null }],
  stats: { possessionHome: 50, possessionAway: 50, shotsHome: null, shotsAway: null, shotsOnTargetHome: null, shotsOnTargetAway: null,
    shotsOffTargetHome: null, shotsOffTargetAway: null, cornersHome: null, cornersAway: null, yellowCardsHome: null,
    yellowCardsAway: null, redCardsHome: null, redCardsAway: null, extra: { dangerousAttacks: { home: 41, away: 22 } } },
  simulation: { method: 'MC', simulationCount: 1000, randomSeed: null, expectedRemainingHomeGoals: null, expectedRemainingAwayGoals: null,
    expectedRemainingHomeCorners: null, expectedRemainingAwayCorners: null, algorithmVersion: null, parameters: null,
    probabilities: { '1X2': { HOME: 0.5, DRAW: 0.3, AWAY: 0.2 } }, correctScoreDistribution: null },
  picks: [{
    id: 'k1', rank: 1, market: 'AH', pick: 'HOME', probability: 0.55, oddsId: 'o1', oddsRef: 'a', price: 1.9, line: -0.25, stage: 'LIVE',
    settlementStatus: 'HALF_LOSS',
    results: [
      { id: 'r2', result: 'HALF_LOSS', settledAt: '2026-11-02T10:00:00Z', source: 'ADMIN_RECALCULATION', calculationVersion: 'settle-v1',
        current: true, supersededAt: null, reason: 'double check',
        details: { market: 'AH', pick: 'HOME', line: -0.25, settlementBasis: 'REMAINING_MATCH', matchStatus: 'FINISHED',
          finalScore: '2-1', atCapture: '1-0', basisScore: '1-1', actedBy: 'admin',
          legs: [{ line: 0, margin: 0, result: 'PUSH' }, { line: -0.5, margin: -0.5, result: 'LOSS' }] } },
      { id: 'r1', result: 'HALF_LOSS', settledAt: '2026-11-01T22:00:00Z', source: 'AUTO', calculationVersion: 'settle-v1',
        current: false, supersededAt: '2026-11-02T10:00:00Z', reason: null, details: { market: 'AH', pick: 'HOME', line: -0.25, matchStatus: 'FINISHED' } },
    ],
  }],
  correctScores: [], metadata: null, payload: null,
} as unknown as PredictionDetail;
const review: ReviewItem[] = [{
  pickId: 'k1', predictionId: 'p1', matchId: 'm1', homeTeam: 'Home FC', awayTeam: 'Away FC', matchStatus: 'FINISHED',
  market: 'AH', pick: 'HOME', currentResult: 'HALF_LOSS', newResult: 'LOSS', reason: null, settledAt: '',
}];

let http: HttpTestingController;
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ') ?? '';
const rows = (f: { nativeElement: HTMLElement }) => [...f.nativeElement.querySelectorAll('tbody tr')]
  .map(tr => [...(tr as HTMLTableRowElement).cells].map(c => c.textContent!.trim()).join(' | '));
const q = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

beforeEach(() => {
  sessionStorage.setItem('matchmind.session',
    JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: admin }));
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => sessionStorage.clear());

async function flushLoads(f: { whenStable(): Promise<unknown>; detectChanges(): void }, d: PredictionDetail, items: ReviewItem[]) {
  TestBed.tick();
  http.expectOne('/api/v1/predictions/p1').flush(d);
  http.expectOne(r => r.url === '/api/v1/settlements/needs-review' && r.params.get('predictionId') === 'p1').flush(items);
  await f.whenStable();
  f.detectChanges();
}

async function open(d: PredictionDetail = base, items: ReviewItem[] = []) {
  const f = TestBed.createComponent(PredictionDetailPage);
  f.componentRef.setInput('id', 'p1');
  f.detectChanges();
  await flushLoads(f, d, items);
  return f;
}

describe('PredictionDetailPage', () => {
  it('titles the page with the teams (UX-005)', async () => {
    await open();
    expect(document.title).toBe('Home FC – Away FC · MatchMind');
  });

  it('offers Override only on a final match and says why (UX-065)', async () => {
    const f = await open({ ...base, match: { ...base.match, status: 'SCHEDULED' } });
    const btn = q(f, 'override')! as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('final result');
  });

  it('shows the API message of a 409 MATCH_NOT_FINAL and sends a double click once (UX-065, UX-109)', async () => {
    const f = await open();
    const c = f.componentInstance;
    q(f, 'override')!.click();
    f.detectChanges();
    c.overrideResult = 'WIN';
    c.reason = 'manual check';
    c.submitAction();
    c.submitAction();
    http.expectOne(r => r.url === '/api/v1/settlements/picks/k1/override')
      .flush({ status: 409, code: 'MATCH_NOT_FINAL', message: 'The match is LIVE. Enter its final result first' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(c.actionError()).toContain('Enter its final result first');
  });

  it('focuses the first field, requires a 5-character reason and previews the impact (UX-032)', async () => {
    const f = await open(base, review);
    const c = f.componentInstance;
    q(f, 'recalculate')!.click();
    f.detectChanges();
    const dialog = f.nativeElement.querySelector('mm-dialog') as HTMLElement;
    expect(dialog.querySelector('textarea')!.hasAttribute('autofocus')).toBe(true);
    expect(text(dialog)).toContain('will become Loss');
    c.reason = 'abc';
    f.detectChanges();
    const submit = dialog.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(text(dialog)).toContain('at least 5 characters');
    c.submitAction();
    http.expectNone(r => r.method === 'POST');
  });

  it('flags a pick that needs review (UX-051)', async () => {
    const f = await open(base, review);
    expect(text(q(f, 'review-badge'))).toContain('1 pick needs review');
    expect(text(q(f, 'pick-review')!.parentElement)).toContain('Half loss → Loss');
  });

  it('explains each settlement in a sentence with who acted, and marks unchanged recalculations (UX-004, UX-034)', async () => {
    const f = await open();
    f.componentInstance.expanded.toggle('k1');
    f.detectChanges();
    const hist = text(f.nativeElement.querySelector('#pick-hist-k1'));
    expect(hist).toContain('AH HOME -0.25 on the remaining match from 1–0: final 2–1, so 1–1 counts.');
    expect(hist).toContain('by admin');
    expect(hist).toContain('Unchanged');
    expect(hist).toContain('double check');
    expect(hist).toContain('View JSON');
  });

  it('notes a remaining-match pick and quotes the AH line one way (UX-095, UX-008)', async () => {
    const f = await open();
    const row = text(q(f, 'pick-row'));
    expect(row).toContain("Goals after 55' from 1–0");
    expect(row).toContain('-0.25');
    f.componentInstance.tab.set('odds');
    f.detectChanges();
    const th = [...f.nativeElement.querySelectorAll('thead th')].map(t => t.textContent!.trim());
    expect(th).toContain('#');
    const cells = [...f.nativeElement.querySelectorAll('tbody tr:not(:first-child) td')].map(t => t.textContent!.trim());
    expect(cells).toContain('Live');             // UX-024: no snapshot number glued to the stage
    expect(cells).toContain('2');
    expect(cells).toContain('-0.25');
  });

  it('shows extra stats and Monte Carlo probabilities as tables (UX-025)', async () => {
    const f = await open();
    f.componentInstance.tab.set('stats');
    f.detectChanges();
    expect(rows(f)).toContain('Dangerous attacks | 41 | 22');
    f.componentInstance.tab.set('sim');
    f.detectChanges();
    expect(rows(f)).toContain('Home | 50.0%');
  });
});
