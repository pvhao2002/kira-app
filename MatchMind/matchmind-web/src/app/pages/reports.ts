import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ChartOptions } from 'chart.js';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { errorMessage, keepPrevious, safeValue, statusToView, viewState } from '../core/resource';
import { Filters } from '../core/models';
import { FilterBar } from '../shared/filter-bar';
import { Col, cell, downloadCsv, fmtDateTime, humanize, line, num, pct, saveBlob } from '../shared/format';
import {
  Expansion, Paginator, ResizableColumn, Sort, SortHeader, sortParam, sortRows, Tabs, ToastService,
} from '../shared/kit';
import { ChartView } from '../shared/chart';
import { JsonView, ResultTag, ScoreChip, StateView } from '../shared/ui';

type Tab = 'models' | 'history' | 'markets' | 'comparison' | 'montecarlo';
const TABS: { value: Tab; label: string }[] = [
  { value: 'models', label: 'AI model performance' }, { value: 'history', label: 'Prediction history' },
  { value: 'markets', label: 'Market performance' }, { value: 'comparison', label: 'Model comparison' },
  { value: 'montecarlo', label: 'Monte Carlo' },
];

const PERF_COLS: Col[] = [
  { field: 'predictions', header: 'Predictions', kind: 'int' }, { field: 'picks', header: 'Picks', kind: 'int' },
  { field: 'settled', header: 'Settled', kind: 'int' }, { field: 'wins', header: 'Wins incl. half', kind: 'int' },
  { field: 'halfWins', header: 'Half wins', kind: 'int' }, { field: 'losses', header: 'Losses incl. half', kind: 'int' },
  { field: 'halfLosses', header: 'Half losses', kind: 'int' }, { field: 'pushOrVoid', header: 'Push / void', kind: 'int' },
  { field: 'pending', header: 'Pending', kind: 'int' }, { field: 'winRate', header: 'Win rate', kind: 'pct' },
  { field: 'avgProbability', header: 'Avg prob.', kind: 'pct' },
];
const MODEL_COLS: Col[] = [
  { field: 'modelName', header: 'AI model' }, { field: 'modelVersion', header: 'Version' }, { field: 'providerName', header: 'Provider' },
  ...PERF_COLS,
  { field: 'correctScoreEvaluated', header: 'CS evaluated', kind: 'int' }, { field: 'correctScoreHits', header: 'CS hits', kind: 'int' },
  { field: 'correctScoreAccuracy', header: 'CS accuracy', kind: 'pct' },
];
const MARKET_COLS: Col[] = [{ field: 'market', header: 'Market' }, ...PERF_COLS.filter(c => c.field !== 'predictions')];
const BREAKDOWN_COLS: Col[] = [{ field: 'key', header: 'Group' }, ...PERF_COLS.filter(c => c.field !== 'predictions')];

/** History columns; `sort` is the backend sort key (absent = not sortable). */
interface HistCol extends Col { sort?: string; }
const HISTORY_COLS: HistCol[] = [
  { field: 'predictedAt', header: 'Date', kind: 'date', sort: 'predictedAt' },
  { field: 'league', header: 'League', sort: 'league' },
  { field: 'match', header: 'Match', sort: 'homeTeam' },
  { field: 'modelName', header: 'AI model', sort: 'model' },
  { field: 'predictionType', header: 'Type', sort: 'type' },
  { field: 'matchMinute', header: 'Minute', kind: 'int', sort: 'minute' },
  { field: 'current', header: 'Score at prediction' },
  { field: 'predicted', header: 'Predicted score' },
  { field: 'final', header: 'Actual score' },
  { field: 'corners', header: 'Final corners' },
  { field: 'market', header: 'Market', sort: 'market' },
  { field: 'pick', header: 'Pick' },
  { field: 'line', header: 'Line', sort: 'line' },
  { field: 'price', header: 'Odds', kind: 'num', sort: 'price' },
  { field: 'oddsStage', header: 'Odds stage' },
  { field: 'probability', header: 'Probability', kind: 'pct', sort: 'probability' },
  { field: 'result', header: 'Result', sort: 'result' },
  { field: 'settledAt', header: 'Settled', kind: 'date' },
  { field: 'settlementSource', header: 'Settled by' },
];
const HISTORY_DEFAULT_HIDDEN = new Set(['corners', 'oddsStage', 'settledAt', 'settlementSource']);
const HIDDEN_KEY = 'matchmind.history.hidden';

