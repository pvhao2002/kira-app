import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveService } from '../core/live.service';
import { Dashboard, PredictionRow } from '../core/models';
import { RESULT_COLORS, SERIES } from '../shared/chart';
import { isoDay } from '../shared/filter-bar';
import { DashboardPage } from './dashboard';

let http: HttpTestingController;
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: LiveService, useValue: { refresh: new Subject<void>() } }],
  });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => http.verify({ ignoreCancelled: true }));

const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ') ?? '';

// 3 settled (1 win, 1 half win, 1 loss), 5 pending.
const counts = {
  picks: 8, settled: 3, wins: 2, halfWins: 1, fullWins: 1, losses: 1, halfLosses: 0, fullLosses: 1, pushOrVoid: 0,
  pending: 5, avgProbability: null, winRate: 0.6667, units: 0.4, staked: 3, roi: 0.1333,
};
function dashboard(over: Partial<Dashboard> = {}, totals: Partial<Dashboard['totals']> = {}): Dashboard {
  return {
    period: { from: '2026-10-22T00:00:00Z', to: '2026-11-21T00:00:00Z', basis: 'predictedAt', firstPredictedAt: null, lastPredictedAt: null },
    totals: { ...counts, totalPredictions: 4, totalMatches: 3, activeModels: 2, totalModels: 5, predictionsToday: 1, overdueMatches: 2, notCountedPredictions: 0, ...totals },
    winRateOverTime: [{ day: '2026-11-19', wins: 2, losses: 1, settled: 3, winRate: 0.6667, units: 0.4 }],
    predictionsByModel: [{ model: 'gpt', predictions: 4 }],
    predictionsByMarket: [{ market: 'AH', picks: 8 }],
    resultDistribution: [{ result: 'WIN', picks: 1 }, { result: 'HALF_WIN', picks: 1 }, { result: 'LOSS', picks: 1 }, { result: 'PENDING', picks: 5 }],
    modelPerformance: [{ ...counts, key: 'gpt' }],
    ...over,
  };
}
function row(id: string, settlementStatus: string, predictedAt = new Date().toISOString()): PredictionRow {
  return { id, homeTeam: 'A', awayTeam: 'B', modelName: 'gpt', predictedAt, predictionType: 'PRE_MATCH', settlementStatus,
    topPickMarket: 'AH', topPick: 'HOME', topPickLine: -0.5, topPickLineDisplay: null } as unknown as PredictionRow;
}

async function open(d = dashboard(), recent: PredictionRow[] = [row('p1', 'WIN')]) {
  const f = TestBed.createComponent(DashboardPage);
  f.detectChanges();
  TestBed.tick();
  flush(d, recent);
  await f.whenStable();
  return f;
}
function flush(d: Dashboard, recent: PredictionRow[]) {
  http.match(r => r.url.endsWith('/dashboard')).forEach(r => r.flush(d));
  http.match(r => r.url.endsWith('/predictions')).forEach(r => r.flush({ data: recent, meta: { page: 0, size: 10, totalElements: recent.length, totalPages: 1 } }));
  http.match(r => !r.url.endsWith('/dashboard') && !r.url.endsWith('/predictions')).forEach(r => r.flush([]));
}
const links = (el: HTMLElement) => [...el.querySelectorAll('a')].map(a => ({ text: text(a).trim(), href: decodeURIComponent(a.getAttribute('href') ?? '') }));

