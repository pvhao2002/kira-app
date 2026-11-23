import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageTitle } from '../core/page-title';
import { ModelDetailPage } from './model-detail';

const admin = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const model = {
  id: 'md1', providerId: 'p1', providerName: 'Prov', name: 'GPT', version: 'v1', description: null, status: 'ACTIVE',
  totalPredictions: 301, settledPicks: 1, wins: 1, losses: 0, pendingPicks: 3, winRate: 1, lastPredictionAt: null, createdAt: '', updatedAt: '',
  units: 0.9, staked: 1, roi: 0.9,
};
const recent = [{ id: 'pr1', predictedAt: '2026-11-01T18:00:00Z', predictionType: 'PRE_MATCH', homeTeam: 'Home FC', awayTeam: 'Away FC',
  league: 'L', topPickMarket: 'AH', topPick: 'HOME', topPickLine: -0.25, topPickLineDisplay: '0/-0.5', topPickProbability: 0.5,
  predictedHomeScore: null, predictedAwayScore: null, finalHomeScore: null, finalAwayScore: null, settlementStatus: 'PENDING' }];
const day = (d: string, winRate: number | null, settled: number) => ({ day: d, wins: 0, losses: 0, settled, winRate });

let http: HttpTestingController;
const q = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

beforeEach(() => {
  sessionStorage.setItem('matchmind.session',
    JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: admin }));
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => sessionStorage.clear());

async function open(trend = [day('2026-11-01', 1, 1)], m: Record<string, unknown> = model, siblings: unknown[] = []) {
  const f = TestBed.createComponent(ModelDetailPage);
  f.componentRef.setInput('id', 'md1');
  f.detectChanges();
  TestBed.tick();
  http.expectOne('/api/v1/models/md1').flush(m);
  http.match(r => r.url === '/api/v1/reports/breakdown').forEach(r => r.flush([{ key: 'CORNER_OU', picks: 1, wins: 1, losses: 0, pushOrVoid: 0, pending: 0, winRate: 1 }]));
  http.expectOne(r => r.url === '/api/v1/predictions').flush({ data: recent, meta: { page: 0, size: 15, totalElements: 301, totalPages: 21 } });
  const dash = http.expectOne(r => r.url === '/api/v1/dashboard');
  expect(dash.request.params.get('modelId')).toBe('md1');
  dash.flush({ winRateOverTime: trend });
  // Admin: same-provider models for Merge into… (archived and merged included), asked once the model is known.
  await new Promise(res => setTimeout(res));
  TestBed.tick();
  http.expectOne(r => r.url === '/api/v1/models').flush(siblings);
  await f.whenStable();
  f.detectChanges();
  return f;
}

