import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Chart, ChartOptions } from 'chart.js';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { errorMessage, keepPrevious, safeValue, statusToView, viewState } from '../core/resource';
import { CalibrationBin, Filters, PatternFactor, PatternRow, PerformanceCounts, TopPickBy, TypeCompareBy } from '../core/models';
import { FilterBar } from '../shared/filter-bar';
import { Col, ROI_DEF, cell, downloadCsv, fmtDateTime, humanize, lineSplit, lineText, num, pct, pickText, saveBlob, units } from '../shared/format';
import {
  Expansion, Paginator, ResizableColumn, Sort, SortHeader, sortParam, sortRows, Tabs, ToastService,
} from '../shared/kit';
import { ChartView, RESULT_COLORS, SERIES } from '../shared/chart';
import { Select, SelectOption } from '../shared/select';
import { DetailsMenu, JsonView, ResultTag, ScoreChip, SmallSample, StateView } from '../shared/ui';

type Tab = 'models' | 'toppick' | 'history' | 'markets' | 'calibration' | 'comparison' | 'montecarlo' | 'typecompare' | 'patterns';
const TABS: { value: Tab; label: string }[] = [
  { value: 'models', label: 'AI model performance' }, { value: 'toppick', label: 'Top pick' },
  { value: 'history', label: 'Prediction history' },
  { value: 'markets', label: 'Market performance' }, { value: 'calibration', label: 'Calibration' },
  { value: 'comparison', label: 'Model comparison' }, { value: 'montecarlo', label: 'Monte Carlo' },
  { value: 'typecompare', label: 'Pre-match vs Live' }, { value: 'patterns', label: 'Win/loss patterns' },
];
/** Win/loss patterns: the API's factors, in its order. */
const FACTOR_LABEL: Record<PatternFactor, string> = {
  market: 'Market', side: 'Market and side', type: 'Prediction type', stage: 'Odds stage', league: 'League', model: 'Model',
  rank: 'Pick rank', probability: 'Stated probability', price: 'Price', line: 'Market, side and line', minute: 'Match minute',
  scoreState: 'Score at prediction',
};
const FACTOR_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All factors' },
  ...Object.entries(FACTOR_LABEL).map(([value, label]) => ({ value, label }))];
const MIN_SAMPLE_OPTIONS: SelectOption[] = ['10', '20', '50', '100'].map(v => ({ value: v, label: v }));
/** Pre-match vs Live: the figures shown for each side. */
const SIDE_COLS: Col[] = [
  { field: 'picks', header: 'Picks', kind: 'int' }, { field: 'winRate', header: 'Win rate', kind: 'pct' },
  { field: 'units', header: 'Units', kind: 'units' }, { field: 'roi', header: 'ROI', kind: 'pct' },
];
const TYPE_BY_OPTIONS: SelectOption[] = [{ value: 'model', label: 'Model' }, { value: 'market', label: 'Market' }, { value: 'league', label: 'League' }];
const TOP_BY_OPTIONS: SelectOption[] = [...TYPE_BY_OPTIONS, { value: 'type', label: 'Type' }];
/** A fraction difference in percentage points, rounded to 0.1 first so sign and colour match what is shown. */
const roundedPoints = (v: number) => Math.round(v * 1000) / 10;
/** 0.1 -> "+10.0", -0.0123 -> "−1.2" (real minus sign, like `units`), -0.0004 -> "0.0"; null stays a dash. */
export function deltaPoints(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const p = roundedPoints(v);
  return p > 0 ? `+${p.toFixed(1)}` : p < 0 ? `−${Math.abs(p).toFixed(1)}` : '0.0';
}
const deltaClass = (v: number | null) => v === null ? '' : roundedPoints(v) > 0 ? 'win' : roundedPoints(v) < 0 ? 'loss' : '';
const TYPE_LABEL: Record<string, string> = { PRE_MATCH: 'Pre-match', LIVE: 'Live' };
/** Calibration bins with fewer picks than this are greyed out (owner decision, UX-018). */
const CALIBRATION_MIN_PICKS = 5;

/** Matches the API definition (API_DOCUMENTATION.md, "Win rate"); shown on every Win rate header. */
export const WIN_RATE_DEF = 'Win rate = (W + ½W) / (W + ½W + L + ½L): a half win counts as a win, a half loss as a loss. Push, void and pending picks are left out.';
const headerTitle = (c: Col) => c.field === 'winRate' ? WIN_RATE_DEF : c.field === 'units' || c.field === 'roi' ? ROI_DEF : null;
/** The denominator a small-sample badge is judged on: wins + losses for the win rate, staked for ROI; null elsewhere. */
export function sampleSize(r: { wins?: number; losses?: number; staked?: number }, field: string): number | null {
  if (field === 'winRate') return (r.wins ?? 0) + (r.losses ?? 0);
  if (field === 'roi') return r.staked ?? 0;
  return null;
}

// Exclusive counts (fullWins/fullLosses, not wins/losses which include the halves): Wins + Half wins + Losses + Half
// losses + Push / void = Settled.
const PERF_COLS: Col[] = [
  { field: 'predictions', header: 'Predictions', kind: 'int' }, { field: 'picks', header: 'Picks', kind: 'int' },
  { field: 'settled', header: 'Settled', kind: 'int' }, { field: 'fullWins', header: 'Wins', kind: 'int' },
  { field: 'halfWins', header: 'Half wins', kind: 'int' }, { field: 'fullLosses', header: 'Losses', kind: 'int' },
  { field: 'halfLosses', header: 'Half losses', kind: 'int' }, { field: 'pushOrVoid', header: 'Push / void', kind: 'int' },
  { field: 'pending', header: 'Pending', kind: 'int' }, { field: 'winRate', header: 'Win rate', kind: 'pct' },
  { field: 'units', header: 'Units', kind: 'units' }, { field: 'roi', header: 'ROI', kind: 'pct' },
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
  { field: 'units', header: 'Units', kind: 'units' },
  { field: 'settledAt', header: 'Settled', kind: 'date' },
  { field: 'settlementSource', header: 'Settled by' },
];
const HISTORY_DEFAULT_HIDDEN = new Set(['corners', 'oddsStage', 'settledAt', 'settlementSource']);
const HIDDEN_KEY = 'matchmind.history.hidden';

