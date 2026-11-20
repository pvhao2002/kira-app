import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReportsPage } from './reports';

let http: HttpTestingController;
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => http.verify({ ignoreCancelled: true }));

const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';
/** Lets a flushed response reach its resource, then runs the effects that depend on it. */
const settle = async () => { await new Promise(r => setTimeout(r)); TestBed.tick(); };
const lookups = () => http.match(r => !r.url.includes('/reports/')).forEach(r => r.flush([]));

async function open(tab: string) {
  const f = TestBed.createComponent(ReportsPage);
  f.componentRef.setInput('tab', tab);
  f.detectChanges();
  TestBed.tick();
  lookups();
  return f;
}

// 3 settled picks: 1 win, 1 half loss, 1 loss. `wins`/`losses` include halves.
const model = {
  modelId: 'm1', modelName: 'gpt', modelVersion: '5', providerName: 'p', predictions: 3, picks: 4, settled: 3,
  wins: 1, halfWins: 0, fullWins: 1, losses: 2, halfLosses: 1, fullLosses: 1, pushOrVoid: 0, pending: 1,
  winRate: 0.3333, avgProbability: 0.6, correctScoreEvaluated: 0, correctScoreHits: 0, correctScoreAccuracy: null,
};

describe('ReportsPage performance columns (UX-006, UX-076)', () => {
  it('shows exclusive Wins / Half wins / Losses / Half losses / Push-void that add up to Settled', async () => {
    const f = await open('models');
    http.expectOne(r => r.url.endsWith('/reports/model-performance')).flush([model]);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const headers = [...el.querySelectorAll('thead th')].map(th => text(th as HTMLElement).trim());
    const cells = [...el.querySelectorAll('tbody tr:first-child td')].map(td => text(td as HTMLElement).trim());
    const at = (h: string) => Number(cells[headers.indexOf(h)]);
    expect(headers).toContain('Wins');
    expect(headers).toContain('Losses');
    expect(at('Wins') + at('Half wins') + at('Losses') + at('Half losses') + at('Push / void')).toBe(at('Settled'));
  });

  it('defines the win rate where it is shown', async () => {
    const f = await open('models');
    http.expectOne(r => r.url.endsWith('/reports/model-performance')).flush([model]);
    await f.whenStable();
    const th = [...(f.nativeElement as HTMLElement).querySelectorAll('thead th')].find(x => text(x as HTMLElement).includes('Win rate'))!;
    expect(th.getAttribute('title')).toContain('(W + ½W) / (W + ½W + L + ½L)');
  });
});

describe('ReportsPage model comparison (UX-009)', () => {
  const coverage = [{ minModels: 1, matches: 35 }, { minModels: 2, matches: 14 }, { minModels: 3, matches: 0 }];

  it('defaults "at least N models" to the largest N with data and says how many matches that is', async () => {
    const f = await open('comparison');
    http.expectNone(r => r.url.endsWith('/reports/model-comparison'));
    http.expectOne(r => r.url.endsWith('/reports/model-comparison/coverage')).flush(coverage);
    await settle();
    const req = http.expectOne(r => r.url.endsWith('/reports/model-comparison'));
    expect(req.request.params.get('minModels')).toBe('2');
    req.flush({ data: [], meta: { totalElements: 14 } });
    await f.whenStable();
    expect(text(f.nativeElement)).toContain('14 matches with ≥ 2 models');
  });

  it('keeps the user choice and lists the coverage per option', async () => {
    const f = await open('comparison');
    http.expectOne(r => r.url.endsWith('/reports/model-comparison/coverage')).flush(coverage);
    await settle();
    http.expectOne(r => r.url.endsWith('/reports/model-comparison')).flush({ data: [], meta: { totalElements: 14 } });
    await f.whenStable();
    const select = (f.nativeElement as HTMLElement).querySelector('#min-models') as HTMLSelectElement;
    expect([...select.options].map(o => o.textContent?.trim())).toEqual(['1 (35 matches)', '2 (14 matches)', '3 (0 matches)']);
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    TestBed.tick();
    expect(http.expectOne(r => r.url.endsWith('/reports/model-comparison')).request.params.get('minModels')).toBe('1');
  });

  it('quotes the top pick AH line one way, with the split as its tooltip (UX-008)', async () => {
    const f = await open('comparison');
    http.expectOne(r => r.url.endsWith('/reports/model-comparison/coverage')).flush([{ minModels: 1, matches: 1 }]);
    await settle();
    http.expectOne(r => r.url.endsWith('/reports/model-comparison')).flush({ data: [{
      matchId: 'x', homeTeam: 'A', awayTeam: 'B', league: 'L', startTime: null, status: 'FINISHED', finalHomeScore: 1, finalAwayScore: 0,
      models: [{ predictionId: 'p1', modelName: 'gpt', modelVersion: '5', predictedAt: null, predictionType: 'PRE_MATCH', matchMinute: null,
        predictedHomeScore: null, predictedAwayScore: null, correctScoreProbability: null, correctScoreHit: null, market: 'AH', pick: 'HOME',
        line: -0.25, lineDisplay: '0/-0.5', probability: 0.5, price: 1.9, result: 'WIN', predictionCount: 1 }],
    }], meta: { totalElements: 1 } });
    await f.whenStable();
    const cell = [...(f.nativeElement as HTMLElement).querySelectorAll('tbody td')].find(td => td.textContent?.includes('AH HOME')) as HTMLElement;
    expect(text(cell).trim()).toBe('AH HOME -0.25');
    expect(cell.title).toBe('0/-0.5');
  });

  it('falls back to 1 when nothing matches', async () => {
    await open('comparison');
    http.expectOne(r => r.url.endsWith('/reports/model-comparison/coverage')).flush([]);
    await settle();
    expect(http.expectOne(r => r.url.endsWith('/reports/model-comparison')).request.params.get('minModels')).toBe('1');
  });
});

describe('ReportsPage Monte Carlo (UX-092)', () => {
  const summary = {
    simulatedPredictions: 34, avgSimulationCount: 10000, avgExpectedRemainingGoals: 1.5, finishedPredictions: 26,
    avgActualRemainingGoals: 2, meanAbsGoalError: 1, correctScoreHits: 0, correctScoreAccuracy: 0,
  };
  const page = { data: [], meta: { totalElements: 0 } };

  it('shows the sample behind correct-score accuracy', async () => {
    const f = await open('montecarlo');
    http.expectOne(r => r.url.endsWith('/reports/monte-carlo')).flush({ summary, page });
    await f.whenStable();
    expect(text(f.nativeElement)).toContain('0.0%');
    expect(text(f.nativeElement)).toContain('0 / 26 finished');
  });

  it('shows a dash, not 0%, when no simulated prediction has finished', async () => {
    const f = await open('montecarlo');
    http.expectOne(r => r.url.endsWith('/reports/monte-carlo'))
      .flush({ summary: { ...summary, finishedPredictions: 0, correctScoreAccuracy: 0, avgActualRemainingGoals: null }, page });
    await f.whenStable();
    const kpi = [...(f.nativeElement as HTMLElement).querySelectorAll('.kpi')].find(k => text(k as HTMLElement).includes('Correct score accuracy'))!;
    expect(text(kpi as HTMLElement)).toContain('—');
    expect(text(kpi as HTMLElement)).not.toContain('0.0%');
  });
});