describe('DashboardPage', () => {
  it('leaves pending out of the results donut and states settled and pending counts (UX-114)', async () => {
    const f = await open();
    expect(f.componentInstance.resultChart().labels).not.toContain('Pending');
    expect(text(f.nativeElement.querySelector('[data-testid="results-panel"]'))).toContain('3 settled · 5 pending');
  });

  it('says "No settled picks in this range" for win-rate charts with only pending picks (UX-022)', async () => {
    const d = dashboard({
      winRateOverTime: [{ day: '2026-11-19', wins: 0, losses: 0, settled: 0, winRate: null, units: null }],
      modelPerformance: [{ ...counts, key: 'gpt', winRate: null }],
      resultDistribution: [{ result: 'PENDING', picks: 5 }],
    });
    const f = await open(d);
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('mm-chart[type="line"]')).toHaveLength(0);
    expect(text(el).match(/No settled picks in this range/g)?.length).toBe(3);
  });

  it('explains "Active models a / b" in visible text (UX-022)', async () => {
    const f = await open();
    expect(text(f.nativeElement)).toContain('with predictions in range, of 5 known');
  });

  it('states the counted period on the KPI cards and links them to the filtered lists (UX-117)', async () => {
    const f = await open();
    f.componentInstance.load({ from: '2026-10-22T00:00:00Z', to: '2026-11-21T00:00:00Z', league: 'EPL', modelId: 'm1' });
    TestBed.tick();
    flush(dashboard(), [row('p1', 'WIN')]);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const from = isoDay(new Date('2026-10-22T00:00:00Z'));
    const to = isoDay(new Date(new Date('2026-11-21T00:00:00Z').getTime() - 1));
    const l = links(el);
    expect(l.find(x => x.text.startsWith('Predictions'))?.href).toBe(`/predictions?from=${from}&to=${to}&league=EPL&modelId=m1`);
    expect(l.find(x => x.text.startsWith('Matches'))?.href).toBe('/matches?league=EPL');
    expect(l.find(x => x.text.startsWith('Active models'))?.href).toBe('/models');
    expect(text(el.querySelector('.kpis')!)).toContain(f.componentInstance.periodLabel());
    expect(f.componentInstance.periodLabel()).toMatch(/2026/);
  });

  it('links pending picks and overdue matches to their lists (UX-113)', async () => {
    const f = await open();
    f.componentInstance.load({ league: 'EPL' });
    TestBed.tick();
    flush(dashboard(), [row('p1', 'WIN')]);
    await f.whenStable();
    const l = links(f.nativeElement);
    expect(l.find(x => x.text === '2 awaiting result')?.href).toBe('/matches?overdue=true&league=EPL');
    expect(l.find(x => x.text === '5 pending')?.href).toBe('/predictions?league=EPL&result=PENDING');
  });

  it('shows exclusive win/loss tallies and the win-rate formula (UX-006, UX-076)', async () => {
    const f = await open();
    const hero = text(f.nativeElement.querySelector('.hero'));
    expect(hero).toContain('1 won 1 half won 1 lost 0 half lost');
    expect(hero).toContain('(W + ½W) / (W + ½W + L + ½L)');
  });

  it('shows getting-started steps on a fresh install instead of only "No predictions yet." (UX-039)', async () => {
    const empty = dashboard({ resultDistribution: [], winRateOverTime: [], predictionsByModel: [], predictionsByMarket: [], modelPerformance: [] },
      { ...counts, picks: 0, settled: 0, pending: 0, totalPredictions: 0, totalMatches: 0, activeModels: 0, totalModels: 0, overdueMatches: 0, notCountedPredictions: 0 });
    const f = await open(empty, []);
    const hrefs = links(f.nativeElement).map(x => x.href);
    expect(hrefs).toContain('/prompts');
    expect(hrefs).toContain('/import');
    expect(hrefs).toContain('/settings');
  });

  it('shows the year on latest predictions outside the current year (UX-057)', async () => {
    const f = await open(dashboard(), [row('p1', 'WIN', '2036-11-20T17:00:00Z'), row('p2', 'WIN')]);
    const subs = [...(f.nativeElement as HTMLElement).querySelectorAll('.cell-sub')].map(x => text(x));
    expect(subs[0]).toContain('2036');
    expect(subs[1]).not.toContain(String(new Date().getFullYear()));
  });

  it('builds the form guide from settled predictions only, with a message when none are (UX-071)', async () => {
    const f = await open(dashboard(), [row('p1', 'PENDING'), row('p2', 'WIN'), row('p3', 'PENDING')]);
    expect(f.componentInstance.form().map(p => p.id)).toEqual(['p2']);

    const g = await open(dashboard(), [row('p1', 'PENDING'), row('p2', 'PENDING')]);
    expect(g.nativeElement.querySelectorAll('.fchip')).toHaveLength(0);
    expect(text(g.nativeElement.querySelector('.form-guide'))).toContain('none of the latest 2 predictions is settled yet');
  });

  it('quotes AH lines on latest predictions one way, with the split as its tooltip (UX-008)', async () => {
    const r = { ...row('p1', 'WIN'), topPickLine: -0.25, topPickLineDisplay: '0/-0.5' } as PredictionRow;
    const f = await open(dashboard(), [r]);
    const cell = (f.nativeElement as HTMLElement).querySelector('[data-testid="recent-pick"]') as HTMLElement;
    expect(text(cell).trim()).toBe('AH HOME -0.25');
    expect(cell.title).toBe('0/-0.5');
  });

  it('lists every model on the win-rate chart: horizontal bars, no skipped labels (UX-101)', async () => {
    const f = await open();
    const o = f.componentInstance.modelBarOptions as { indexAxis?: string; scales?: { y?: { ticks?: { autoSkip?: boolean } } } };
    expect(o.indexAxis).toBe('y');
    expect(o.scales?.y?.ticks?.autoSkip).toBe(false);
  });
});