const isNum = (c: Col) => c.kind === 'int' || c.kind === 'num' || c.kind === 'pct';
/** Performance tables keep these columns on a phone; the rest stay on wider screens. */
const SM_KEEP = new Set(['modelName', 'market', 'key', 'predictions', 'settled', 'winRate']);
const hideSm = (c: Col) => !SM_KEEP.has(c.field);

/** One expanded model row: its results by market and by league, fetched only while the row is open. */
@Component({
  selector: 'mm-model-breakdown',
  imports: [StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as b) {
      <div class="grid-2">
        @for (part of [{ t: 'By market', rows: b.market }, { t: 'By league', rows: b.league }]; track part.t) {
          <div><h3 class="mb-2">{{ part.t }}</h3>
            <div class="table-wrap short"><table class="dt">
              <thead><tr>@for (c of cols; track c.field) { <th [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ c.header }}</th> }</tr></thead>
              <tbody>
                @for (x of part.rows; track x.key) { <tr>@for (c of cols; track c.field) { <td [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ cell(x, c) }}</td> }</tr> }
                @empty { <tr><td [attr.colspan]="cols.length" class="empty">No picks.</td></tr> }
              </tbody>
            </table></div></div>
        }
      </div>
    } @else { <mm-state [state]="state()" [message]="error()" [rows]="3" /> }`,
})
export class ModelBreakdown {
  readonly modelId = input.required<string>();
  readonly filters = input.required<Filters>();
  private readonly res = inject(ApiService).modelBreakdownResource(() => ({ ...this.filters(), modelId: this.modelId() }));
  readonly data = safeValue(this.res);
  readonly state = viewState(this.res);
  readonly error = errorMessage(this.res);
  readonly cols = BREAKDOWN_COLS;
  readonly isNum = isNum;
  readonly hideSm = hideSm;
  readonly cell = (r: unknown, c: Col) => cell(r as Record<string, unknown>, c);
}

@Component({
  selector: 'mm-reports',
  imports: [RouterLink, FilterBar, ModelBreakdown, Tabs, SortHeader, ResizableColumn, Paginator, ChartView, JsonView, ResultTag, ScoreChip, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; gap: .5rem; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: .6rem .75rem; }
    .toolbar .row { gap: .35rem; }
  `],
  template: `
    <div class="stack">
      <mm-filter-bar [fields]="['search', 'dates', 'league', 'model', 'type', 'market', 'result']" (changed)="onFilters($event)" />
      <mm-tabs [tabs]="tabs" [value]="tab()" (valueChange)="selectTab($event)" />

      <div class="stack" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab()">
      @switch (tab()) {
        @case ('models') {
          <section class="panel flush">
            <div class="toolbar">
              <span class="muted-text">Expand a model for its results by market and by league. Half wins and half losses count toward the win rate.</span>
              <button type="button" class="btn btn-outline btn-sm" (click)="csv('model-performance', modelCols, sortedModels())" [disabled]="!modelRows().length"><i class="pi pi-download"></i> CSV</button>
            </div>
            <mm-state [state]="state()" [message]="error()" />
            @if (state() === 'ready') {
              <div class="table-wrap tall"><table class="dt">
                <thead><tr><th class="th-icon"><span class="sr-only">Details</span></th>
                  @for (c of modelCols; track c.field) { <th mmResize [mmSort]="c.field" [(sort)]="modelSort" [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ c.header }}</th> }
                </tr></thead>
                <tbody>
                  @for (r of sortedModels(); track r.modelId) {
                    <tr>
                      <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="modelOpen.has(r.modelId)" aria-label="Toggle breakdown" (click)="modelOpen.toggle(r.modelId)">
                        <i class="pi" [class.pi-chevron-down]="modelOpen.has(r.modelId)" [class.pi-chevron-right]="!modelOpen.has(r.modelId)"></i></button></td>
                      @for (c of modelCols; track c.field) {
                        <td [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">
                          @if (c.field === 'modelName') { <a [routerLink]="['/models', r.modelId]">{{ r.modelName }}</a> } @else { {{ cell(r, c) }} }
                        </td>
                      }
                    </tr>
                    @if (modelOpen.has(r.modelId)) {
                      <tr class="expanded"><td [attr.colspan]="modelCols.length + 1">
                        <mm-model-breakdown [modelId]="r.modelId" [filters]="filters() ?? {}" />
                      </td></tr>
                    }
                  } @empty { <tr><td [attr.colspan]="modelCols.length + 1" class="empty">No predictions match these filters.</td></tr> }
                </tbody>
              </table></div>
            }
          </section>
        }

        @case ('history') {
          <section class="panel flush">
            <div class="toolbar">
              <details class="menu">
                <summary class="btn btn-sm"><i class="pi pi-table"></i> Columns ({{ shownHistoryCols().length }}/{{ historyCols.length }})</summary>
                <div class="menu-body" role="group" aria-label="Visible columns">
                  @for (c of historyCols; track c.field) {
                    <label class="check"><input type="checkbox" [checked]="isVisible(c.field)" (change)="toggleVisible(c.field)" /> {{ c.header }}</label>
                  }
                </div>
              </details>
              <div class="row">
                <button type="button" class="btn btn-outline btn-sm" [disabled]="!!exporting()" (click)="exportHistory('csv')">
                  <i class="pi" [class.pi-download]="exporting() !== 'csv'" [class.pi-spinner]="exporting() === 'csv'" [class.pi-spin]="exporting() === 'csv'"></i> CSV</button>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="!!exporting()" (click)="exportHistory('xlsx')">
                  <i class="pi" [class.pi-file-excel]="exporting() !== 'xlsx'" [class.pi-spinner]="exporting() === 'xlsx'" [class.pi-spin]="exporting() === 'xlsx'"></i> Excel</button>
              </div>
            </div>
            <div class="table-wrap tall"><table class="dt" [class.loading]="state() === 'loading'" [attr.aria-busy]="state() === 'loading'">
              <thead><tr><th class="th-icon"><span class="sr-only">Details</span></th>
                @for (c of shownHistoryCols(); track c.field) {
                  @if (c.sort) { <th mmResize [mmSort]="c.sort" [sort]="historySort()" (sortChange)="setHistorySort($event)" [class.num]="isNum(c)" [class.sticky-end]="c.field === 'result'">{{ c.header }}</th> }
                  @else { <th mmResize [class.num]="isNum(c)" [class.sticky-end]="c.field === 'result'">{{ c.header }}</th> }
                }
              </tr></thead>
              <tbody>
                @for (r of historyRows(); track r.pickId) {
                  <tr>
                    <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="historyOpen.has(r.pickId)" aria-label="Toggle details" (click)="historyOpen.toggle(r.pickId)">
                      <i class="pi" [class.pi-chevron-down]="historyOpen.has(r.pickId)" [class.pi-chevron-right]="!historyOpen.has(r.pickId)"></i></button></td>
                    @for (c of shownHistoryCols(); track c.field) {
                      <td [class.num]="isNum(c)" [class.sticky-end]="c.field === 'result'" class="nowrap">
                        @switch (c.field) {
                          @case ('match') { <a [routerLink]="['/matches', r.matchId]" [title]="r.homeTeam + ' – ' + r.awayTeam">{{ r.homeTeam }} – {{ r.awayTeam }}</a> }
                          @case ('modelName') { {{ r.modelName }} <span class="muted-text">{{ r.modelVersion }}</span> }
                          @case ('current') { @if (r.predictionType === 'LIVE') { <mm-score [home]="r.currentHomeScore" [away]="r.currentAwayScore" [muted]="true" /> } @else { — } }
                          @case ('predicted') { <mm-score [home]="r.predictedHomeScore" [away]="r.predictedAwayScore" /> }
                          @case ('final') { <mm-score [home]="r.finalHomeScore" [away]="r.finalAwayScore" [muted]="r.matchStatus !== 'FINISHED'" /> }
                          @case ('corners') { {{ r.finalHomeCorners ?? '—' }} : {{ r.finalAwayCorners ?? '—' }} }
                          @case ('line') { {{ line(r.market, r.line, r.lineDisplay) }} }
                          @case ('result') { <mm-result [value]="r.result" /> }
                          @case ('predictionType') { {{ humanize(r.predictionType) }} }
                          @case ('oddsStage') { {{ humanize(r.oddsStage) }} }
                          @case ('settlementSource') { {{ humanize(r.settlementSource) }} }
                          @default { {{ cell(r, c) }} }
                        }
                      </td>
                    }
                  </tr>
                  @if (historyOpen.has(r.pickId)) {
                    <tr class="expanded"><td [attr.colspan]="shownHistoryCols().length + 1">
                      <div class="grid-3">
                        <dl class="dl">
                          <dt>Match</dt><dd>{{ r.homeTeam }} – {{ r.awayTeam }} ({{ r.league }})</dd>
                          <dt>Kick-off</dt><dd>{{ fmt(r.startTime) }}</dd>
                          <dt>Match status</dt><dd>{{ humanize(r.matchStatus) }}</dd>
                          <dt>Final score / corners</dt><dd>{{ r.finalHomeScore ?? '—' }}:{{ r.finalAwayScore ?? '—' }} · {{ r.finalHomeCorners ?? '—' }}:{{ r.finalAwayCorners ?? '—' }}</dd>
                        </dl>
                        <dl class="dl">
                          <dt>Model</dt><dd>{{ r.modelName }} {{ r.modelVersion }}</dd>
                          <dt>Predicted</dt><dd>{{ fmt(r.predictedAt) }} · {{ humanize(r.predictionType) }}{{ r.matchMinute !== null ? ' · ' + r.matchMinute + "'" : '' }}</dd>
                          <dt>Predicted score</dt><dd>{{ r.predictedHomeScore ?? '—' }}:{{ r.predictedAwayScore ?? '—' }} ({{ pct(r.correctScoreProbability) }})</dd>
                          <dt>Pick rank</dt><dd>{{ r.pickRank }}</dd>
                        </dl>
                        <dl class="dl">
                          <dt>Market / pick</dt><dd>{{ r.market }} {{ r.pick }} {{ line(r.market, r.line, r.lineDisplay) }} &#64; {{ num(r.price) }}</dd>
                          <dt>Settlement basis</dt><dd>{{ humanize(r.settlementBasis) }}{{ r.homeScoreAtCapture !== null ? ' from ' + r.homeScoreAtCapture + ':' + r.awayScoreAtCapture : '' }}</dd>
                          <dt>Result</dt><dd>{{ humanize(r.result) }}{{ r.settledAt ? ' · ' + fmt(r.settledAt) + ' by ' + humanize(r.settlementSource) : '' }}</dd>
                          <dt>Full record</dt><dd><a [routerLink]="['/predictions', r.predictionId]">Odds, stats, settlement history and raw payload</a></dd>
                        </dl>
                      </div>
                    </td></tr>
                  }
                } @empty {
                  <tr><td [attr.colspan]="shownHistoryCols().length + 1" class="empty">{{ state() === 'loading' ? 'Loading…' : error() || 'No picks match these filters.' }}</td></tr>
                }
              </tbody>
            </table></div>
            <mm-paginator [page]="historyPage()" [size]="historySize()" [total]="historyTotal()" [sizes]="[50, 100, 200]" unit="picks" (pageChange)="setHistoryPage($event)" />
          </section>
        }

        @case ('markets') {
          <mm-state [state]="state()" [message]="error()" />
          @if (state() === 'ready') {
            <div class="grid-2">
              <section class="panel"><header><h2>Win rate by market</h2></header>
                <mm-chart type="bar" [data]="marketChart()" [options]="marketChartOptions" label="Win rate by market chart" /></section>
              <section class="panel"><header><h2>Outcomes by market</h2></header>
                <mm-chart type="bar" [data]="marketStack()" [options]="stackOptions" label="Outcomes by market chart" /></section>
            </div>
            <section class="panel flush">
              <div class="toolbar"><span class="muted-text">All five markets are always listed, including ones without picks.</span>
                <button type="button" class="btn btn-outline btn-sm" (click)="csv('market-performance', marketCols, sortedMarkets())"><i class="pi pi-download"></i> CSV</button></div>
              <div class="table-wrap"><table class="dt">
                <thead><tr>@for (c of marketCols; track c.field) { <th mmResize [mmSort]="c.field" [(sort)]="marketSort" [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ c.header }}</th> }</tr></thead>
                <tbody>@for (r of sortedMarkets(); track r.market) { <tr>@for (c of marketCols; track c.field) { <td [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ cell(r, c) }}</td> }</tr> }</tbody>
              </table></div>
            </section>
          }
        }

        @case ('comparison') {
          <section class="panel flush">
            <div class="toolbar">
              <div class="row"><label for="min-models">Matches with at least</label>
                <select class="input input-sm" id="min-models" [value]="minModels()" (change)="setMinModels($event)">
                  @for (n of [1, 2, 3, 4, 5]; track n) { <option [value]="n" [selected]="n === minModels()">{{ n }}</option> }
                </select>
                <span>models</span></div>
              <span class="muted-text">Latest prediction of each model per match, with its top pick.</span>
            </div>
            <mm-state [state]="state()" [message]="error()" />
            @if (state() === 'ready') {
              <div class="table-wrap tall"><table class="dt">
                <thead>
                  <tr><th>Match</th><th>Final</th><th>AI model</th><th>Predicted</th><th class="num">Type / min</th><th>Predicted score</th><th class="num">CS prob.</th>
                    <th>CS hit</th><th>Top pick</th><th class="num">Prob.</th><th class="num">Odds</th><th>Outcome</th><th class="num">Predictions</th></tr>
                </thead>
                <tbody>
                  @for (m of comparison(); track m.matchId) {
                    @for (r of m.models; track r.predictionId; let first = $first) {
                      <tr>
                        @if (first) {
                          <td [attr.rowspan]="m.models.length" class="group-cell"><a [routerLink]="['/matches', m.matchId]">{{ m.homeTeam }} – {{ m.awayTeam }}</a>
                            <span class="cell-sub">{{ m.league }} · {{ fmt(m.startTime) }}</span></td>
                          <td [attr.rowspan]="m.models.length" class="group-cell"><mm-score [home]="m.finalHomeScore" [away]="m.finalAwayScore" [muted]="m.status !== 'FINISHED'" />
                            <span class="cell-sub">{{ humanize(m.status) }}</span></td>
                        }
                        <td class="nowrap"><a [routerLink]="['/predictions', r.predictionId]">{{ r.modelName }}</a> <span class="cell-sub">{{ r.modelVersion }}</span></td>
                        <td class="nowrap">{{ fmt(r.predictedAt) }}</td>
                        <td class="num">{{ humanize(r.predictionType) }}{{ r.matchMinute !== null ? ' · ' + r.matchMinute + "'" : '' }}</td>
                        <td><mm-score [home]="r.predictedHomeScore" [away]="r.predictedAwayScore" /></td>
                        <td class="num">{{ pct(r.correctScoreProbability) }}</td>
                        <td>@if (r.correctScoreHit === null) { — } @else if (r.correctScoreHit) { <span class="win">Hit</span> } @else { <span class="loss">Miss</span> }</td>
                        <td class="nowrap">{{ r.market ? r.market + ' ' + r.pick + ' ' + line(r.market, r.line, r.lineDisplay) : '—' }}</td>
                        <td class="num">{{ pct(r.probability) }}</td>
                        <td class="num">{{ num(r.price) }}</td>
                        <td><mm-result [value]="r.result" /></td>
                        <td class="num">{{ r.predictionCount }}</td>
                      </tr>
                    }
                  } @empty { <tr><td colspan="13" class="empty">No match has predictions from that many models.</td></tr> }
                </tbody>
              </table></div>
              <mm-paginator [page]="comparisonPage()" [size]="20" [sizes]="[20]" [total]="comparisonTotal()" unit="matches" (pageChange)="setComparisonPage($event.page)" />
            }
          </section>
        }

        @case ('montecarlo') {
          @if (monteCarlo(); as mc) {
            <section class="kpis">
              <div class="kpi"><span>Simulated predictions</span><strong>{{ mc.summary.simulatedPredictions }}</strong></div>
              <div class="kpi"><span>Avg iterations</span><strong>{{ num(mc.summary.avgSimulationCount, 0) }}</strong></div>
              <div class="kpi"><span>Avg expected remaining goals</span><strong>{{ num(mc.summary.avgExpectedRemainingGoals) }}</strong></div>
              <div class="kpi"><span>Avg actual remaining goals</span><strong>{{ num(mc.summary.avgActualRemainingGoals) }}</strong></div>
              <div class="kpi"><span>Mean abs. goal error</span><strong>{{ num(mc.summary.meanAbsGoalError) }}</strong></div>
              <div class="kpi accent"><span>Correct score accuracy</span><strong>{{ pct(mc.summary.correctScoreAccuracy) }}</strong></div>
            </section>
          }
          <section class="panel flush">
            <div class="table-wrap tall"><table class="dt" [class.loading]="state() === 'loading'" [attr.aria-busy]="state() === 'loading'">
              <thead>
                <tr><th class="th-icon"><span class="sr-only">Details</span></th><th>Predicted</th><th>Match</th><th>AI model</th><th>Type / min</th><th>At prediction</th><th>Method</th>
                  <th class="num">Iterations</th><th class="num">xG home</th><th class="num">xG away</th><th class="num">xCorners home</th><th class="num">xCorners away</th>
                  <th>Predicted score</th><th class="num">CS prob.</th><th>Actual</th><th class="num">Actual rem. goals</th><th>Top pick</th></tr>
              </thead>
              <tbody>
                @for (r of monteCarlo()?.page?.data ?? []; track r.predictionId) {
                  <tr>
                    <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="mcOpen.has(r.predictionId)" aria-label="Toggle distribution" (click)="mcOpen.toggle(r.predictionId)">
                      <i class="pi" [class.pi-chevron-down]="mcOpen.has(r.predictionId)" [class.pi-chevron-right]="!mcOpen.has(r.predictionId)"></i></button></td>
                    <td class="nowrap"><a [routerLink]="['/predictions', r.predictionId]">{{ fmt(r.predictedAt) }}</a></td>
                    <td class="nowrap">{{ r.homeTeam }} – {{ r.awayTeam }}<span class="cell-sub">{{ r.league }}</span></td>
                    <td class="nowrap">{{ r.modelName }} <span class="cell-sub">{{ r.modelVersion }}</span></td>
                    <td>{{ humanize(r.predictionType) }}{{ r.matchMinute !== null ? ' · ' + r.matchMinute + "'" : '' }}</td>
                    <td><mm-score [home]="r.currentHomeScore" [away]="r.currentAwayScore" [muted]="true" /></td>
                    <td>{{ r.method }}</td>
                    <td class="num">{{ r.simulationCount }}</td>
                    <td class="num">{{ num(r.expectedHomeGoals) }}</td><td class="num">{{ num(r.expectedAwayGoals) }}</td>
                    <td class="num">{{ num(r.expectedHomeCorners) }}</td><td class="num">{{ num(r.expectedAwayCorners) }}</td>
                    <td><mm-score [home]="r.predictedHomeScore" [away]="r.predictedAwayScore" /></td>
                    <td class="num">{{ pct(r.correctScoreProbability) }}</td>
                    <td><mm-score [home]="r.finalHomeScore" [away]="r.finalAwayScore" [muted]="r.matchStatus !== 'FINISHED'" /></td>
                    <td class="num">{{ r.actualRemainingGoals ?? '—' }}</td>
                    <td><mm-result [value]="r.topPickResult" /></td>
                  </tr>
                  @if (mcOpen.has(r.predictionId)) {
                    <tr class="expanded"><td colspan="17">
                      <div class="grid-3">
                        <div><h3 class="mb-2">Predicted probabilities</h3><mm-json [value]="r.probabilitiesJson" /></div>
                        <div><h3 class="mb-2">Scoreline distribution</h3><mm-json [value]="r.distributionJson" /></div>
                        <dl class="dl"><dt>Seed</dt><dd>{{ r.randomSeed ?? '—' }}</dd><dt>Algorithm</dt><dd>{{ r.algorithmVersion ?? '—' }}</dd>
                          <dt>Final corners</dt><dd>{{ r.finalHomeCorners ?? '—' }}:{{ r.finalAwayCorners ?? '—' }}</dd></dl>
                      </div>
                    </td></tr>
                  }
                } @empty {
                  <tr><td colspan="17" class="empty">{{ state() === 'loading' ? 'Loading…' : error() || 'No prediction with a simulation matches these filters.' }}</td></tr>
                }
              </tbody>
            </table></div>
            <mm-paginator [page]="mcPage()" [size]="25" [sizes]="[25]" [total]="monteCarlo()?.page?.meta?.totalElements ?? 0" unit="predictions" (pageChange)="setMcPage($event.page)" />
          </section>
        }
      }
      </div>
    </div>`,
})
export class ReportsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(ToastService);

  /** Bound from the `tab` query parameter (withComponentInputBinding): a tab is linkable and Back/Forward work. */
  protected readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });
  readonly tabs = TABS;
  readonly tab = computed<Tab>(() => TABS.find(t => t.value === this.tabParam())?.value ?? 'models');
  /** The filters the filter bar last reported; no report loads before that. */
  readonly filters = signal<Filters | undefined>(undefined);

  readonly modelCols = MODEL_COLS;
  readonly marketCols = MARKET_COLS;
  readonly breakdownCols = BREAKDOWN_COLS;
  readonly historyCols = HISTORY_COLS;
  readonly isNum = isNum;
  readonly hideSm = hideSm;
  readonly cell = (r: unknown, c: Col) => cell(r as Record<string, unknown>, c);
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly pct = pct;
  readonly num = num;
  readonly line = line;

  // Paging, sorting and column state. Each report below is a resource that only runs while its tab is the active one,
  // so a request for another tab or older filters is cancelled and can never land.
  readonly modelSort = signal<Sort>({ field: 'winRate', dir: 'desc' });
  readonly modelOpen = new Expansion();
  readonly historyPage = signal(0);
  readonly historySize = signal(50);
  readonly historySort = signal<Sort>({ field: 'predictedAt', dir: 'desc' });
  readonly historyOpen = new Expansion();
  readonly visibleFields = signal<string[]>(this.restoreVisible());
  readonly exporting = signal<'csv' | 'xlsx' | null>(null);
  readonly marketSort = signal<Sort>({ field: 'market', dir: 'asc' });
  readonly minModels = signal(2);
  readonly comparisonPage = signal(0);
  readonly mcPage = signal(0);
  readonly mcOpen = new Expansion();

  private readonly modelsRes = rxResource({
    params: () => (this.tab() === 'models' ? this.filters() : undefined),
    stream: ({ params }) => this.api.modelPerformance(params),
  });
  private readonly historyRes = rxResource({
    params: () => {
      const f = this.filters();
      return f && this.tab() === 'history' ? { f, page: this.historyPage(), size: this.historySize(), sort: sortParam(this.historySort()) } : undefined;
    },
    stream: ({ params: { f, ...paging } }) => this.api.predictionHistory(f, paging),
  });
  private readonly marketsRes = rxResource({
    params: () => (this.tab() === 'markets' ? this.filters() : undefined),
    stream: ({ params }) => this.api.marketPerformance(params),
  });
  private readonly comparisonRes = rxResource({
    params: () => {
      const f = this.filters();
      return f && this.tab() === 'comparison' ? { f, minModels: this.minModels(), page: this.comparisonPage() } : undefined;
    },
    stream: ({ params: { f, minModels, page } }) => this.api.modelComparison(f, minModels, { page, size: 20 }),
  });
  private readonly monteCarloRes = rxResource({
    params: () => {
      const f = this.filters();
      return f && this.tab() === 'montecarlo' ? { f, page: this.mcPage() } : undefined;
    },
    stream: ({ params: { f, page } }) => this.api.monteCarlo(f, { page, size: 25 }),
  });

  private readonly active = computed(() => ({
    models: this.modelsRes, history: this.historyRes, markets: this.marketsRes, comparison: this.comparisonRes, montecarlo: this.monteCarloRes,
  })[this.tab()]);
  readonly state = computed(() => statusToView(this.active().status()));
  readonly error = computed(() => { const e = this.active().error(); return e ? apiError(e).message : ''; });

  // Report 1
  readonly modelRows = safeValue(this.modelsRes, []);
  readonly sortedModels = computed(() => sortRows(this.modelRows(), this.modelSort()));
  // Report 2: the table renders in every state, so keep the last rows while loading and never show a failed filter's rows.
  private readonly historyData = keepPrevious(this.historyRes);
  readonly historyRows = computed(() => this.historyData()?.data ?? []);
  readonly historyTotal = computed(() => this.historyData()?.meta.totalElements ?? 0);
  readonly shownHistoryCols = computed(() => { const v = new Set(this.visibleFields()); return HISTORY_COLS.filter(c => v.has(c.field)); });
  // Report 3
  readonly marketRows = safeValue(this.marketsRes, []);
  readonly sortedMarkets = computed(() => sortRows(this.marketRows(), this.marketSort()));
  readonly marketChart = computed(() => ({
    labels: this.marketRows().map(r => r.market),
    datasets: [{ label: 'Win rate', data: this.marketRows().map(r => r.winRate === null ? null : r.winRate * 100), backgroundColor: '#0e7c66', borderRadius: 4 }],
  }));
  readonly marketStack = computed(() => ({
    labels: this.marketRows().map(r => r.market),
    datasets: [
      { label: 'Wins', data: this.marketRows().map(r => r.wins), backgroundColor: '#1a8f55' },
      { label: 'Losses', data: this.marketRows().map(r => r.losses), backgroundColor: '#d14343' },
      { label: 'Push / void', data: this.marketRows().map(r => r.pushOrVoid), backgroundColor: '#8a96a8' },
      { label: 'Pending', data: this.marketRows().map(r => r.pending), backgroundColor: '#c98a00' },
    ],
  }));
  readonly marketChartOptions: ChartOptions = { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } } } };
  readonly stackOptions: ChartOptions = { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } };
  // Report 4
  private readonly comparisonData = safeValue(this.comparisonRes);
  readonly comparison = computed(() => this.comparisonData()?.data ?? []);
  readonly comparisonTotal = computed(() => this.comparisonData()?.meta.totalElements ?? 0);
  // Report 5
  readonly monteCarlo = keepPrevious(this.monteCarloRes);

  onFilters(f: Filters): void {
    this.historyPage.set(0);
    this.comparisonPage.set(0);
    this.mcPage.set(0);
    this.modelOpen.clear();
    this.historyOpen.clear();
    this.mcOpen.clear();
    this.filters.set(f);
  }

  /** Writes the tab to the URL; `tab` follows from the route. Every tab starts on its first page. */
  selectTab(value: string): void {
    const t = TABS.find(x => x.value === value)?.value;
    if (!t || t === this.tab()) return;
    this.historyPage.set(0);
    this.comparisonPage.set(0);
    this.mcPage.set(0);
    this.historyOpen.clear();
    this.mcOpen.clear();
    void this.router.navigate([], { queryParams: { tab: t }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  setHistorySort(s: Sort): void { this.historySort.set(s); this.historyPage.set(0); this.historyOpen.clear(); }
  setHistoryPage(e: { page: number; size: number }): void { this.historySize.set(e.size); this.historyPage.set(e.page); this.historyOpen.clear(); }
  setComparisonPage(page: number): void { this.comparisonPage.set(page); }
  setMcPage(page: number): void { this.mcPage.set(page); this.mcOpen.clear(); }
  setMinModels(e: Event): void { this.minModels.set(Number((e.target as HTMLSelectElement).value)); this.comparisonPage.set(0); }

  isVisible(field: string): boolean { return this.visibleFields().includes(field); }

  toggleVisible(field: string): void {
    const shown = this.isVisible(field) ? this.visibleFields().filter(f => f !== field) : [...this.visibleFields(), field];
    this.visibleFields.set(shown);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(HISTORY_COLS.map(c => c.field).filter(f => !shown.includes(f)))); } catch { /* optional */ }
  }

  async exportHistory(format: 'csv' | 'xlsx'): Promise<void> {
    this.exporting.set(format);
    try {
      const res = await firstValueFrom(this.api.exportHistory(this.filters() ?? {}, format, sortParam(this.historySort())));
      const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `prediction-history.${format}`;
      if (res.body) saveBlob(res.body, name);
    } catch (e) {
      // Blob responses carry the JSON error body as a Blob.
      let detail = apiError(e).message;
      try {
        const body = (e as { error?: unknown }).error;
        if (body instanceof Blob) detail = (JSON.parse(await body.text()) as { message?: string }).message ?? detail;
      } catch { /* keep generic */ }
      this.messages.add({ severity: 'error', summary: 'Export failed', detail });
    } finally {
      this.exporting.set(null);
    }
  }

  csv(name: string, cols: Col[], rows: object[]): void {
    downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, cols, rows as Record<string, unknown>[]);
  }

  private restoreVisible(): string[] {
    let hidden: string[] = [...HISTORY_DEFAULT_HIDDEN];
    try { const raw = localStorage.getItem(HIDDEN_KEY); if (raw) hidden = JSON.parse(raw) as string[]; } catch { /* default */ }
    return HISTORY_COLS.map(c => c.field).filter(f => !hidden.includes(f));
  }
}
