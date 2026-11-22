import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChartOptions, Scale } from 'chart.js';
import { ApiService } from '../core/api.service';
import { LiveService } from '../core/live.service';
import { Filters } from '../core/models';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { FilterBar, isoDay } from '../shared/filter-bar';
import { ROI_DEF, fmtShort, humanize, lineSplit, pct, pickText, units } from '../shared/format';
import { ChartView } from '../shared/chart';
import { ResultTag, SmallSample, StateView } from '../shared/ui';

// Same hues as the result tags and the form guide.
const RESULT_COLORS: Record<string, string> = {
  WIN: '#059669', HALF_WIN: '#6ee7b7', PUSH: '#8a96a8', VOID: '#c3cad5', HALF_LOSS: '#fda4af', LOSS: '#e11d48', PENDING: '#f59e0b',
};
const SERIES = ['#4f46e5', '#0891b2', '#c98a00', '#7b4bb3', '#d1603d', '#3a9fb0', '#5b6779', '#a3476f'];
const GRID = {};   // grid colour comes from the chart defaults (light/dark aware)
const WITH_YEAR = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
/**
 * Every model name on the axis, cut at 18 characters (the tooltip title keeps the full name).
 * ponytail: all labels even with ~40 models; switch to top N + "Others" if they start to overlap.
 */
const MODEL_TICKS = {
  autoSkip: false,
  callback(this: Scale, v: string | number) { const l = this.getLabelForValue(Number(v)); return l.length > 18 ? `${l.slice(0, 17)}…` : l; },
};

