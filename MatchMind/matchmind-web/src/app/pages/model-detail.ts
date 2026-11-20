import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ChartOptions } from 'chart.js';
import { ApiService } from '../core/api.service';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { ChartView } from '../shared/chart';
import { fmtDateTime, humanize, lineSplit, pct, pickText } from '../shared/format';
import { ResultTag, ScoreChip, StateView } from '../shared/ui';

/** Below this many settled picks a win rate says little (UX-018/UX-081). */
const SMALL_SAMPLE = 30;

@Component({
  selector: 'mm-model-detail',
  imports: [RouterLink, ChartView, ResultTag, ScoreChip, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    h2, .sub { overflow-wrap: anywhere; min-width: 0; }
    .panel > header > div:first-child { min-width: 0; }
    .kpi small { display: block; margin-top: .25rem; width: fit-content; }
  `],
  template: `
    <div class="stack">
      <a routerLink="/models" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i> AI models</a>
      <mm-state [state]="state()" [message]="error()" />
      @if (model(); as m) {
        <section class="panel">
          <header><div><h2>{{ m.name }} <span class="muted-text">{{ m.version }}</span></h2>
            <p class="muted-text sub">{{ m.providerName }}, first seen {{ fmt(m.createdAt) }}</p></div>
            <a class="btn btn-outline btn-sm" data-testid="view-all" routerLink="/predictions" [queryParams]="{ modelId: m.id }">View all {{ m.totalPredictions }} predictions</a></header>
          @if (m.description) { <p class="page-note mb-2">{{ m.description }}</p> }
          <div class="kpis">
            <div class="kpi accent"><span>Win rate</span><strong>{{ pct(m.winRate) }}</strong>
              @if (m.settledPicks < smallSample) {
                <small class="tag tag-warn" data-testid="small-sample" [title]="'Fewer than ' + smallSample + ' settled picks: the win rate can swing a lot'">Small sample (n = {{ m.settledPicks }})</small>
              }</div>
            <div class="kpi"><span>Predictions</span><strong>{{ m.totalPredictions }}</strong></div>
            <div class="kpi"><span>Settled picks</span><strong>{{ m.settledPicks }}</strong></div>
            <div class="kpi"><span>Wins / losses</span><strong><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></strong></div>
            <div class="kpi"><span>Pending</span><strong class="pending">{{ m.pendingPicks }}</strong></div>
          </div>
        </section>
        <section class="panel">
          <header><h2>Win rate over time</h2><span class="muted-text">Daily, settled picks only</span></header>
          @if (trend(); as t) { <mm-chart type="line" [data]="t" [options]="pctOptions" label="Win rate of this model over time" /> }
          @else { <p class="muted-text" data-testid="trend-empty">Not enough settled days for a trend yet.</p> }
        </section>
        <div class="grid-2 align-start">
          @for (b of breakdowns(); track b.title) {
            <section class="panel flush">
              <header><h2>By {{ b.title }}</h2></header>
              <div class="table-wrap"><table class="dt" [attr.aria-label]="'Results by ' + b.title">
                <thead><tr><th class="cap">{{ b.title }}</th><th class="num">Picks</th><th class="num">W / L</th><th class="num hide-sm">Push/void</th><th class="num hide-sm">Pending</th><th class="num" title="(Win + half win) divided by settled picks. Push and void are left out.">Win rate</th></tr></thead>
                <tbody>@for (r of b.rows; track r.key) { <tr><td>{{ humanize(r.key) }}</td><td class="num">{{ r.picks }}</td>
                  <td class="num"><span class="win">{{ r.wins }}</span> / <span class="loss">{{ r.losses }}</span></td><td class="num hide-sm">{{ r.pushOrVoid }}</td>
                  <td class="num hide-sm">{{ r.pending }}</td><td class="num">{{ pct(r.winRate) }}</td></tr> }
                @empty { <tr><td colspan="6" class="empty">No picks yet.</td></tr> }</tbody>
              </table></div>
            </section>
          }
        </div>
        <section class="panel flush">
          <header><h2>Latest predictions</h2><a routerLink="/predictions" [queryParams]="{ modelId: m.id }">View all</a></header>
          <div class="table-wrap"><table class="dt compact-sm" aria-label="Latest predictions of this model">
            <thead><tr><th class="hide-sm">Predicted</th><th>Match</th><th class="hide-sm">Type</th><th class="hide-sm">Predicted score</th><th>Top pick</th><th class="num hide-sm">Prob.</th><th class="hide-sm">Final</th><th class="sticky-end">Result</th></tr></thead>
            <tbody>
              @for (p of recent(); track p.id) {
              <tr class="clickable" [routerLink]="['/predictions', p.id]" tabindex="-1">
                <td class="nowrap hide-sm"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td><td><span class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam">{{ p.homeTeam }} – {{ p.awayTeam }}</span><span class="cell-sub">{{ p.league }}</span><a class="cell-sub show-sm" [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
                <td class="hide-sm">{{ humanize(p.predictionType) }}</td><td class="hide-sm"><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td>
                <td class="nowrap" data-testid="recent-pick" [title]="lineSplit(p.topPickMarket, p.topPickLine)">{{ pickText(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}</td><td class="num hide-sm">{{ pct(p.topPickProbability) }}</td>
                <td class="hide-sm"><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="true" /></td><td class="sticky-end"><mm-result [value]="p.settlementStatus" /></td>
              </tr>
              } @empty { <tr><td colspan="8" class="empty">This model has no predictions yet.</td></tr> }
            </tbody>
          </table></div>
        </section>
      }
    </div>`,
})
export class ModelDetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly resource = this.api.modelOverviewResource(() => this.id());
  private readonly overview = safeValue(this.resource);
  /** Daily win rate of this model (dashboard API filtered by model); a failure only hides the chart. */
  private readonly dashboard = safeValue(this.api.dashboardResource(() => ({ modelId: this.id() }), Intl.DateTimeFormat().resolvedOptions().timeZone));
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly model = computed(() => this.overview()?.model);
  readonly breakdowns = computed(() => {
    const o = this.overview();
    return o ? [{ title: 'market', rows: o.market }, { title: 'prediction type', rows: o.type }] : [];
  });
  readonly recent = computed(() => this.overview()?.recent.data ?? []);
  /** Days with settled picks only; fewer than two is no trend. */
  readonly trend = computed(() => {
    const days = (this.dashboard()?.winRateOverTime ?? []).filter(d => d.settled > 0 && d.winRate !== null);
    return days.length < 2 ? null : {
      labels: days.map(d => d.day),
      datasets: [{ label: 'Win rate', data: days.map(d => Math.round(d.winRate! * 1000) / 10), borderColor: '#0b7a5e',
        backgroundColor: 'rgba(11,122,94,.12)', fill: true, tension: .25, pointRadius: days.length < 3 ? 5 : 2 }],
    };
  });
  readonly pctOptions: ChartOptions = {
    maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } } },
  };
  readonly smallSample = SMALL_SAMPLE;
  readonly fmt = fmtDateTime;
  readonly pct = pct;
  readonly humanize = humanize;
  readonly pickText = pickText;
  readonly lineSplit = lineSplit;

  constructor() {
    const title = inject(Title);
    effect(() => { const m = this.model(); if (m) title.setTitle(`${m.name} ${m.version} · MatchMind`); });
  }
}
