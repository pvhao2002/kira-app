import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartOptions } from 'chart.js';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AiModel } from '../core/models';
import { PageTitle } from '../core/page-title';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { ChartView, SERIES } from '../shared/chart';
import { APP_LOCALE, ROI_DEF, bidiSafe, fmtDateTime, humanize, lineSplit, pct, pickText, units } from '../shared/format';
import { Select, SelectOption } from '../shared/select';
import { ReasonAction, ReasonDialog, ResultTag, ScoreChip, SmallSample, StateView } from '../shared/ui';

/** "3 Nov": the chart's x labels (the API sends YYYY-MM-DD). */
const DAY_LABEL = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short' });

@Component({
  selector: 'mm-model-detail',
  imports: [FormsModule, RouterLink, ChartView, ResultTag, ScoreChip, SmallSample, StateView, ReasonDialog, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    h2, .sub { overflow-wrap: anywhere; min-width: 0; }
    .panel > header > div:first-child { min-width: 0; }
    .kpi mm-small-sample { display: block; margin-top: .25rem; width: fit-content; }
    .chart-box > .skeleton { height: 100%; }
  `],
  template: `
    <div class="stack">
      <a routerLink="/models" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i> AI models</a>
      <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      @if (model(); as m) {
        <section class="panel">
          <header><div><h2>{{ bidi(label(m)) }} <span class="muted-text">{{ m.version }}</span>
              @if (m.archivedAt) { <span class="tag tag-secondary">Archived</span> }</h2>
            <p class="muted-text sub">{{ bidi(m.providerName) }}, first seen {{ fmt(m.createdAt) }}@if (label(m) !== m.name) { · key <code>{{ bidi(m.name) }}</code> }</p>
            @if (m.mergedIntoId) { <p class="sub" data-testid="merged-into">Merged into <a [routerLink]="['/models', m.mergedIntoId]">{{ nameOf(m.mergedIntoId) }}</a>: its predictions count there.</p> }</div>
            <div class="row">
              @if (auth.isAdmin()) {
                <button type="button" class="btn btn-text btn-sm" data-testid="rename" (click)="openRename(m)">Rename</button>
                @if (m.mergedIntoId) { <button type="button" class="btn btn-text btn-sm" data-testid="unmerge" (click)="openUnmerge(m)">Unmerge</button> }
                @else { <button type="button" class="btn btn-text btn-sm" data-testid="merge" (click)="openMerge(m)">Merge into…</button> }
                <button type="button" class="btn btn-text btn-sm" data-testid="archive" [class.danger]="!m.archivedAt" (click)="openArchive(m)">{{ m.archivedAt ? 'Unarchive' : 'Archive' }}</button>
              }
            </div></header>
          @if (m.description) { <p class="page-note mb-2">{{ m.description }}</p> }
          <div class="kpis">
            <div class="kpi accent"><span>Win rate</span><strong>{{ pct(m.winRate) }}</strong>
              <mm-small-sample [n]="m.wins + m.losses" /></div>
            <div class="kpi" [title]="roiDef"><span>Units</span><strong data-testid="model-units">{{ units(m.units) }}</strong></div>
            <div class="kpi" [title]="roiDef"><span>ROI</span><strong data-testid="model-roi">{{ pct(m.roi) }}</strong>
              <mm-small-sample [n]="m.staked" /></div>
            <div class="kpi"><span>Predictions</span><strong>{{ m.totalPredictions }}</strong></div>
            <div class="kpi"><span>Settled picks</span><strong>{{ m.settledPicks }}</strong></div>
            <div class="kpi"><span>Wins / losses</span><strong><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></strong></div>
            <div class="kpi"><span>Pending</span><strong class="pending">{{ m.pendingPicks }}</strong></div>
          </div>
          <p class="page-note mt-2" data-testid="definitions">Win rate: (win + half win) divided by settled picks; push and void are left out. {{ roiDef }}</p>
        </section>
        <section class="panel">
          <header><h2>Win rate over time</h2><span class="muted-text">Daily, settled picks only</span></header>
          @if (dashboardRes.error()) {
            <div class="alert alert-warn" role="alert" data-testid="trend-error"><span>Couldn't load the trend.</span>
              <button type="button" class="btn btn-outline btn-sm" (click)="dashboardRes.reload()">Retry</button></div>
          } @else if (!dashboardRes.hasValue()) {
            <div class="chart-box" role="status" data-testid="trend-loading"><span class="sr-only">Loading…</span><div class="skeleton" aria-hidden="true"></div></div>
          } @else if (trend(); as t) { <mm-chart type="line" [data]="t" [options]="pctOptions" label="Win rate of this model over time" /> }
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
          <header><h2>Latest predictions</h2><a data-testid="view-all" routerLink="/predictions" [queryParams]="{ modelId: m.id }">View all {{ m.totalPredictions }} predictions</a></header>
          <div class="table-wrap"><table class="dt compact-sm" aria-label="Latest predictions of this model">
            <thead><tr><th class="hide-sm">Predicted</th><th>Match</th><th class="hide-sm">Type</th><th class="hide-sm">Predicted score</th><th>Top pick</th><th class="num hide-sm">Prob.</th><th class="hide-sm">Final</th><th class="sticky-end">Result</th></tr></thead>
            <tbody>
              @for (p of recent(); track p.id) {
              <tr class="clickable" [routerLink]="['/predictions', p.id]" tabindex="-1">
                <td class="nowrap hide-sm"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td><td><span class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam">{{ p.homeTeam }} – {{ p.awayTeam }}</span><span class="cell-sub">{{ p.league }}</span><a class="cell-sub show-sm" [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
                <td class="hide-sm">{{ humanize(p.predictionType) }}</td><td class="hide-sm"><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td>
                <td class="nowrap" data-testid="recent-pick" [title]="lineSplit(p.topPickMarket, p.topPickLine)">{{ pickText(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}</td><td class="num hide-sm">{{ pct(p.topPickProbability) }}</td>
                <td class="hide-sm"><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="p.matchStatus !== 'FINISHED'" /></td><td class="sticky-end"><mm-result [value]="p.settlementStatus" /></td>
              </tr>
              } @empty { <tr><td colspan="8" class="empty">This model has no predictions yet.</td></tr> }
            </tbody>
          </table></div>
        </section>
      }
    </div>
    <mm-reason-dialog [action]="action()" [ready]="kind() !== 'merge' || !!target()" (closed)="action.set(null)">
      @if (kind() === 'rename') {
        <div class="field"><label for="md-name">Display name</label>
          <input class="input w-full" id="md-name" maxlength="128" [value]="newName()" (input)="newName.set($any($event.target).value)" aria-describedby="md-name-hint" />
          <small id="md-name-hint" class="muted-text">Leave empty to show the name the agent sends.</small></div>
      } @else if (kind() === 'merge') {
        <div class="field"><label for="md-target">Merge into</label>
          <mm-select id="md-target" class="w-full" data-testid="merge-target" [ngModel]="target()" (ngModelChange)="target.set($event)" [ngModelOptions]="{ standalone: true }"
            placeholder="Choose a model of this provider" [options]="targetOptions()" [loading]="loadingTargets()" emptyText="No other model of this provider can be a target." /></div>
      }
    </mm-reason-dialog>`,
})
export class ModelDetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  protected readonly resource = this.api.modelOverviewResource(() => this.id());
  private readonly overview = safeValue(this.resource);
  /** Daily win rate of this model (dashboard API filtered by model); a failure only hides the chart. */
  protected readonly dashboardRes = this.api.dashboardResource(() => ({ modelId: this.id() }), Intl.DateTimeFormat().resolvedOptions().timeZone);
  private readonly dashboard = safeValue(this.dashboardRes);
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly model = computed(() => this.overview()?.model);
  readonly auth = inject(AuthService);
  /** Same-provider models (archived and merged too): merge targets and the merge target's name. */
  private readonly siblingsRes = rxResource({
    params: () => { const m = this.model(); return m && (this.auth.isAdmin() || m.mergedIntoId) ? m.providerId : undefined; },
    stream: ({ params }) => this.api.models({ providerId: params, includeArchived: true }),
  });
  private readonly siblings = safeValue(this.siblingsRes, []);
  /** A merge target must not itself be merged (the database rejects chains). */
  readonly mergeTargets = computed(() => this.siblings().filter(o => o.id !== this.id() && !o.mergedIntoId));
  readonly targetOptions = computed<SelectOption[]>(() => this.mergeTargets().map(o => ({ value: o.id, label: `${this.label(o)} ${o.version}` })));
  readonly loadingTargets = computed(() => this.siblingsRes.isLoading());
  readonly action = signal<ReasonAction | null>(null);
  readonly kind = signal<'rename' | 'merge' | null>(null);
  readonly newName = signal('');
  readonly target = signal('');
  readonly breakdowns = computed(() => {
    const o = this.overview();
    return o ? [{ title: 'market', rows: o.market }, { title: 'prediction type', rows: o.type }] : [];
  });
  readonly recent = computed(() => this.overview()?.recent.data ?? []);
  /** Days with settled picks only; fewer than two is no trend. */
  readonly trend = computed(() => {
    const days = (this.dashboard()?.winRateOverTime ?? []).filter(d => d.settled > 0 && d.winRate !== null);
    return days.length < 2 ? null : {
      labels: days.map(d => DAY_LABEL.format(new Date(`${d.day}T12:00:00`))),
      // Scriptable colours: Chart.js re-reads them on every update, so a light/dark switch recolours the line.
      datasets: [{ label: 'Win rate', data: days.map(d => Math.round(d.winRate! * 1000) / 10), borderColor: () => SERIES[0],
        backgroundColor: () => `color-mix(in srgb, ${SERIES[0]} 14%, transparent)`, fill: true, tension: .25, pointRadius: days.length < 3 ? 5 : 2 }],
    };
  });
  readonly pctOptions: ChartOptions = {
    maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } } },
  };
  readonly units = units;
  readonly roiDef = ROI_DEF;
  readonly fmt = fmtDateTime;
  readonly pct = pct;
  readonly humanize = humanize;
  readonly pickText = pickText;
  readonly lineSplit = lineSplit;
  readonly bidi = bidiSafe;
  readonly label = (m: AiModel) => m.displayName ?? m.name;

  constructor() {
    const title = inject(PageTitle);
    effect(() => { const m = this.model(); if (m) title.set(`${bidiSafe(this.label(m))} ${bidiSafe(m.version)}`); });
  }

  nameOf(id: string): string {
    const t = this.siblings().find(o => o.id === id);
    return t ? `${this.label(t)} ${t.version}` : 'another model';
  }

  private open(kind: 'rename' | 'merge' | null, a: Omit<ReasonAction, 'done'>): void {
    this.kind.set(kind);
    this.action.set({ ...a, done: () => { this.resource.reload(); this.siblingsRes.reload(); } });
  }

  openRename(m: AiModel): void {
    this.newName.set(m.displayName && m.displayName !== m.name ? m.displayName : '');
    this.open('rename', { header: 'Rename model', label: 'Save', run: reason => this.api.renameModel(m.id, this.newName().trim(), reason) });
  }

  openMerge(m: AiModel): void {
    this.target.set('');
    this.open('merge', {
      header: `Merge ${this.label(m)} into…`, label: 'Merge',
      message: 'Its predictions count for the target, and new predictions under this name go there too. Nothing is rewritten; Unmerge undoes it, but predictions received while merged stay on the target.',
      run: reason => this.api.mergeModel(m.id, this.target(), reason),
    });
  }

  openUnmerge(m: AiModel): void {
    this.open(null, { header: `Unmerge ${this.label(m)}`, label: 'Unmerge', message: 'Its own predictions count for it again.',
      run: reason => this.api.unmergeModel(m.id, reason) });
  }

  openArchive(m: AiModel): void {
    const archived = !m.archivedAt;
    this.open(null, {
      header: `${archived ? 'Archive' : 'Unarchive'} ${this.label(m)}`, label: archived ? 'Archive' : 'Unarchive', danger: archived,
      message: archived ? 'It leaves every list, dropdown and figure. Nothing is deleted, and its callbacks are still accepted.' : 'It counts again.',
      run: reason => this.api.setArchived('models', m.id, archived, reason),
    });
  }
}