describe('DashboardPage review fixes (DASH-1..9)', () => {
  it('shows a loading state, not "No predictions", while the latest predictions load (DASH-3)', async () => {
    const f = TestBed.createComponent(DashboardPage);
    f.detectChanges();
    TestBed.tick();
    http.match(r => r.url.endsWith('/dashboard')).forEach(r => r.flush(dashboard()));
    http.match(r => !r.url.endsWith('/dashboard') && !r.url.endsWith('/predictions')).forEach(r => r.flush([]));
    const el = f.nativeElement as HTMLElement;
    await vi.waitFor(() => { TestBed.tick(); f.detectChanges(); expect(el.querySelector('.form-guide')).not.toBeNull(); });   // whenStable would wait for the open request
    expect(text(el)).not.toContain('No predictions in this range');
    expect(text(el.querySelector('.form-guide')!)).toContain('loading');
    expect(el.querySelector('table[aria-label="Latest predictions"] mm-state[state="loading"]')).not.toBeNull();
    http.match(r => r.url.endsWith('/predictions')).forEach(r => r.flush({ data: [], meta: { page: 0, size: 10, totalElements: 0, totalPages: 1 } }));
    await f.whenStable();
    expect(text(el)).toContain('No predictions in this range');
  });

  it('links every KPI, including Units and ROI, and shows the Units/ROI definition as text (DASH-5, DASH-6)', async () => {
    const f = await open();
    const el = f.nativeElement as HTMLElement;
    const l = links(el);
    expect(l.find(x => x.text.startsWith('Units'))?.href).toBe('/reports');
    expect(l.find(x => x.text.startsWith('ROI'))?.href).toBe('/reports');
    expect(text(el.querySelector('[data-testid="roi-def"]')!)).toContain('ROI = units / staked');
  });

  it('colours charts from the theme tokens at draw time, not hard-coded hex (DASH-1, DASH-2)', async () => {
    const f = await open();
    const c = f.componentInstance;
    const fn = (c.modelRateChart().datasets[0].backgroundColor as unknown) as () => string;
    expect(fn()).toBe(SERIES[0]);
    const slice = (c.resultChart().datasets[0].backgroundColor as unknown) as (ctx: { dataIndex: number }) => string;
    expect(slice({ dataIndex: 0 })).toBe(RESULT_COLORS['WIN']);
    expect(slice({ dataIndex: 2 })).toBe(RESULT_COLORS['LOSS']);
  });

  it('grows the model charts with the number of models so labels never overlap (DASH-4)', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...counts, key: `model-${i}` }));
    const f = await open(dashboard({ modelPerformance: many }));
    expect(f.componentInstance.modelChartHeight()).toBe(30 * 26 + 60);
    expect(f.componentInstance.byModelChartHeight()).toBe(280);   // one model: the minimum
  });

  it('keeps the hero label short and moves the counts into a note (DASH-9)', async () => {
    const f = await open();
    const guide = text(f.nativeElement.querySelector('.form-guide'));
    expect(guide).toContain('Recent form (newest on the right)');
    expect(guide).toContain('Last 1 settled of the latest 1 predictions.');
  });
});

describe('DashboardPage count policy (UX-046)', () => {
  it('says how many predictions the latest-per-moment policy left out, and nothing when none', async () => {
    const f = await open(dashboard({}, { notCountedPredictions: 3 }));
    expect(text(f.nativeElement)).toContain('3 predictions not counted');
  });

  it('shows no footnote when every prediction is counted', async () => {
    const f = await open();
    expect(text(f.nativeElement)).not.toContain('not counted');
  });
});
