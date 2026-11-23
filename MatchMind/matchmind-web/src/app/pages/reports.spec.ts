import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { By } from '@angular/platform-browser';
import { RESULT_COLORS, SERIES } from '../shared/chart';
import { FilterBar } from '../shared/filter-bar';
import { ReportsPage } from './reports';

let http: HttpTestingController;
beforeAll(() => { Element.prototype.scrollIntoView ??= () => {}; });   // the select's list scrolls the active option into view
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => { http.verify({ ignoreCancelled: true }); document.body.querySelectorAll('.cdk-overlay-container').forEach(e => e.remove()); });

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
    const trigger = (f.nativeElement as HTMLElement).querySelector('button#min-models[role="combobox"]') as HTMLButtonElement;
    expect(text(trigger)).toContain('2 (14 matches)');
    trigger.click();
    await f.whenStable();
    const options = [...document.querySelectorAll('[role="option"]')] as HTMLElement[];
    expect(options.map(o => text(o).trim())).toEqual(['1 (35 matches)', '2 (14 matches)', '3 (0 matches)']);
    options[0].click();
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

describe('ReportsPage count policy (UX-046)', () => {
  it('sends countPolicy=all once "Count: all" is applied, and footnotes predictions not counted', async () => {
    const f = await open('models');
    http.expectOne(r => r.url.endsWith('/reports/model-performance') && !r.params.has('countPolicy'))
      .flush([{ ...model, notCountedPredictions: 2 }]);
    await f.whenStable();
    expect(text(f.nativeElement)).toContain('2 predictions not counted');

    const bar = f.debugElement.query(By.directive(FilterBar)).componentInstance as FilterBar;
    bar.form.patchValue({ count: 'all' });
    bar.apply(false);
    TestBed.tick();
    http.expectOne(r => r.url.endsWith('/reports/model-performance') && r.params.get('countPolicy') === 'all')
      .flush([{ ...model, notCountedPredictions: 0 }]);
    await f.whenStable();
    expect(text(f.nativeElement)).not.toContain('not counted');
  });
});

describe('ReportsPage ROI, small sample and calibration (UX-018)', () => {
  const cellOf = (el: HTMLElement, header: string) => {
    const headers = [...el.querySelectorAll('thead th')].map(th => text(th as HTMLElement).trim());
    return el.querySelectorAll('tbody tr:first-child td')[headers.indexOf(header)] as HTMLElement;
  };

  it('shows units and ROI, and a dash for a null ROI (nothing staked)', async () => {
    const f = await open('models');
    http.expectOne(r => r.url.endsWith('/reports/model-performance'))
      .flush([{ ...model, modelId: 'a', units: -0.05, staked: 5, roi: -0.01 }, { ...model, modelId: 'b', modelName: 'zz', units: null, staked: 0, roi: null, winRate: null }]);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const rows = [...el.querySelectorAll('tbody tr')].map(r => text(r as HTMLElement));
    expect(rows.find(r => r.includes('gpt'))).toContain('−0.050');
    expect(rows.find(r => r.includes('gpt'))).toContain('-1.0%');
    const headers = [...el.querySelectorAll('thead th')].map(th => text(th as HTMLElement).trim());
    const nullRow = [...el.querySelectorAll('tbody tr')].find(r => text(r as HTMLElement).includes('zz'))!;
    const tds = nullRow.querySelectorAll('td');
    expect(text(tds[headers.indexOf('ROI')] as HTMLElement).trim()).toBe('—');
    expect(text(tds[headers.indexOf('Units')] as HTMLElement).trim()).toBe('—');
  });

  it('badges the win rate at n = 29 (wins + losses) and not at n = 30; ROI on staked', async () => {
    const f = await open('models');
    http.expectOne(r => r.url.endsWith('/reports/model-performance'))
      .flush([{ ...model, wins: 15, losses: 14, units: 1, staked: 30, roi: 0.0333 }]);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(text(cellOf(el, 'Win rate'))).toContain('small sample (n = 29)');
    expect(cellOf(el, 'ROI').querySelector('[data-testid="small-sample"]')).toBeNull();

    const g = await open('models');
    http.expectOne(r => r.url.endsWith('/reports/model-performance'))
      .flush([{ ...model, wins: 15, losses: 15, units: 1, staked: 29, roi: 0.0345 }]);
    await g.whenStable();
    const el2 = g.nativeElement as HTMLElement;
    expect(cellOf(el2, 'Win rate').querySelector('[data-testid="small-sample"]')).toBeNull();
    expect(text(cellOf(el2, 'ROI'))).toContain('small sample (n = 29)');
  });

  it('renders the calibration tab with all 10 bins, greys thin bins and counts the excluded picks', async () => {
    const f = await open('calibration');
    const bins = Array.from({ length: 10 }, (_, i) => ({
      bin: i + 1, from: i / 10, to: (i + 1) / 10, picks: i === 5 ? 12 : i === 6 ? 3 : 0,
      avgProbability: i === 5 ? 0.55 : i === 6 ? 0.64 : null, hitRate: i === 5 ? 0.5833 : i === 6 ? 0.3333 : null,
    }));
    http.expectOne(r => r.url.endsWith('/reports/calibration')).flush({ bins, evaluated: 15, excluded: 4 });
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('[data-testid="calibration-bin"]');
    expect(rows.length).toBe(10);
    expect(rows[5].classList.contains('muted-text')).toBe(false);
    expect(rows[6].classList.contains('muted-text')).toBe(true);
    expect(text(rows[0] as HTMLElement)).toContain('—');
    expect(text(el)).toContain('excluded: 4');
    const chart = f.componentInstance.calibrationChart();
    expect(chart.datasets[0].data).toHaveLength(2);   // only non-empty bins are plotted
    // Thin bins are hollow, the others solid in the theme's accent (REP-3); colours are read on every draw (REP-2).
    const fill = chart.datasets[0].backgroundColor as unknown as (c: { dataIndex: number }) => string;
    const border = chart.datasets[0].borderColor as unknown as (c: { dataIndex: number }) => string;
    expect([fill({ dataIndex: 0 }), fill({ dataIndex: 1 })]).toEqual([SERIES[0], 'transparent']);
    expect(border({ dataIndex: 1 })).toBe(RESULT_COLORS['VOID']);
    expect(fill({ dataIndex: 2 })).toBe(SERIES[0]);
    expect(border({ dataIndex: 2 })).toBe(SERIES[0]);
    expect(chart.datasets[0].borderWidth).toEqual([1, 2]);
  });
});