describe('ModelDetailPage', () => {
  it('titles the page with the model name (UX-005)', async () => {
    await open();
    expect(document.title).toBe('GPT v1 · MatchMind');
    expect(TestBed.inject(PageTitle).value()).toBe('GPT v1');
  });

  it('keeps a BiDi override in the model name inside that name (UX-030)', async () => {
    const f = await open(undefined, { ...model, name: '‮GPT' });
    expect(TestBed.inject(PageTitle).value()).toBe('⁨‮GPT⁩ v1');
    expect(f.nativeElement.querySelector('h2')!.textContent).toContain('⁨‮GPT⁩');
  });

  it('links to all predictions of the model and warns on a small sample (UX-081)', async () => {
    const f = await open();
    expect(q(f, 'view-all')!.getAttribute('href')).toBe('/predictions?modelId=md1');
    expect(q(f, 'view-all')!.textContent).toContain('301');
    expect(f.nativeElement.querySelectorAll('[data-testid="view-all"]')).toHaveLength(1);   // MDL-9
    expect(q(f, 'small-sample')!.textContent).toContain('n = 1');
    expect(q(f, 'trend-empty')).not.toBeNull();   // one settled day is no trend
  });

  it('has no small-sample warning from 30 wins + losses and 30 staked, and charts the win rate over time (UX-081, UX-018)', async () => {
    const f = await open([day('2026-11-01', 0.5, 10), day('2026-11-02', null, 0), day('2026-11-03', 0.75, 20)],
      { ...model, settledPicks: 32, wins: 20, losses: 10, staked: 30 });
    expect(q(f, 'small-sample')).toBeNull();
    const c = f.componentInstance;
    expect(c.trend()!.labels).toEqual(['1 Nov', '3 Nov']);   // MDL-8: short day labels
    expect(c.trend()!.datasets[0].data).toEqual([50, 75]);
  });

  it('labels markets as codes and quotes AH lines one way (UX-007, UX-008)', async () => {
    const f = await open();
    expect(f.nativeElement.textContent).toContain('Corner OU');
    const pick = q(f, 'recent-pick')!;
    expect(pick.textContent!.trim()).toBe('AH HOME -0.25');
    expect(pick.title).toBe('0/-0.5');
  });

  it('a merged model shows "merged into X"; Merge into… sends the target and the reason (archive plan Task 5)', async () => {
    const target = { ...model, id: 'md2', name: 'gpt-5.1', displayName: 'GPT 5.1', version: '1' };
    const merged = await open(undefined, { ...model, mergedIntoId: 'md2' }, [target]);
    expect(q(merged, 'merged-into')!.textContent).toContain('Merged into GPT 5.1 1');
    expect(q(merged, 'merge')).toBeNull();
    merged.destroy();

    const f = await open(undefined, model, [target]);
    q(f, 'merge')!.click();
    f.detectChanges();
    f.componentInstance.target.set('md2');
    f.componentInstance.action()!.run('duplicate spelling').subscribe();
    const req = http.expectOne('/api/v1/models/md1/merge');
    expect(req.request.body).toEqual({ targetModelId: 'md2', reason: 'duplicate spelling' });
    req.flush({ ...model, mergedIntoId: 'md2' });
  });
});

describe('ModelDetailPage loading and merge states', () => {
  async function openPending() {
    const f = TestBed.createComponent(ModelDetailPage);
    f.componentRef.setInput('id', 'md1');
    f.detectChanges();
    TestBed.tick();
    http.expectOne('/api/v1/models/md1').flush(model);
    http.match(r => r.url === '/api/v1/reports/breakdown').forEach(r => r.flush([]));
    http.expectOne(r => r.url === '/api/v1/predictions').flush({ data: recent, meta: { page: 0, size: 15, totalElements: 301, totalPages: 21 } });
    await new Promise(res => setTimeout(res));
    TestBed.tick();
    f.detectChanges();
    return f;
  }

  it('shows a skeleton, not the empty text, while the trend loads; an error offers Retry (MDL-1)', async () => {
    const f = await openPending();
    expect(q(f, 'trend-loading')).not.toBeNull();
    expect(q(f, 'trend-empty')).toBeNull();
    http.expectOne(r => r.url === '/api/v1/dashboard').flush({ status: 503, code: 'DOWN', message: 'down' }, { status: 503, statusText: 'Down' });
    http.expectOne(r => r.url === '/api/v1/models').flush([]);
    await f.whenStable();
    f.detectChanges();
    expect(q(f, 'trend-error')).not.toBeNull();
    expect(q(f, 'trend-empty')).toBeNull();
  });

  it('Merge into… shows a loading option, then an empty hint when nothing can be a target (MDL-3, MDL-5)', async () => {
    const f = await openPending();
    http.expectOne(r => r.url === '/api/v1/dashboard').flush({ winRateOverTime: [] });
    q(f, 'merge')!.click();
    f.detectChanges();
    const select = q(f, 'merge-target')!;
    expect(select.tagName).toBe('MM-SELECT');
    expect(select.classList.contains('w-full')).toBe(true);
    expect(f.componentInstance.loadingTargets()).toBe(true);
    http.expectOne(r => r.url === '/api/v1/models').flush([]);
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.loadingTargets()).toBe(false);
    expect(f.componentInstance.targetOptions()).toEqual([]);
  });
});
