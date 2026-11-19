import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartOptions } from 'chart.js';
import { Subscription } from 'rxjs';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { Dashboard, Filters, PredictionRow, ReviewItem } from '../core/models';
import { FilterBar } from '../shared/filter-bar';
import { fmtShort, humanize, pct, pickLabel } from '../shared/format';
import { ChartView } from '../shared/chart';
import { ResultTag, StateView } from '../shared/ui';

// Same hues as the result tags and the form guide.
const RESULT_COLORS: Record<string, string> = {
  WIN: '#157a47', HALF_WIN: '#5fb98a', PUSH: '#8a96a8', VOID: '#c3cad5', HALF_LOSS: '#e59393', LOSS: '#c53a3a', PENDING: '#e0a43a',
};
const SERIES = ['#0e7c66', '#2f6db5', '#c98a00', '#7b4bb3', '#d1603d', '#3a9fb0', '#5b6779', '#a3476f'];
const GRID = { color: '#e3e8ee' };

@Component({
  selector: 'mm-dashboard',
  imports: [RouterLink, ChartView, FilterBar, StateView, ResultTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <mm-filter-bar [fields]="['dates', 'league', 'model', 'type', 'market']" [initialDays]="30" (changed)="load($event)" />
      @if (review().length) {
        <section class="panel flush" aria-label="Picks to review">
          <header><h2>Needs review ({{ review().length }})</h2></header>
          <p class="muted-text review-note">The match result changed after these picks were settled, and they would now settle
            differently. Open each prediction and recalculate or override the pick.</p>
          <div class="table-wrap short">
            <table class="dt">
              <thead><tr><th>Match</th><th>Pick</th><th>Stored</th><th>Now</th></tr></thead>
              <tbody>
                @for (r of review(); track r.pickId) {
                  <tr class="clickable" [routerLink]="['/predictions', r.predictionId]">
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
        <section class="hero" aria-label="Win rate summary">
          <div class="hero-main">
            <span class="hero-label">Win rate for {{ rangeLabel() }}</span>
            <strong class="hero-value">{{ pct(d.totals.winRate) }}</strong>
            <span class="hero-note">Half wins count as wins, half losses as losses. Push, void and pending picks are left out.</span>
          </div>
          <div class="form-guide">
            @if (form().length) {
              <span class="hero-label">Form: last {{ form().length }} predictions, newest on the right</span>
              <ol class="form-chips">
                @for (p of form(); track p.id) {
                  <li><a class="fchip" [attr.data-r]="p.settlementStatus" [routerLink]="['/predictions', p.id]"
                    [title]="p.homeTeam + ' – ' + p.awayTeam + ': ' + humanize(p.settlementStatus)"
                    [attr.aria-label]="p.homeTeam + ' – ' + p.awayTeam + ', ' + humanize(p.settlementStatus)">{{ FORM[p.settlementStatus] ?? '?' }}</a></li>
                }
              </ol>
            }
            <span class="hero-tally"><b class="w">{{ d.totals.wins }}</b> won <b class="l">{{ d.totals.losses }}</b> lost
              <b>{{ d.totals.settled }}</b> settled <b class="p">{{ d.totals.pending }}</b> pending</span>
          </div>
        </section>
        <section class="kpis" aria-label="Key figures">
          <div class="kpi"><span>Predictions</span><strong>{{ d.totals.totalPredictions }}</strong></div>
          <div class="kpi"><span>Today</span><strong>{{ d.totals.predictionsToday }}</strong></div>
          <div class="kpi"><span>Matches</span><strong>{{ d.totals.totalMatches }}</strong></div>
          <div class="kpi"><span>Active models</span><strong>{{ d.totals.activeModels }}<small> / {{ d.totals.totalModels }}</small></strong></div>
        </section>
        <div class="grid-2">
          <section class="panel">
            <header><h2>Win rate over time</h2></header>
            @if (d.winRateOverTime.length) { <mm-chart type="line" [data]="winRateChart()" [options]="pctOptions" label="Win rate over time chart" /> }
            @else { <p class="muted-text">No settled picks in this range.</p> }
          </section>
          <section class="panel">
            <header><h2>Results</h2></header>
            @if (d.resultDistribution.length) { <mm-chart type="doughnut" [data]="resultChart()" [options]="doughnutOptions" label="Result distribution chart" /> }
            @else { <p class="muted-text">No picks in this range.</p> }
          </section>
          <section class="panel">
            <header><h2>Win rate by model</h2></header>
            @if (d.modelPerformance.length) { <mm-chart type="bar" [data]="modelRateChart()" [options]="pctBarOptions" label="Win rate by model chart" /> }
            @else { <p class="muted-text">No model has settled picks yet.</p> }
          </section>
          <section class="panel">
            <header><h2>Predictions by model</h2></header>
            @if (d.predictionsByModel.length) { <mm-chart type="bar" [data]="byModelChart()" [options]="countOptions" label="Predictions by model chart" /> }
            @else { <p class="muted-text">No predictions in this range.</p> }
          </section>
          <section class="panel">
            <header><h2>Picks by market</h2></header>
            @if (d.predictionsByMarket.length) { <mm-chart type="bar" [data]="byMarketChart()" [options]="countOptions" label="Picks by market chart" /> }
            @else { <p class="muted-text">No picks in this range.</p> }
          </section>
          <section class="panel flush">
            <header><h2>Latest predictions</h2><a routerLink="/predictions">All predictions</a></header>
            <div class="table-wrap short">
              <table class="dt">
                <thead><tr><th>Match</th><th>Model</th><th>Pick</th><th>Result</th></tr></thead>
                <tbody>
                  @for (p of recent(); track p.id) {
                    <tr class="clickable" [routerLink]="['/predictions', p.id]">
                      <td><a class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam" [routerLink]="['/predictions', p.id]">{{ p.homeTeam }} – {{ p.awayTeam }}</a><span class="cell-sub">{{ fmtShort(p.predictedAt) }} · {{ humanize(p.predictionType) }}</span></td>
                      <td>{{ p.modelName }}</td>
                      <td class="nowrap">{{ pickLabel(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}</td>
                      <td><mm-result [value]="p.settlementStatus" /></td>
                    </tr>
                  } @empty { <tr><td colspan="4" class="empty">No predictions yet.</td></tr> }
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
  readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  readonly error = signal('');
  readonly data = signal<Dashboard | null>(null);
  readonly recent = signal<PredictionRow[]>([]);
  readonly review = signal<ReviewItem[]>([]);

  constructor() {
    this.api.needsReview().subscribe({ next: r => this.review.set(r), error: () => undefined });
  }
  readonly pct = pct;
  readonly fmtShort = fmtShort;
  readonly humanize = humanize;
  readonly pickLabel = pickLabel;
  /** Football form-guide letters; oldest first so the newest result sits on the right. */
  readonly FORM: Record<string, string> = { WIN: 'W', HALF_WIN: '½W', LOSS: 'L', HALF_LOSS: '½L', PUSH: 'P', VOID: 'V', PENDING: '–' };
  readonly form = computed(() => [...this.recent()].reverse());

  private subs: Subscription[] = [];
  private readonly tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  readonly winRateChart = computed(() => {
    const rows = this.data()?.winRateOverTime ?? [];
    return {
      labels: rows.map(r => r.day),
      datasets: [{ label: 'Win rate', data: rows.map(r => r.winRate === null ? null : r.winRate * 100), borderColor: '#0b7a5e',
        backgroundColor: 'rgba(11,122,94,.12)', fill: true, tension: .25, spanGaps: true, pointRadius: rows.length < 3 ? 5 : 2 }],
    };
  });
  readonly resultChart = computed(() => {
    const rows = this.data()?.resultDistribution ?? [];
    return {
      labels: rows.map(r => humanize(r.result)),
      datasets: [{ data: rows.map(r => r.picks), backgroundColor: rows.map(r => RESULT_COLORS[r.result] ?? '#8a96a8'), borderWidth: 0, cutout: '68%' }],
    };
  });
  readonly modelRateChart = computed(() => {
    const rows = this.data()?.modelPerformance ?? [];
    return {
      labels: rows.map(r => r.key),
      datasets: [{ label: 'Win rate', data: rows.map(r => r.winRate === null ? null : r.winRate * 100), backgroundColor: '#0b7a5e', borderRadius: 4 }],
    };
  });
  readonly byModelChart = computed(() => {
    const rows = this.data()?.predictionsByModel ?? [];
    return { labels: rows.map(r => r.model), datasets: [{ label: 'Predictions', data: rows.map(r => r.predictions), backgroundColor: SERIES[1], borderRadius: 4 }] };
  });
  readonly byMarketChart = computed(() => {
    const rows = this.data()?.predictionsByMarket ?? [];
    return { labels: rows.map(r => r.market), datasets: [{ label: 'Picks', data: rows.map(r => r.picks), backgroundColor: rows.map((_, i) => SERIES[i % SERIES.length]), borderRadius: 4 }] };
  });

  readonly countOptions: ChartOptions = { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: GRID, ticks: { precision: 0 } } } };
  readonly pctOptions: ChartOptions = {
    maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, grid: GRID, ticks: { callback: v => `${v}%` } } },
  };
  readonly pctBarOptions: ChartOptions = this.pctOptions;
  readonly doughnutOptions: ChartOptions = { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 14 } } } }; // cutout lives on the dataset

  private readonly range = signal<Filters>({});
  /** "Nov 1 – Nov 19, 2026" for the applied dates; `to` is an exclusive day end, so show the day before it. */
  readonly rangeLabel = computed(() => {
    const { from, to } = this.range();
    if (!from && !to) return 'all time';
    const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const start = from ? day.format(new Date(from)) : 'start';
    const end = to ? day.format(new Date(new Date(to).getTime() - 1)) : 'today';
    return start === end ? start : `${start} – ${end}`;
  });

  load(f: Filters): void {
    this.range.set(f);
    this.state.set('loading');
    this.subs.forEach(s => s.unsubscribe()); // a newer filter wins over a slower older response
    this.subs = [this.api.dashboard(f, this.tz).subscribe({
      next: d => { this.data.set(d); this.state.set('ready'); },
      error: e => { this.data.set(null); this.error.set(apiError(e).message); this.state.set('error'); },
    }), this.api.predictions(f, { page: 0, size: 10, sort: 'predictedAt,desc' }).subscribe({
      next: p => this.recent.set(p.data), error: () => this.recent.set([]),
    })];
  }
}