const isNum = (c: Col) => c.kind === 'int' || c.kind === 'num' || c.kind === 'pct' || c.kind === 'units';
/** Performance tables keep these columns on a phone; the rest stay on wider screens. */
const SM_KEEP = new Set(['modelName', 'market', 'key', 'predictions', 'settled', 'winRate']);
const hideSm = (c: Col) => !SM_KEEP.has(c.field);

/** One expanded model row: its results by market and by league, fetched only while the row is open. */
@Component({
  selector: 'mm-model-breakdown',
  imports: [StateView, SmallSample],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as b) {
      <div class="grid-2">
        @for (part of [{ t: 'By market', rows: b.market }, { t: 'By league', rows: b.league }]; track part.t) {
          <div><h3 class="mb-2">{{ part.t }}</h3>
            <div class="table-wrap short"><table class="dt" [attr.aria-label]="part.t">
              <thead><tr>@for (c of cols; track c.field) { <th [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)" [attr.title]="headerTitle(c)">{{ c.header }}</th> }</tr></thead>
              <tbody>
                @for (x of part.rows; track x.key) { <tr>@for (c of cols; track c.field) { <td [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ cell(x, c) }} @if (sampleSize(x, c.field) !== null) { <mm-small-sample [n]="sampleSize(x, c.field)!" /> }</td> }</tr> }
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
  readonly headerTitle = headerTitle;
  readonly sampleSize = sampleSize;
  readonly isNum = isNum;
  readonly hideSm = hideSm;
  readonly cell = (r: unknown, c: Col) => cell(r as Record<string, unknown>, c);
}

@Component({
  selector: 'mm-reports',
  imports: [FormsModule, RouterLink, FilterBar, ModelBreakdown, Tabs, SortHeader, ResizableColumn, Paginator, ChartView, DetailsMenu, JsonView, ResultTag, ScoreChip, Select, SmallSample, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; gap: .5rem; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: .6rem .75rem; }
    .toolbar .row { gap: .35rem; }
    /* An expanded row spans every column: pin its content to the left edge and cap its width, so it wraps in view. */
    .expand-box { position: sticky; left: 0; max-width: min(60rem, calc(100vw - 2rem)); }
    .kpi .skeleton { height: 1.2rem; width: 60%; }
    .kpi strong.skeleton { height: 1.6rem; width: 40%; }
  `],
  template: `
    <div class="stack">
      <mm-filter-bar [fields]="['search', 'dates', 'league', 'model', 'type', 'market', 'result', 'count']" (changed)="onFilters($event)" />
      <mm-tabs controls="reports-panel" [tabs]="tabs" [value]="tab()" (valueChange)="selectTab($event)" />

      <div class="stack" id="reports-panel" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab()">
      @switch (tab()) {
        @case ('models') {
          <section class="panel flush">
            <div class="toolbar">
              <span class="muted-text">Expand a model for its results by market and by league. {{ winRateDef }} {{ roiDef }}
                @if (notCounted()) { <b>{{ notCounted() }} {{ notCounted() === 1 ? 'prediction' : 'predictions' }} not counted</b> (superseded by a later one of the same match, model, type and minute; "Count: all" includes them). }</span>
              <button type="button" class="btn btn-outline btn-sm" (click)="csv('model-performance', modelCols, sortedModels())" [disabled]="!modelRows().length"><i class="pi pi-download"></i> CSV</button>
            </div>
            <mm-state [state]="state()" [message]="error()" retryable (retry)="retry()" />
            @if (state() === 'ready') {
              <div class="table-wrap tall"><table class="dt" aria-label="AI model performance">
                <thead><tr><th class="th-icon"><span class="sr-only">Details</span></th>
                  @for (c of modelCols; track c.field) { <th mmResize [mmSort]="c.field" [(sort)]="modelSort" [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)" [attr.title]="headerTitle(c)">{{ c.header }}</th> }
                </tr></thead>
                <tbody>
                  @for (r of sortedModels(); track r.modelId) {
                    <tr>
                      <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="modelOpen.has(r.modelId)" [attr.aria-controls]="'breakdown-' + r.modelId" [attr.aria-label]="'Breakdown for ' + r.modelName" (click)="modelOpen.toggle(r.modelId)">
                        <i class="pi" [class.pi-chevron-down]="modelOpen.has(r.modelId)" [class.pi-chevron-right]="!modelOpen.has(r.modelId)" aria-hidden="true"></i></button></td>
                      @for (c of modelCols; track c.field) {
                        <td [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">
                          @if (c.field === 'modelName') { <a [routerLink]="['/models', r.modelId]">{{ r.modelName }}</a> } @else { {{ cell(r, c) }} }
                          @if (sampleSize(r, c.field) !== null) { <mm-small-sample [n]="sampleSize(r, c.field)!" /> }
                        </td>
                      }
                    </tr>
                    @if (modelOpen.has(r.modelId)) {
                      <tr class="expanded" [id]="'breakdown-' + r.modelId"><td [attr.colspan]="modelCols.length + 1">
                        <div class="expand-box"><mm-model-breakdown [modelId]="r.modelId" [filters]="filters() ?? {}" /></div>
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
                    <label class="check"><input type="checkbox" [checked]="isVisible(c.field)" [disabled]="isVisible(c.field) && visibleFields().length === 1" (change)="toggleVisible(c.field)" /> {{ c.header }}</label>
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
            <mm-state [state]="firstLoadState(historyRows().length)" [message]="error()" retryable (retry)="retry()" />
            <div class="table-wrap tall"><table class="dt" aria-label="Prediction history" [class.loading]="state() === 'loading'" [attr.aria-busy]="state() === 'loading'">
              <thead><tr><th class="th-icon"><span class="sr-only">Details</span></th>
                @for (c of shownHistoryCols(); track c.field) {
                  @if (c.sort) { <th mmResize [mmSort]="c.sort" [sort]="historySort()" (sortChange)="setHistorySort($event)" [class.num]="isNum(c)" [class.sticky-end]="c.field === 'result'">{{ c.header }}</th> }
                  @else { <th mmResize [class.num]="isNum(c)" [class.sticky-end]="c.field === 'result'">{{ c.header }}</th> }
                }
              </tr></thead>
              <tbody>
                @for (r of historyRows(); track r.pickId) {
                  <tr>
                    <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="historyOpen.has(r.pickId)" [attr.aria-controls]="'pick-' + r.pickId" [attr.aria-label]="'Details of ' + r.homeTeam + ' – ' + r.awayTeam + ', ' + r.modelName" (click)="historyOpen.toggle(r.pickId)">
                      <i class="pi" [class.pi-chevron-down]="historyOpen.has(r.pickId)" [class.pi-chevron-right]="!historyOpen.has(r.pickId)" aria-hidden="true"></i></button></td>
                    @for (c of shownHistoryCols(); track c.field) {
                      <td [class.num]="isNum(c)" [class.sticky-end]="c.field === 'result'" class="nowrap"
                        [attr.title]="c.field === 'line' ? lineSplit(r.market, r.line) || null : null">
                        @switch (c.field) {
                          @case ('match') { <a [routerLink]="['/matches', r.matchId]" [title]="r.homeTeam + ' – ' + r.awayTeam">{{ r.homeTeam }} – {{ r.awayTeam }}</a> }
                          @case ('modelName') { {{ r.modelName }} <span class="muted-text">{{ r.modelVersion }}</span> @if (r.counted === false) { <span class="tag tag-secondary" title="A later prediction of the same match, model, type and minute replaces it in reports">not counted</span> } }
                          @case ('current') { @if (r.predictionType === 'LIVE') { <mm-score [home]="r.currentHomeScore" [away]="r.currentAwayScore" [muted]="true" /> } @else { — } }
                          @case ('predicted') { <mm-score [home]="r.predictedHomeScore" [away]="r.predictedAwayScore" /> }
                          @case ('final') { <mm-score [home]="r.finalHomeScore" [away]="r.finalAwayScore" [muted]="r.matchStatus !== 'FINISHED'" /> }
                          @case ('corners') { {{ r.finalHomeCorners ?? '—' }} : {{ r.finalAwayCorners ?? '—' }} }
                          @case ('line') { {{ lineText(r.market, r.line, r.lineDisplay) }} }
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
                    <tr class="expanded" [id]="'pick-' + r.pickId"><td [attr.colspan]="shownHistoryCols().length + 1"><div class="expand-box">
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
                          <dt>Market / pick</dt><dd [title]="lineSplit(r.market, r.line)">{{ pickText(r.market, r.pick, r.line, r.lineDisplay) }} &#64; {{ num(r.price) }}</dd>
                          <dt>Settlement basis</dt><dd>{{ humanize(r.settlementBasis) }}{{ r.homeScoreAtCapture !== null ? ' from ' + r.homeScoreAtCapture + ':' + r.awayScoreAtCapture : '' }}</dd>
                          <dt>Result</dt><dd>{{ humanize(r.result) }}{{ r.settledAt ? ' · ' + fmt(r.settledAt) + ' by ' + humanize(r.settlementSource) : '' }}</dd>
                          <dt>Full record</dt><dd><a [routerLink]="['/predictions', r.predictionId]">Odds, stats, settlement history and raw payload</a></dd>
                        </dl>
                      </div></div>
                    </td></tr>
                  }
                } @empty {
                  @if (state() === 'ready') { <tr><td [attr.colspan]="shownHistoryCols().length + 1" class="empty">No picks match these filters.</td></tr> }
                }
              </tbody>
            </table></div>
            <mm-paginator [page]="historyPage()" [size]="historySize()" [total]="historyTotal()" [sizes]="[50, 100, 200]" unit="picks" (pageChange)="setHistoryPage($event)" />
          </section>
        }

        @case ('toppick') {
          <mm-state [state]="state()" [message]="error()" retryable (retry)="retry()" />
          @if (state() === 'ready' && topPick(); as t) {
            <section class="kpis" aria-label="Top pick totals">
              <div class="kpi"><span>Picks</span><strong>{{ num(t.total.picks, 0) }}</strong></div>
              <div class="kpi"><span>Settled</span><strong>{{ num(t.total.settled, 0) }}</strong></div>
              <div class="kpi accent"><span>Win rate</span><strong>{{ pct(t.total.winRate) }}</strong></div>
              <div class="kpi"><span>Units</span><strong>{{ units(t.total.units) }}</strong></div>
              <div class="kpi"><span>ROI</span><strong>{{ pct(t.total.roi) }}</strong></div>
            </section>
            <section class="panel"><header><h2>Win rate by {{ humanize(topBy()) }}</h2></header>
              <mm-chart type="bar" [data]="topChart()" [options]="marketChartOptions" label="Top pick win rate chart" /></section>
          }
          <section class="panel flush">
            <div class="toolbar">
              <div class="row"><label for="top-by">Group by</label>
                <mm-select id="top-by" size="sm" [options]="topByOptions" [ngModel]="topBy()" (ngModelChange)="topBy.set($event)" /></div>
              <span class="muted-text">Only each prediction's top-ranked pick counts. {{ winRateDef }} {{ roiDef }}</span>
              <button type="button" class="btn btn-outline btn-sm" (click)="csv('top-pick', topCols, sortedTop())"><i class="pi pi-download"></i> CSV</button>
            </div>
            @if (state() === 'ready') {
              <div class="table-wrap"><table class="dt" aria-label="Top pick performance">
                <thead><tr>@for (c of topCols; track c.field) { <th mmResize [mmSort]="c.field" [(sort)]="topSort" [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)" [attr.title]="headerTitle(c)">{{ c.header }}</th> }</tr></thead>
                <tbody>@for (r of sortedTop(); track r.key) { <tr>@for (c of topCols; track c.field) { <td [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ cell(r, c) }} @if (sampleSize(r, c.field) !== null) { <mm-small-sample [n]="sampleSize(r, c.field)!" /> }</td> }</tr> }
                  @empty { <tr><td [attr.colspan]="topCols.length" class="empty">No predictions match these filters.</td></tr> }</tbody>
              </table></div>
            }
          </section>
        }

        @case ('markets') {
          <mm-state [state]="state()" [message]="error()" retryable (retry)="retry()" />
          @if (state() === 'ready') {
            <div class="grid-2">
              <section class="panel"><header><h2>Win rate by market</h2></header>
                <mm-chart type="bar" [data]="marketChart()" [options]="marketChartOptions" label="Win rate by market chart" /></section>
              <section class="panel"><header><h2>Outcomes by market</h2></header>
                <mm-chart type="bar" [data]="marketStack()" [options]="stackOptions" label="Outcomes by market chart" /></section>
            </div>
            <section class="panel flush">
              <div class="toolbar"><span class="muted-text">All five markets are always listed, including ones without picks. {{ winRateDef }} {{ roiDef }}</span>
                <button type="button" class="btn btn-outline btn-sm" (click)="csv('market-performance', marketCols, sortedMarkets())"><i class="pi pi-download"></i> CSV</button></div>
              <div class="table-wrap"><table class="dt" aria-label="Market performance">
                <thead><tr>@for (c of marketCols; track c.field) { <th mmResize [mmSort]="c.field" [(sort)]="marketSort" [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)" [attr.title]="headerTitle(c)">{{ c.header }}</th> }</tr></thead>
                <tbody>@for (r of sortedMarkets(); track r.market) { <tr>@for (c of marketCols; track c.field) { <td [class.num]="isNum(c)" [class.hide-sm]="hideSm(c)">{{ cell(r, c) }} @if (sampleSize(r, c.field) !== null) { <mm-small-sample [n]="sampleSize(r, c.field)!" /> }</td> }</tr> }</tbody>
              </table></div>
            </section>
          }
        }

        @case ('calibration') {
          <mm-state [state]="state()" [message]="error()" retryable (retry)="retry()" />
          @if (calibration(); as cal) {
            <section class="panel"><header><h2>Stated probability vs hit rate</h2></header>
              <mm-chart type="scatter" [data]="calibrationChart()" [options]="calibrationOptions" label="Calibration chart: average stated probability against hit rate per bin" />
              <p class="muted-text">Every pick of every rank. On the dashed line a model's stated probability matches how often it wins.
                Point size follows the number of picks; bins with fewer than {{ minPicks }} picks are hollow.</p>
            </section>
            <section class="panel flush">
              <div class="toolbar"><span class="muted-text"><b>Evaluated: {{ cal.evaluated }}</b> (wins and losses) · <b>excluded: {{ cal.excluded }}</b> (half wins, half losses, push and void: a quarter-line probability is not a plain win probability)</span></div>
              <div class="table-wrap"><table class="dt" aria-label="Calibration bins">
                <thead><tr><th>Stated probability</th><th class="num">Picks</th><th class="num">Avg stated</th><th class="num">Hit rate</th></tr></thead>
                <tbody>@for (b of cal.bins; track b.bin) {
                  <tr [class.muted-text]="b.picks < minPicks" data-testid="calibration-bin">
                    <td>{{ pct(b.from, 0) }} – {{ pct(b.to, 0) }} @if (b.picks < minPicks) { <span class="tag tag-warn nowrap">few picks</span> }</td><td class="num">{{ b.picks }}</td>
                    <td class="num">{{ pct(b.avgProbability) }}</td><td class="num">{{ pct(b.hitRate) }}</td>
                  </tr>
                }</tbody>
              </table></div>
            </section>
          }
        }

        @case ('comparison') {
          <section class="panel flush">
            <div class="toolbar">
              <div class="row"><label for="min-models">Matches with at least</label>
                <mm-select id="min-models" size="sm" [options]="minModelOptions()" [ngModel]="'' + minModels()" (ngModelChange)="setMinModels($event)" />
                <span>models</span></div>
              <span class="muted-text">@if (state() === 'ready') { <b>{{ comparisonTotal() }} {{ comparisonTotal() === 1 ? 'match' : 'matches' }} with ≥ {{ minModels() }} {{ minModels() === 1 ? 'model' : 'models' }}.</b> }
                Latest prediction of each model per match, with its top pick.</span>
            </div>
            <mm-state [state]="state()" [message]="error()" retryable (retry)="retry()" />
            @if (state() === 'ready') {
              <div class="table-wrap tall"><table class="dt" aria-label="Model comparison">
                <thead>
                  <tr><th>Match</th><th>Final</th><th>AI model</th><th class="hide-sm">Predicted</th><th class="hide-sm">Type / min</th><th class="hide-sm">Predicted score</th><th class="num hide-sm">CS prob.</th>
                    <th class="hide-sm">CS hit</th><th>Top pick</th><th class="num">Prob.</th><th class="num hide-sm">Odds</th><th>Outcome</th><th class="num hide-sm">Predictions</th></tr>
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
                        <td class="nowrap hide-sm">{{ fmt(r.predictedAt) }}</td>
                        <td class="hide-sm">{{ humanize(r.predictionType) }}{{ r.matchMinute !== null ? ' · ' + r.matchMinute + "'" : '' }}</td>
                        <td class="hide-sm"><mm-score [home]="r.predictedHomeScore" [away]="r.predictedAwayScore" /></td>
                        <td class="num hide-sm">{{ pct(r.correctScoreProbability) }}</td>
                        <td class="hide-sm">@if (r.correctScoreHit === null) { — } @else if (r.correctScoreHit) { <span class="win">Hit</span> } @else { <span class="loss">Miss</span> }</td>
                        <td class="nowrap" [title]="lineSplit(r.market, r.line)">{{ pickText(r.market, r.pick, r.line, r.lineDisplay) }}</td>
                        <td class="num">{{ pct(r.probability) }}</td>
                        <td class="num hide-sm">{{ num(r.price) }}</td>
                        <td><mm-result [value]="r.result" /></td>
                        <td class="num hide-sm">{{ r.predictionCount }}</td>
                      </tr>
                    }
                  } @empty { <tr><td colspan="13" class="empty">No match has predictions from that many models.</td></tr> }
                </tbody>
              </table></div>
              <mm-paginator [page]="comparisonPage()" [size]="20" [sizes]="[20]" [total]="comparisonTotal()" unit="matches" (pageChange)="setComparisonPage($event.page)" />
            }
          </section>
        }

        @case ('typecompare') {
          @if (typeKpiError()) { <mm-state state="error" [message]="typeKpiError()" retryable (retry)="retry()" /> }
          @else {
          <section class="kpis" aria-label="Pre-match and live totals">
            @for (k of typeKpis(); track k.type) {
              <div class="kpi"><span>{{ typeLabel[k.type] }}</span><strong>{{ pct(k.row?.winRate) }}</strong>
                <span class="kpi-sub">win rate · {{ k.row ? k.row.picks : '—' }} picks · {{ units(k.row?.units) }} units · ROI {{ pct(k.row?.roi) }}</span></div>
            }
          </section>
          }
          <section class="panel flush">
            <div class="toolbar">
              <div class="row"><label for="type-by">Group by</label>
                <mm-select id="type-by" size="sm" [options]="typeByOptions" [ngModel]="typeBy()" (ngModelChange)="typeBy.set($event)" /></div>
              <span class="muted-text">The prediction type filter does not apply here. Δ = live minus pre-match, in percentage points. {{ winRateDef }} {{ roiDef }}</span>
            </div>
            <mm-state [state]="state()" [message]="error()" retryable (retry)="retry()" />
            @if (state() === 'ready') {
              <div class="table-wrap tall"><table class="dt" aria-label="Pre-match vs Live">
                <thead>
                  <tr><th rowspan="2">{{ humanize(typeBy()) }}</th><th colspan="4" class="num">Pre-match</th><th colspan="4" class="num">Live</th><th colspan="2" class="num">Δ (live − pre-match)</th></tr>
                  <tr>
                    @for (side of ['pre', 'live']; track side) { @for (c of sideCols; track c.field) { <th class="num" [attr.title]="headerTitle(c)">{{ c.header }}</th> } }
                    <th class="num" [attr.title]="winRateDef">Δ Win rate</th><th class="num" [attr.title]="roiDef">Δ ROI</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of typeRows(); track r.key) {
                    <tr>
                      <td>{{ r.key }}</td>
                      @for (c of sideCols; track c.field) { <td class="num">{{ cell(r.preMatch ?? {}, c) }}</td> }
                      @for (c of sideCols; track c.field) { <td class="num">{{ cell(r.live ?? {}, c) }}</td> }
                      <td class="num" [class]="deltaClass(r.winRateDelta)">{{ deltaPoints(r.winRateDelta) }}</td>
                      <td class="num" [class]="deltaClass(r.roiDelta)">{{ deltaPoints(r.roiDelta) }}</td>
                    </tr>
                  } @empty { <tr><td colspan="11" class="empty">No predictions match these filters.</td></tr> }
                </tbody>
              </table></div>
            }
          </section>
        }

        @case ('patterns') {
          @if (patterns(); as p) {
            <section class="kpis" aria-label="Overall">
              <div class="kpi"><span>Overall win rate</span><strong>{{ pct(p.overall.winRate) }}</strong>
                <span class="kpi-sub">{{ p.overall.wins }}–{{ p.overall.losses }} decided · {{ p.overall.picks }} picks · ROI {{ pct(p.overall.roi) }}</span></div>
              <div class="kpi"><span>Watch out</span><strong>{{ patternWarnings().length }}</strong><span class="kpi-sub">groups significantly worse</span></div>
              <div class="kpi"><span>Strengths</span><strong>{{ patternStrengths().length }}</strong><span class="kpi-sub">groups significantly better</span></div>
            </section>
          }
          <section class="panel flush">
            <div class="toolbar">
              <div class="row"><label for="pattern-min">Min. decided picks</label>
                <mm-select id="pattern-min" size="sm" [options]="minSampleOptions" [ngModel]="'' + patternMinSample()" (ngModelChange)="patternMinSample.set(+$event)" /></div>
              <span class="muted-text">A group is flagged when its win rate is at least 1.96 standard errors away from the overall win rate
                over at least that many decided picks. Many groups are tested and they overlap, so about 1 in 20 can be flagged by
                chance: treat flags as things to check, not proof. "vs overall" is in percentage points. {{ winRateDef }}</span>
            </div>
            <mm-state [state]="state()" [message]="error()" retryable (retry)="retry()" />
          </section>
          @if (state() === 'ready') {
            @for (l of patternLists(); track l.label) {
              <section class="panel flush"><header><h2>{{ l.label }}</h2></header>
                <div class="table-wrap"><table class="dt" [attr.aria-label]="l.label">
                  <thead><tr><th>Factor</th><th>Value</th><th class="num" title="Wins–losses; a half win or loss counts as one">W–L</th>
                    <th class="num" [attr.title]="winRateDef">Win rate</th><th class="num">vs overall</th><th class="num" [attr.title]="roiDef">ROI</th></tr></thead>
                  <tbody>
                    @for (r of l.rows; track r.factor + r.value) {
                      <tr><td>{{ factorLabel[r.factor] }}</td><td>{{ r.value }}</td><td class="num">{{ r.wins }}–{{ r.losses }}</td>
                        <td class="num">{{ pct(r.winRate) }}</td><td class="num" [class]="deltaClass(r.lift)">{{ deltaPoints(r.lift) }}</td><td class="num">{{ pct(r.roi) }}</td></tr>
                    } @empty { <tr><td colspan="6" class="empty">{{ l.empty }}</td></tr> }
                  </tbody>
                </table></div>
              </section>
            }
            <section class="panel flush">
              <div class="toolbar"><div class="row"><label for="pattern-factor">Factor</label>
                <mm-select id="pattern-factor" size="sm" [options]="factorOptions" [ngModel]="patternFactor()" (ngModelChange)="patternFactor.set($event)" /></div></div>
              <div class="table-wrap tall"><table class="dt" aria-label="All factors">
                <thead><tr><th>Factor</th><th>Value</th><th class="num" title="Wins–losses; a half win or loss counts as one">W–L</th>
                  <th class="num" [attr.title]="winRateDef">Win rate</th><th class="num">vs overall</th><th class="num" [attr.title]="roiDef">ROI</th>
                  <th class="num hide-sm">Picks</th><th>Signal</th></tr></thead>
                <tbody>
                  @for (r of patternRows(); track r.factor + r.value) {
                    <tr><td>{{ factorLabel[r.factor] }}</td><td>{{ r.value }}</td><td class="num">{{ r.wins }}–{{ r.losses }}</td>
                      <td class="num">{{ pct(r.winRate) }}</td><td class="num" [class]="deltaClass(r.lift)">{{ deltaPoints(r.lift) }}</td><td class="num">{{ pct(r.roi) }}</td>
                      <td class="num hide-sm">{{ r.picks }}</td>
                      <td [class.loss]="r.signal === 'WARNING'" [class.win]="r.signal === 'STRENGTH'">{{ r.signal === 'WARNING' ? 'Watch out' : r.signal === 'STRENGTH' ? 'Strength' : '' }}</td></tr>
                  } @empty { <tr><td colspan="8" class="empty">No predictions match these filters.</td></tr> }
                </tbody>
              </table></div>
            </section>
          }
        }

        @case ('montecarlo') {
          @if (monteCarlo(); as mc) {
            <section class="kpis">
              <div class="kpi"><span>Simulated predictions</span><strong>{{ num(mc.summary.simulatedPredictions, 0) }}</strong></div>
              <div class="kpi"><span>Avg iterations</span><strong>{{ num(mc.summary.avgSimulationCount, 0) }}</strong></div>
              <div class="kpi"><span>Avg expected remaining goals</span><strong>{{ num(mc.summary.avgExpectedRemainingGoals) }}</strong></div>
              <div class="kpi"><span>Avg actual remaining goals</span><strong>{{ num(mc.summary.avgActualRemainingGoals) }}</strong>
                <span class="kpi-sub">{{ mc.summary.finishedPredictions }} finished</span></div>
              <div class="kpi"><span>Mean abs. goal error</span><strong>{{ num(mc.summary.meanAbsGoalError) }}</strong>
                <span class="kpi-sub">{{ mc.summary.finishedPredictions }} finished</span></div>
              <!-- Accuracy over finished predictions only; with none finished it is unknown, not 0%. -->
              <div class="kpi accent"><span>Correct score accuracy</span><strong>{{ mc.summary.finishedPredictions ? pct(mc.summary.correctScoreAccuracy) : '—' }}</strong>
                <span class="kpi-sub">{{ mc.summary.correctScoreHits }} / {{ mc.summary.finishedPredictions }} finished</span></div>
            </section>
          } @else if (state() === 'loading') {
            <section class="kpis" aria-hidden="true">
              @for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="kpi"><span class="skeleton"></span><strong class="skeleton"></strong></div> }
            </section>
          }
          <mm-state [state]="firstLoadState(monteCarlo()?.page?.data?.length ?? 0)" [message]="error()" retryable (retry)="retry()" />
          <section class="panel flush">
            <div class="table-wrap tall"><table class="dt" aria-label="Monte Carlo simulations" [class.loading]="state() === 'loading'" [attr.aria-busy]="state() === 'loading'">
              <thead>
                <tr><th class="th-icon"><span class="sr-only">Details</span></th><th class="hide-sm">Predicted</th><th>Match</th><th>AI model</th><th>Type / min</th><th class="hide-sm">At prediction</th><th class="hide-sm">Method</th>
                  <th class="num hide-sm">Iterations</th><th class="num hide-sm">xG home</th><th class="num hide-sm">xG away</th><th class="num hide-sm">xCorners home</th><th class="num hide-sm">xCorners away</th>
                  <th>Predicted score</th><th class="num hide-sm">CS prob.</th><th>Actual</th><th class="num hide-sm">Actual rem. goals</th><th>Top pick</th></tr>
              </thead>
              <tbody>
                @for (r of monteCarlo()?.page?.data ?? []; track r.predictionId) {
                  <tr>
                    <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="mcOpen.has(r.predictionId)" [attr.aria-controls]="'sim-' + r.predictionId" [attr.aria-label]="'Distribution of ' + r.homeTeam + ' – ' + r.awayTeam + ', ' + r.modelName" (click)="mcOpen.toggle(r.predictionId)">
                      <i class="pi" [class.pi-chevron-down]="mcOpen.has(r.predictionId)" [class.pi-chevron-right]="!mcOpen.has(r.predictionId)" aria-hidden="true"></i></button></td>
                    <td class="nowrap hide-sm"><a [routerLink]="['/predictions', r.predictionId]">{{ fmt(r.predictedAt) }}</a></td>
                    <td class="nowrap">{{ r.homeTeam }} – {{ r.awayTeam }}<span class="cell-sub">{{ r.league }}</span></td>
                    <td class="nowrap">{{ r.modelName }} <span class="cell-sub">{{ r.modelVersion }}</span></td>
                    <td>{{ humanize(r.predictionType) }}{{ r.matchMinute !== null ? ' · ' + r.matchMinute + "'" : '' }}</td>
                    <td><mm-score [home]="r.currentHomeScore" [away]="r.currentAwayScore" [muted]="true" /></td>
                    <td class="hide-sm">{{ r.method }}</td>
                    <td class="num hide-sm">{{ r.simulationCount }}</td>
                    <td class="num hide-sm">{{ num(r.expectedHomeGoals) }}</td><td class="num hide-sm">{{ num(r.expectedAwayGoals) }}</td>
                    <td class="num hide-sm">{{ num(r.expectedHomeCorners) }}</td><td class="num hide-sm">{{ num(r.expectedAwayCorners) }}</td>
                    <td><mm-score [home]="r.predictedHomeScore" [away]="r.predictedAwayScore" /></td>
                    <td class="num hide-sm">{{ pct(r.correctScoreProbability) }}</td>
                    <td><mm-score [home]="r.finalHomeScore" [away]="r.finalAwayScore" [muted]="r.matchStatus !== 'FINISHED'" /></td>
                    <td class="num hide-sm">{{ r.actualRemainingGoals ?? '—' }}</td>
                    <td><mm-result [value]="r.topPickResult" /></td>
                  </tr>
                  @if (mcOpen.has(r.predictionId)) {
                    <tr class="expanded" [id]="'sim-' + r.predictionId"><td colspan="17"><div class="expand-box">
                      <div class="grid-3">
                        <div><h3 class="mb-2">Predicted probabilities</h3><mm-json [value]="r.probabilitiesJson" /></div>
                        <div><h3 class="mb-2">Scoreline distribution</h3><mm-json [value]="r.distributionJson" /></div>
                        <dl class="dl"><dt>Seed</dt><dd>{{ r.randomSeed ?? '—' }}</dd><dt>Algorithm</dt><dd>{{ r.algorithmVersion ?? '—' }}</dd>
                          <dt>Final corners</dt><dd>{{ r.finalHomeCorners ?? '—' }}:{{ r.finalAwayCorners ?? '—' }}</dd></dl>
                      </div></div>
                    </td></tr>
                  }
                } @empty {
                  @if (state() === 'ready') { <tr><td colspan="17" class="empty">No prediction with a simulation matches these filters.</td></tr> }
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
  readonly winRateDef = WIN_RATE_DEF;
  readonly roiDef = ROI_DEF;
  readonly headerTitle = headerTitle;
  readonly sampleSize = sampleSize;
  readonly minPicks = CALIBRATION_MIN_PICKS;
  readonly isNum = isNum;
  readonly hideSm = hideSm;
  readonly cell = (r: unknown, c: Col) => cell(r as Record<string, unknown>, c);
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly pct = pct;
  readonly num = num;
  readonly lineText = lineText;
  readonly lineSplit = lineSplit;
  readonly pickText = pickText;
  readonly sideCols = SIDE_COLS;
  readonly units = units;
  readonly typeLabel = TYPE_LABEL;
  readonly typeByOptions = TYPE_BY_OPTIONS;
  readonly topByOptions = TOP_BY_OPTIONS;
  readonly topCols = BREAKDOWN_COLS;
  readonly deltaPoints = deltaPoints;
  readonly deltaClass = deltaClass;
  readonly factorLabel = FACTOR_LABEL;
  readonly factorOptions = FACTOR_OPTIONS;
  readonly minSampleOptions = MIN_SAMPLE_OPTIONS;
  readonly patternFactor = signal<PatternFactor | 'all'>('all');
  readonly patternMinSample = signal(20);

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
  /** What the user picked in "at least N models"; null = the default from coverage. Reset when filters change. */
  private readonly minModelsChoice = signal<number | null>(null);
  readonly comparisonPage = signal(0);
  readonly mcPage = signal(0);
  readonly mcOpen = new Expansion();
  readonly typeBy = signal<TypeCompareBy>('model');
  readonly topBy = signal<TopPickBy>('model');
  readonly topSort = signal<Sort>({ field: 'picks', dir: 'desc' });

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
  private readonly topPickRes = rxResource({
    params: () => {
      const f = this.filters();
      return f && this.tab() === 'toppick' ? { f, by: this.topBy() } : undefined;
    },
    stream: ({ params: { f, by } }) => this.api.topPick(f, by),
  });
  private readonly marketsRes = rxResource({
    params: () => (this.tab() === 'markets' ? this.filters() : undefined),
    stream: ({ params }) => this.api.marketPerformance(params),
  });
  private readonly calibrationRes = rxResource({
    params: () => (this.tab() === 'calibration' ? this.filters() : undefined),
    stream: ({ params }) => this.api.calibration(params),
  });
  private readonly coverageRes = rxResource({
    params: () => (this.tab() === 'comparison' ? this.filters() : undefined),
    stream: ({ params }) => this.api.modelComparisonCoverage(params),
  });
  private readonly coverage = safeValue(this.coverageRes, []);
  /** The user's choice, else the largest N that still has matches (1 when nothing matches or coverage failed). */
  readonly minModels = computed(() =>
    this.minModelsChoice() ?? Math.max(1, ...this.coverage().filter(c => c.matches > 0).map(c => c.minModels)));
  readonly minModelOptions = computed<SelectOption[]>(() => {
    const c = this.coverage();
    return c.length
      ? c.map(x => ({ value: String(x.minModels), label: `${x.minModels} (${x.matches} ${x.matches === 1 ? 'match' : 'matches'})` }))
      : [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n}` }));
  });
  private readonly comparisonRes = rxResource({
    params: () => {
      const f = this.filters();
      // Without a choice, wait for coverage so the first request already uses the default (no request for 2 then N).
      const waiting = this.minModelsChoice() === null && (this.coverageRes.status() === 'idle' || this.coverageRes.isLoading());
      return f && this.tab() === 'comparison' && !waiting ? { f, minModels: this.minModels(), page: this.comparisonPage() } : undefined;
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

  /** Both Pre-match vs Live requests compare the two types, so the prediction type filter is left out of them. */
  private readonly typeFilters = computed(() => { const f = this.filters(); return f && { ...f, type: undefined }; });
  private readonly typeKpiRes = rxResource({
    params: () => (this.tab() === 'typecompare' ? this.typeFilters() : undefined),
    stream: ({ params }) => this.api.breakdown(params, 'type'),
  });
  private readonly typeCompareRes = rxResource({
    params: () => {
      const f = this.typeFilters();
      return f && this.tab() === 'typecompare' ? { f, by: this.typeBy() } : undefined;
    },
    stream: ({ params: { f, by } }) => this.api.typeComparison(f, by),
  });

  private readonly patternsRes = rxResource({
    params: () => {
      const f = this.filters();
      return f && this.tab() === 'patterns' ? { f, minSample: this.patternMinSample() } : undefined;
    },
    stream: ({ params: { f, minSample } }) => this.api.patterns(f, minSample),
  });

  private readonly active = computed(() => ({
    models: this.modelsRes, toppick: this.topPickRes, history: this.historyRes, markets: this.marketsRes, calibration: this.calibrationRes,
    comparison: this.comparisonRes, montecarlo: this.monteCarloRes, typecompare: this.typeCompareRes, patterns: this.patternsRes,
  })[this.tab()]);
  readonly state = computed(() => statusToView(this.active().status()));
  /** Skeleton for a first load with no rows yet, the error box on failure; a reload keeps its rows (the table dims instead). */
  firstLoadState(rows: number): 'loading' | 'error' | 'ready' {
    const s = this.state();
    return s === 'loading' && rows > 0 ? 'ready' : s;
  }
  retry(): void { this.active().reload(); if (this.tab() === 'typecompare') this.typeKpiRes.reload(); }
  readonly error = computed(() => { const e = this.active().error(); return e ? apiError(e).message : ''; });

  // Report 1
  readonly modelRows = safeValue(this.modelsRes, []);
  /** UX-046 footnote: predictions the count policy left out, over all models shown. */
  readonly notCounted = computed(() => this.modelRows().reduce((n, r) => n + (r.notCountedPredictions ?? 0), 0));
  readonly sortedModels = computed(() => sortRows(this.modelRows(), this.modelSort()));
  // Report 2: the table renders in every state, so keep the last rows while loading and never show a failed filter's rows.
  private readonly historyData = keepPrevious(this.historyRes);
  readonly historyRows = computed(() => this.historyData()?.data ?? []);
  readonly historyTotal = computed(() => this.historyData()?.meta.totalElements ?? 0);
  readonly shownHistoryCols = computed(() => { const v = new Set(this.visibleFields()); return HISTORY_COLS.filter(c => v.has(c.field)); });
  // Top pick
  readonly topPick = safeValue(this.topPickRes);
  readonly sortedTop = computed(() => sortRows(this.topPick()?.rows ?? [], this.topSort()));
  readonly topChart = computed(() => {
    const rows = this.topPick()?.rows ?? [];
    return { labels: rows.map(r => r.key), datasets: [{ label: 'Win rate', data: rows.map(r => r.winRate === null ? null : r.winRate * 100), backgroundColor: () => SERIES[0], borderRadius: 4 }] };
  });
  // Report 3
  readonly marketRows = safeValue(this.marketsRes, []);
  readonly sortedMarkets = computed(() => sortRows(this.marketRows(), this.marketSort()));
  readonly marketChart = computed(() => ({
    labels: this.marketRows().map(r => r.market),
    datasets: [{ label: 'Win rate', data: this.marketRows().map(r => r.winRate === null ? null : r.winRate * 100), backgroundColor: () => SERIES[0], borderRadius: 4 }],
  }));
  readonly marketStack = computed(() => ({
    labels: this.marketRows().map(r => r.market),
    datasets: [
      { label: 'Wins incl. ½', data: this.marketRows().map(r => r.wins), backgroundColor: () => RESULT_COLORS['WIN'] },
      { label: 'Losses incl. ½', data: this.marketRows().map(r => r.losses), backgroundColor: () => RESULT_COLORS['LOSS'] },
      { label: 'Push / void', data: this.marketRows().map(r => r.pushOrVoid), backgroundColor: () => RESULT_COLORS['VOID'] },
      { label: 'Pending', data: this.marketRows().map(r => r.pending), backgroundColor: () => RESULT_COLORS['PENDING'] },
    ],
  }));
  readonly marketChartOptions: ChartOptions = {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `Win rate: ${pct(typeof ctx.raw === 'number' ? ctx.raw / 100 : null)}` } } },
    scales: { y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } } },
  };
  readonly stackOptions: ChartOptions = { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } };
  // Calibration (UX-018): one point per non-empty bin, sized by picks, thin bins grey; percent axes like the win rate.
  readonly calibration = safeValue(this.calibrationRes);
  private readonly plottedBins = computed(() => (this.calibration()?.bins ?? [])
    .filter((b): b is CalibrationBin & { avgProbability: number; hitRate: number } => b.avgProbability !== null && b.hitRate !== null));
  readonly calibrationChart = computed(() => {
    const bins = this.plottedBins();
    const most = Math.max(1, ...bins.map(b => b.picks));
    const thin = (b: CalibrationBin | undefined) => b !== undefined && b.picks < CALIBRATION_MIN_PICKS;
    return {
      datasets: [
        { label: 'Bins', data: bins.map(b => ({ x: b.avgProbability * 100, y: b.hitRate * 100 })),
          pointRadius: bins.map(b => 4 + 12 * Math.sqrt(b.picks / most)),
          // Thin bins are hollow (shape, not only colour); the reference line is a dashed rule in the text colour.
          backgroundColor: (ctx: { dataIndex: number }) => thin(bins[ctx.dataIndex]) ? 'transparent' : SERIES[0],
          borderColor: (ctx: { dataIndex: number }) => thin(bins[ctx.dataIndex]) ? RESULT_COLORS['VOID'] : SERIES[0],
          borderWidth: bins.map(b => thin(b) ? 2 : 1) },
        { label: 'Perfect calibration', data: [{ x: 0, y: 0 }, { x: 100, y: 100 }], showLine: true, pointRadius: 0,
          borderColor: () => String(Chart.defaults.color), borderDash: [6, 4], borderWidth: 1.5 },
      ],
    };
  });
  readonly calibrationOptions: ChartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: ctx => {
        const b = this.plottedBins()[ctx.dataIndex];
        return b ? `${pct(b.from, 0)}–${pct(b.to, 0)}: stated ${pct(b.avgProbability)}, hit ${pct(b.hitRate)} (${b.picks} picks)` : '';
      } } },
    },
    scales: {
      x: { min: 0, max: 100, title: { display: true, text: 'Average stated probability' }, ticks: { callback: v => `${v}%` } },
      y: { min: 0, max: 100, title: { display: true, text: 'Hit rate' }, ticks: { callback: v => `${v}%` } },
    },
  };
  // Report 4
  private readonly comparisonData = safeValue(this.comparisonRes);
  readonly comparison = computed(() => this.comparisonData()?.data ?? []);
  readonly comparisonTotal = computed(() => this.comparisonData()?.meta.totalElements ?? 0);
  // Report 5
  readonly monteCarlo = keepPrevious(this.monteCarloRes);
  // Report 6: pre-match vs live
  readonly typeRows = safeValue(this.typeCompareRes, []);
  private readonly typeKpiRows = safeValue(this.typeKpiRes, []);
  readonly typeKpiError = computed(() => { const e = this.typeKpiRes.error(); return e ? apiError(e).message : ''; });
  readonly typeKpis = computed<{ type: string; row: PerformanceCounts | undefined }[]>(
    () => ['PRE_MATCH', 'LIVE'].map(type => ({ type, row: this.typeKpiRows().find(r => r.key === type) })));
  // Report 7: win/loss patterns
  readonly patterns = keepPrevious(this.patternsRes);
  private readonly flagged = (signal: PatternRow['signal']) => (this.patterns()?.rows ?? []).filter(r => r.signal === signal);
  /** Worst first: a flagged row always has a z. */
  readonly patternWarnings = computed(() => this.flagged('WARNING').sort((a, b) => a.z! - b.z!));
  readonly patternStrengths = computed(() => this.flagged('STRENGTH').sort((a, b) => b.z! - a.z!));
  readonly patternLists = computed(() => [
    { label: 'Watch out', rows: this.patternWarnings(), empty: 'Nothing is significantly worse than overall with these filters.' },
    { label: 'Strengths', rows: this.patternStrengths(), empty: 'Nothing is significantly better than overall with these filters.' },
  ]);
  readonly patternRows = computed(() => {
    const f = this.patternFactor();
    return (this.patterns()?.rows ?? []).filter(r => f === 'all' || r.factor === f);
  });

  onFilters(f: Filters): void {
    this.historyPage.set(0);
    this.comparisonPage.set(0);
    this.minModelsChoice.set(null);
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
  setMinModels(value: string): void { this.minModelsChoice.set(Number(value)); this.comparisonPage.set(0); }

  isVisible(field: string): boolean { return this.visibleFields().includes(field); }

  toggleVisible(field: string): void {
    if (this.isVisible(field) && this.visibleFields().length === 1) return;   // the table keeps at least one column
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
    const fields = HISTORY_COLS.map(c => c.field);
    try {
      const hidden: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? 'null');
      if (Array.isArray(hidden)) {
        const shown = fields.filter(f => !hidden.includes(f));
        if (shown.length) return shown;
      }
    } catch { /* default */ }
    return fields.filter(f => !HISTORY_DEFAULT_HIDDEN.has(f));
  }
}