@Component({
  selector: 'mm-dashboard',
  imports: [RouterLink, ChartView, FilterBar, StateView, ResultTag, SmallSample],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    a.kpi { color: inherit; text-decoration: none; transition: border-color var(--mm-t) var(--mm-ease); }
    a.kpi:hover { border-color: var(--mm-green); }
    a.kpi:focus-visible { outline: none; box-shadow: var(--mm-focus); }
    .kpi > .kpi-sub { grid-column: 1 / -1; font-size: var(--fs-xs); font-weight: 400; color: var(--mm-ink-2); }
    .hero-tally a { color: inherit; margin-left: .55rem; text-underline-offset: 3px; }
    .hero-tally a b { margin-left: 0; }
    .chart-note { margin: .5rem 0 0; text-align: center; font-size: var(--fs-sm); color: var(--mm-ink-2); }
    .getting-started ol { margin: 0; padding-left: 1.25rem; display: grid; gap: .4rem; }
  `],
  template: `
    <div class="stack">
      <mm-filter-bar [fields]="['dates', 'league', 'model', 'type', 'market', 'count']" [initialDays]="30" (changed)="load($event)" />
      @if (review().length) {
        <section class="panel flush" aria-label="Picks to review">
          <header><h2>Needs review ({{ review().length }})</h2></header>
          <p class="muted-text review-note">The match result changed after these picks were settled, and they would now settle
            differently. Open each prediction and recalculate or override the pick.</p>
          <div class="table-wrap short">
            <table class="dt" aria-label="Picks to review">
              <thead><tr><th>Match</th><th>Pick</th><th>Stored</th><th>Now</th></tr></thead>
              <tbody>
                @for (r of review(); track r.pickId) {
                  <tr class="clickable" tabindex="-1" [routerLink]="['/predictions', r.predictionId]">
                    <td><a [routerLink]="['/predictions', r.predictionId]">{{ r.homeTeam }} – {{ r.awayTeam }}</a><span class="cell-sub">{{ humanize(r.matchStatus) }}</span></td>
                    <td class="nowrap">{{ humanize(r.market) }} · {{ humanize(r.pick) }}</td>
                    <td><mm-result [value]="r.currentResult" /></td>
                    <td><mm-result [value]="r.newResult" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
      <mm-state [state]="state()" [message]="error()" [rows]="4" />
      @if (data(); as d) {
        @if (d.totals.totalModels === 0) {
          <!-- Models are created by the first agent call, so no model at all means a fresh install. -->
          <section class="panel getting-started" aria-label="Getting started">
            <header><h2>Get started</h2></header>
            <ol>
              <li><a routerLink="/prompts">Prompts</a>: copy the prediction prompt and give it to your AI agent. The agent sends its predictions to MatchMind by itself.</li>
              <li><a routerLink="/import">Import</a>: or paste a prediction (JSON or a screenshot) by hand.</li>
              <li><a routerLink="/settings">Settings</a>: change your password and add the people who should see the results.</li>
            </ol>
          </section>
        }
        <section class="hero" aria-label="Win rate summary">
          <div class="hero-main">
            <span class="hero-label">Win rate for {{ periodLabel() }}</span>
            <strong class="hero-value">{{ pct(d.totals.winRate) }}</strong>
            <mm-small-sample [n]="d.totals.wins + d.totals.losses" />
            <span class="hero-note">Win rate = (W + ½W) / (W + ½W + L + ½L): a half win counts as a win, a half loss as a loss. Push, void and pending picks are left out.</span>
          </div>
          <div class="form-guide">
            @if (form().length) {
              <span class="hero-label">Recent outcomes: last {{ form().length }} settled of the latest {{ recent().length }} predictions, newest on the right</span>
              <ol class="form-chips">
                @for (p of form(); track p.id) {
                  <li><a class="fchip" [attr.data-r]="p.settlementStatus" [routerLink]="['/predictions', p.id]"
                    [title]="p.homeTeam + ' – ' + p.awayTeam + ': ' + humanize(p.settlementStatus)"
                    [attr.aria-label]="p.homeTeam + ' – ' + p.awayTeam + ', ' + humanize(p.settlementStatus)">{{ FORM[p.settlementStatus] ?? '?' }}</a></li>
                }
              </ol>
            } @else if (recent().length) {
              <span class="hero-label">Recent outcomes: none of the latest {{ recent().length }} predictions is settled yet.</span>
            }
            <span class="hero-tally"><b class="w">{{ d.totals.fullWins }}</b> won <b class="w">{{ d.totals.halfWins }}</b> half won
              <b class="l">{{ d.totals.fullLosses }}</b> lost <b class="l">{{ d.totals.halfLosses }}</b> half lost
              @if (d.totals.pushOrVoid) { <b>{{ d.totals.pushOrVoid }}</b> push / void }
              <b>{{ d.totals.settled }}</b> settled
              <a routerLink="/predictions" [queryParams]="pendingQuery()" title="Pending picks. Opens the predictions whose top pick is pending."><b class="p">{{ d.totals.pending }}</b> pending</a>
              @if (d.totals.overdueMatches) {
                <a routerLink="/matches" [queryParams]="overdueQuery()" title="Matches more than 3 hours past kick-off without a final result"><b class="p">{{ d.totals.overdueMatches }}</b> awaiting result</a>
              }
            </span>
          </div>
        </section>
        <section class="kpis" aria-label="Key figures">
          <a class="kpi" routerLink="/predictions" [queryParams]="listQuery()"><span>Predictions</span><strong>{{ d.totals.totalPredictions }}</strong><i class="pi pi-bolt" aria-hidden="true"></i>
            <span class="kpi-sub">{{ periodLabel() }}</span></a>
          <a class="kpi" routerLink="/predictions" [queryParams]="todayQuery()"><span>Today</span><strong>{{ d.totals.predictionsToday }}</strong><i class="pi pi-clock" aria-hidden="true"></i>
            <span class="kpi-sub">Predicted today</span></a>
          <a class="kpi" routerLink="/matches" [queryParams]="matchesQuery()"><span>Matches</span><strong>{{ d.totals.totalMatches }}</strong><i class="pi pi-calendar" aria-hidden="true"></i>
            <span class="kpi-sub">With predictions in {{ periodLabel() }}</span></a>
          <a class="kpi" routerLink="/models"><span>Active models</span><strong>{{ d.totals.activeModels }}<small> / {{ d.totals.totalModels }}</small></strong><i class="pi pi-microchip-ai" aria-hidden="true"></i>
            <span class="kpi-sub">{{ d.totals.activeModels }} with predictions in range, of {{ d.totals.totalModels }} known</span></a>
          <div class="kpi" [title]="roiDef"><span>Units</span><strong data-testid="kpi-units">{{ units(d.totals.units) }}</strong><i class="pi pi-wallet" aria-hidden="true"></i>
            <span class="kpi-sub">Profit at stake 1 over {{ d.totals.staked }} staked picks</span></div>
          <div class="kpi" [title]="roiDef"><span>ROI</span><strong data-testid="kpi-roi">{{ pct(d.totals.roi) }}</strong><i class="pi pi-percentage" aria-hidden="true"></i>
            <span class="kpi-sub">Units / staked <mm-small-sample [n]="d.totals.staked" /></span></div>
        </section>
        @if (d.totals.notCountedPredictions) {
          <p class="muted-text count-note">{{ d.totals.notCountedPredictions }} {{ d.totals.notCountedPredictions === 1 ? 'prediction' : 'predictions' }} not counted:
            a later prediction of the same match, model, type and minute replaces each. Choose "Count: all" to include them.</p>
        }
        <div class="dash-grid">
          <section class="panel span-4">
            <header><h2>Win rate over time</h2></header>
            @if (hasRate(d.winRateOverTime)) { <mm-chart type="line" [data]="winRateChart()" [options]="pctOptions" label="Win rate over time chart" /> }
            @else { <div class="empty-state"><i class="pi pi-chart-line" aria-hidden="true"></i><span>No settled picks in this range.</span></div> }
          </section>
          <section class="panel span-2" data-testid="results-panel">
            <header><h2>Results</h2></header>
            @if (resultChart().labels.length) { <mm-chart type="doughnut" [data]="resultChart()" [options]="doughnutOptions" label="Result distribution of settled picks chart" /> }
            @else { <div class="empty-state"><i class="pi pi-chart-pie" aria-hidden="true"></i><span>No settled picks in this range.</span></div> }
            <p class="chart-note">{{ d.totals.settled }} settled · {{ d.totals.pending }} pending</p>
          </section>
          <section class="panel span-2">
            <header><h2>Win rate by model</h2></header>
            @if (hasRate(d.modelPerformance)) { <mm-chart type="bar" [data]="modelRateChart()" [options]="modelBarOptions" label="Win rate by model chart" /> }
            @else { <div class="empty-state"><i class="pi pi-chart-bar" aria-hidden="true"></i><span>No settled picks in this range.</span></div> }
          </section>
          <section class="panel span-2">
            <header><h2>Predictions by model</h2></header>
            @if (d.predictionsByModel.length) { <mm-chart type="bar" [data]="byModelChart()" [options]="byModelOptions" label="Predictions by model chart" /> }
            @else { <div class="empty-state"><i class="pi pi-chart-bar" aria-hidden="true"></i><span>No predictions in this range.</span></div> }
          </section>
          <section class="panel span-2">
            <header><h2>Picks by market</h2></header>
            @if (d.predictionsByMarket.length) { <mm-chart type="bar" [data]="byMarketChart()" [options]="marketOptions" label="Picks by market chart" /> }
            @else { <div class="empty-state"><i class="pi pi-chart-pie" aria-hidden="true"></i><span>No picks in this range.</span></div> }
          </section>
          <section class="panel span-6">
            <header><h2>Cumulative units</h2></header>
            @if (hasUnits(d.winRateOverTime)) { <mm-chart type="line" [data]="unitsChart()" [options]="unitsOptions" label="Cumulative units at stake 1 per pick chart" /> }
            @else { <div class="empty-state"><i class="pi pi-chart-line" aria-hidden="true"></i><span>No staked picks in this range.</span></div> }
          </section>
          <section class="panel flush span-6">
            <header><h2>Latest predictions</h2><a routerLink="/predictions">All predictions</a></header>
            <div class="table-wrap short">
              <table class="dt compact-sm" aria-label="Latest predictions">
                <thead><tr><th>Match</th><th class="hide-sm">Model</th><th>Pick</th><th>Result</th></tr></thead>
                <tbody>
                  @for (p of recent(); track p.id) {
                    <tr class="clickable" tabindex="-1" [routerLink]="['/predictions', p.id]">
                      <td><a class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam" [routerLink]="['/predictions', p.id]">{{ p.homeTeam }} – {{ p.awayTeam }}</a><span class="cell-sub">{{ when(p.predictedAt) }} · {{ humanize(p.predictionType) }}</span></td>
                      <td class="hide-sm">{{ p.modelName }}</td>
                      <td class="nowrap" data-testid="recent-pick" [title]="lineSplit(p.topPickMarket, p.topPickLine)">{{ pickText(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}</td>
                      <td><mm-result [value]="p.settlementStatus" /></td>
                    </tr>
                  } @empty { <tr><td colspan="4" class="empty"><div class="empty-state"><i class="pi pi-bolt" aria-hidden="true"></i><span>No predictions in this range.</span></div></td></tr> }
                </tbody>
              </table>
            </div>
          </section>
        </div>
      }
    </div>`,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  /** Filters as last applied by the filter bar; null until it reports them, so nothing loads before that. */
  private readonly range = signal<Filters | null>(null);
  private readonly tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private readonly dashboard = this.api.dashboardResource(() => this.range() ?? undefined, this.tz);
  private readonly recentPage = this.api.recentPredictionsResource(() => this.range() ?? undefined);
  private readonly reviewItems = this.api.needsReviewResource();
  readonly state = viewState(this.dashboard);
  readonly error = errorMessage(this.dashboard);
  readonly data = safeValue(this.dashboard);
  readonly recent = computed(() => (this.recentPage.hasValue() ? this.recentPage.value().data : []));
  readonly review = safeValue(this.reviewItems, []);

  constructor() {
    // A live update reloads in place: reload() keeps the current figures on screen until the new ones arrive.
    inject(LiveService).refresh.pipe(takeUntilDestroyed()).subscribe(() => { this.dashboard.reload(); this.recentPage.reload(); });
  }
  readonly pct = pct;
  readonly units = units;
  readonly roiDef = ROI_DEF;
  readonly fmtShort = fmtShort;
  readonly humanize = humanize;
  readonly pickText = pickText;
  readonly lineSplit = lineSplit;
  /** Football form-guide letters; oldest first so the newest result sits on the right. */
  readonly FORM: Record<string, string> = { WIN: 'W', HALF_WIN: '½W', LOSS: 'L', HALF_LOSS: '½L', PUSH: 'P', VOID: 'V', PENDING: '–' };
  /** Settled ones among the latest predictions: a row of pending dashes says nothing about form. */
  readonly form = computed(() => this.recent().filter(p => p.settlementStatus !== 'PENDING').reverse());
  readonly hasRate = (rows: { winRate: number | null }[]) => rows.some(r => r.winRate !== null);
  readonly hasUnits = (rows: { units: number | null }[]) => rows.some(r => r.units !== null);

  /** Short date and time; with the year when it is not this year (a 2036 typo must not look like today). */
  when(iso: string): string {
    return new Date(iso).getFullYear() === new Date().getFullYear() ? fmtShort(iso) : WITH_YEAR.format(new Date(iso));
  }

  /** The applied filters as list-page query params, dates as `YYYY-MM-DD` like the filter bar writes them. */
  readonly listQuery = computed(() => {
    const f = this.range() ?? {};
    return {
      from: f.from ? isoDay(new Date(f.from)) : undefined,
      to: f.to ? isoDay(new Date(new Date(f.to).getTime() - 1)) : undefined,   // `to` is an exclusive day end
      league: f.league, modelId: f.modelId, type: f.type || undefined, market: f.market || undefined,
    };
  });
  readonly todayQuery = computed(() => { const t = isoDay(new Date()); return { ...this.listQuery(), from: t, to: t }; });
  readonly pendingQuery = computed(() => ({ ...this.listQuery(), result: 'PENDING' }));
  // The matches list filters by kick-off, not prediction time, so only the league carries over.
  readonly matchesQuery = computed(() => ({ league: this.range()?.league }));
  /** Same scope as totals.overdueMatches: league and provider only. */
  readonly overdueQuery = computed(() => ({ overdue: true, league: this.range()?.league, providerId: this.range()?.providerId }));


  readonly winRateChart = computed(() => {
    const rows = this.data()?.winRateOverTime ?? [];
    return {
      labels: rows.map(r => r.day),
      datasets: [{ label: 'Win rate', data: rows.map(r => r.winRate === null ? null : r.winRate * 100), borderColor: '#4f46e5',
        backgroundColor: 'rgba(79,70,229,.12)', fill: true, tension: .25, spanGaps: true, pointRadius: rows.length < 3 ? 5 : 2 }],
    };
  });
  /** Running total of the daily units; a day without staked picks keeps the total (UX-018). */
  readonly unitsChart = computed(() => {
    const rows = this.data()?.winRateOverTime ?? [];
    let total = 0;
    const data = rows.map(r => (total += Number(r.units ?? 0)));
    return {
      labels: rows.map(r => r.day),
      datasets: [{ label: 'Cumulative units', data, borderColor: SERIES[1], backgroundColor: 'rgba(8,145,178,.12)', fill: 'origin',
        tension: .2, pointRadius: rows.length < 3 ? 5 : 2 }],
    };
  });
  readonly unitsOptions: ChartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${units(ctx.parsed.y)} units` } } },
    scales: { x: { grid: { display: false } }, y: { grid: GRID, ticks: { callback: v => units(Number(v)) } } },
  };
  readonly resultChart = computed(() => {
    // Win/loss distribution of settled picks; pending ones would swamp it and are counted under the chart instead.
    const rows = (this.data()?.resultDistribution ?? []).filter(r => r.result !== 'PENDING' && r.picks > 0);
    return {
      labels: rows.map(r => humanize(r.result)),
      datasets: [{ data: rows.map(r => r.picks), backgroundColor: rows.map(r => RESULT_COLORS[r.result] ?? '#8a96a8'), borderWidth: 0, cutout: '68%' }],
    };
  });
  readonly modelRateChart = computed(() => {
    const rows = this.data()?.modelPerformance ?? [];
    return {
      labels: rows.map(r => r.key),
      datasets: [{ label: 'Win rate', data: rows.map(r => r.winRate === null ? null : r.winRate * 100), backgroundColor: '#4f46e5', borderRadius: 4 }],
    };
  });
  readonly byModelChart = computed(() => {
    const rows = this.data()?.predictionsByModel ?? [];
    return { labels: rows.map(r => r.model), datasets: [{ label: 'Predictions', data: rows.map(r => r.predictions), backgroundColor: SERIES[1], borderRadius: 4 }] };
  });
  readonly byMarketChart = computed(() => {
    const rows = this.data()?.predictionsByMarket ?? [];
    return { labels: rows.map(r => humanize(r.market)), datasets: [{ label: 'Picks', data: rows.map(r => r.picks), backgroundColor: rows.map((_, i) => SERIES[i % SERIES.length]), borderRadius: 4 }] };
  });

  /** Horizontal bars, one labelled row per model (vertical bars let Chart.js skip most model names). */
  readonly modelBarOptions: ChartOptions = {
    maintainAspectRatio: false, indexAxis: 'y',
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      afterLabel: ctx => `${this.data()?.modelPerformance[ctx.dataIndex]?.settled ?? '—'} settled picks`,
    } } },
    scales: { y: { grid: { display: false }, ticks: MODEL_TICKS }, x: { min: 0, max: 100, grid: GRID, ticks: { callback: v => `${v}%` } } },
  };
  readonly byModelOptions: ChartOptions = {
    maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
    scales: { y: { grid: { display: false }, ticks: MODEL_TICKS }, x: { beginAtZero: true, grid: GRID, ticks: { precision: 0 } } },
  };
  /** Horizontal bars: market names are long, so they read better on the left axis. */
  readonly marketOptions: ChartOptions = { maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { y: { grid: { display: false } }, x: { beginAtZero: true, grid: GRID, ticks: { precision: 0 } } } };
  readonly pctOptions: ChartOptions = {
    maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, grid: GRID, ticks: { callback: v => `${v}%` } } },
  };
  readonly doughnutOptions: ChartOptions = { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 14 } } } }; // cutout lives on the dataset

  /** "Nov 1 – Nov 19, 2026" for the period the API counted; `to` is an exclusive day end, so show the day before it. */
  readonly periodLabel = computed(() => {
    const { from, to } = this.data()?.period ?? {};
    if (!from && !to) return 'all time';
    const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const start = from ? day.format(new Date(from)) : 'start';
    const end = to ? day.format(new Date(new Date(to).getTime() - 1)) : 'today';
    return start === end ? start : `${start} – ${end}`;
  });

  load(f: Filters): void { this.range.set(f); }
}
