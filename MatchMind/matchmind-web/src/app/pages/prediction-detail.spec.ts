import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PredictionDetail, ReviewItem } from '../core/models';
import { PageTitle } from '../core/page-title';
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
    expect(TestBed.inject(PageTitle).value()).toBe('Home FC – Away FC');
  });

  it('keeps a BiDi override in agent names inside that name (UX-030)', async () => {
    const f = await open({ ...base, match: { ...base.match, awayTeam: '‮Away' }, model: { ...base.model, name: '‮GPT' } } as PredictionDetail);
    expect(TestBed.inject(PageTitle).value()).toBe('Home FC – ⁨‮Away⁩');
    expect(f.nativeElement.querySelector('h2')!.textContent).toContain('⁨‮Away⁩');
    expect(f.nativeElement.querySelector('.sub')!.textContent).toContain('⁨‮GPT⁩');
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
    f.detectChanges();
    const dlg = f.nativeElement.querySelector('mm-dialog dialog') as HTMLElement;
    expect(dlg.getAttribute('aria-busy')).toBe('true');
    http.expectOne(r => r.url === '/api/v1/settlements/picks/k1/override')
      .flush({ status: 409, code: 'MATCH_NOT_FINAL', message: 'The match is LIVE. Enter its final result first' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(c.actionError()).toContain('Enter its final result first');
    expect(dlg.hasAttribute('aria-busy')).toBe(false);   // unlocked again to fix and resend
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

  it('ties the selected tab to its panel and names every table (UX-040)', async () => {
    const f = await open();
    const el = f.nativeElement as HTMLElement;
    const panel = el.querySelector('[role="tabpanel"]') as HTMLElement;
    expect(panel.id).toBeTruthy();
    for (const tab of ['picks', 'odds', 'scores', 'stats', 'sim']) {
      f.componentInstance.tab.set(tab);
      f.detectChanges();
      expect(el.querySelector('[role="tab"][aria-selected="true"]')!.getAttribute('aria-controls')).toBe(panel.id);
      for (const t of el.querySelectorAll('table')) expect(t.getAttribute('aria-label'), tab).toBeTruthy();
    }
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

describe('PredictionDetailPage counting (UX-046)', () => {
  it('flags a superseded prediction and lists its similar predictions', async () => {
    const f = await open({ ...base, counted: false, similar: [
      { predictionId: 'p2', predictedAt: '2026-11-01T20:05:00Z', exact: true, counted: true },
    ] } as PredictionDetail);
    const banner = q(f, 'not-counted');
    expect(text(banner)).toContain('Not counted in reports');
    expect(banner!.querySelector('a[href="/predictions/p2"]')).not.toBeNull();
    const similar = text(q(f, 'similar'));
    expect(similar).toContain('same content');
    expect(similar).toContain('counted');
  });

  it('shows neither for a counted prediction without twins', async () => {
    const f = await open({ ...base, counted: true, similar: [] } as PredictionDetail);
    expect(q(f, 'not-counted')).toBeNull();
    expect(q(f, 'similar')).toBeNull();
  });
});

describe('PredictionDetailPage UI review fixes', () => {
  it('explains the disabled admin actions in visible text, tied to the buttons (PDET-4)', async () => {
    const f = await open({ ...base, match: { ...base.match, status: 'SCHEDULED' } });
    const note = q(f, 'actions-note')!;
    expect(text(note)).toContain('Finished or Cancelled');
    expect(q(f, 'override')!.getAttribute('aria-describedby')).toBe(note.id);
    const done = await open();
    expect(q(done, 'actions-note')).toBeNull();
  });

  it('keeps the hint inside the reason field and the Override result is a custom select (PDET-6, CUSTOM-1)', async () => {
    const f = await open();
    q(f, 'override')!.click();
    f.detectChanges();
    const dialog = f.nativeElement.querySelector('mm-dialog') as HTMLElement;
    expect(dialog.querySelector('#ov-reason + small#ov-hint')).not.toBeNull();
    expect(dialog.querySelector('select')).toBeNull();
    const trigger = dialog.querySelector('mm-select button#ov-result') as HTMLButtonElement;
    expect(trigger.hasAttribute('autofocus')).toBe(true);
    expect(text(trigger)).toContain('Choose a result');
  });

  it('formats the iteration count and wraps the odds table for phones (PDET-11, PDET-2)', async () => {
    const f = await open({ ...base, simulation: { method: 'MC', simulationCount: 100000, randomSeed: null, algorithmVersion: null, parameters: {},
      expectedRemainingHomeGoals: null, expectedRemainingAwayGoals: null, expectedRemainingHomeCorners: null, expectedRemainingAwayCorners: null,
      probabilities: null, correctScoreDistribution: [] } } as unknown as PredictionDetail);
    f.componentInstance.tab.set('sim');
    f.detectChanges();
    expect(text(f.nativeElement)).toContain('100,000');
    f.componentInstance.tab.set('odds');
    f.detectChanges();
    expect(f.nativeElement.querySelector('table[aria-label="Odds"]')!.classList.contains('compact-sm')).toBe(true);
  });

  it('retries a failed load and warns when the review check fails (PDET-5, PDET-12)', async () => {
    const f = TestBed.createComponent(PredictionDetailPage);
    f.componentRef.setInput('id', 'p1');
    f.detectChanges();
    TestBed.tick();
    http.expectOne('/api/v1/predictions/p1').flush({ status: 503, code: 'DOWN', message: 'Database unavailable' }, { status: 503, statusText: 'Down' });
    http.expectOne(r => r.url === '/api/v1/settlements/needs-review').flush({ status: 500, code: 'X', message: 'nope' }, { status: 500, statusText: 'Err' });
    await f.whenStable();
    f.detectChanges();
    expect(text(f.nativeElement)).toContain('Database unavailable');
    (q(f, 'state-retry') as HTMLButtonElement).click();
    TestBed.tick();
    http.expectOne('/api/v1/predictions/p1').flush(base);
    await f.whenStable();
    f.detectChanges();
    expect(text(q(f, 'review-failed'))).toContain('review');
  });
});