describe('ReportsPage review fixes', () => {
  it('restores default history columns when every column was hidden in storage', () => {
    const baseline = TestBed.createComponent(ReportsPage);
    const defaults = baseline.componentInstance.visibleFields();
    const all = baseline.componentInstance.historyCols.map(c => c.field);
    baseline.destroy();
    localStorage.setItem('matchmind.history.hidden', JSON.stringify(all));
    try {
      const recovered = TestBed.createComponent(ReportsPage);
      expect(recovered.componentInstance.visibleFields()).toEqual(defaults);
    } finally {
      localStorage.removeItem('matchmind.history.hidden');
    }
  });

  it('keeps at least one history column checked (REP-18)', async () => {
    localStorage.setItem('matchmind.history.hidden', JSON.stringify(['league', 'match', 'modelName', 'predictionType', 'matchMinute', 'current', 'predicted', 'final',
      'corners', 'market', 'pick', 'line', 'price', 'oddsStage', 'probability', 'result', 'units', 'settledAt', 'settlementSource']));
    const f = await open('history');
    http.expectOne(r => r.url.endsWith('/reports/prediction-history')).flush({ data: [], meta: { totalElements: 0 } });
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.visibleFields()).toEqual(['predictedAt']);
    f.componentInstance.toggleVisible('predictedAt');
    expect(f.componentInstance.visibleFields()).toEqual(['predictedAt']);
    const boxes = [...(f.nativeElement as HTMLElement).querySelectorAll('.menu-body input[type=checkbox]')] as HTMLInputElement[];
    expect(boxes.filter(b => b.checked).every(b => b.disabled)).toBe(true);
    localStorage.removeItem('matchmind.history.hidden');
  });

  it('shows a load error as an error box with Retry, never as an empty-table message (REP-7, REP-8)', async () => {
    const f = await open('history');
    f.detectChanges();
    expect(text(f.nativeElement)).not.toContain('No picks match');   // first load: skeleton, not "empty"
    http.expectOne(r => r.url.endsWith('/reports/prediction-history')).flush({ status: 500, code: 'INTERNAL', message: 'Boom' }, { status: 500, statusText: 'Server Error' });
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(text(el.querySelector('.state-box.error') as HTMLElement)).toContain('Boom');
    expect(text(el)).not.toContain('No picks match');
    (el.querySelector('[data-testid="state-retry"]') as HTMLButtonElement).click();
    await settle();
    http.expectOne(r => r.url.endsWith('/reports/prediction-history')).flush({ data: [], meta: { totalElements: 0 } });
  });

  it('labels each expand button with its row (REP-12)', async () => {
    const f = await open('models');
    http.expectOne(r => r.url.endsWith('/reports/model-performance')).flush([model]);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('button[aria-label="Breakdown for gpt"]')).not.toBeNull();
  });
});
