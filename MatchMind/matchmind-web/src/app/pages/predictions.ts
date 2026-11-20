import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { LiveService } from '../core/live.service';
import { Filters, PredictionRow } from '../core/models';
import { BarFilters, FilterBar } from '../shared/filter-bar';
import { fmtDateTime, humanize, num, pct, pickLabel } from '../shared/format';
import { Paginator, SortHeader } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { ResultTag, ScoreChip } from '../shared/ui';

/** Columns a user can show or hide; the rest (match, model, pick, result) always show. */
const OPTIONAL_COLS = [
  { field: 'probability', header: 'Prob.' }, { field: 'price', header: 'Price' }, { field: 'predictedScore', header: 'Predicted score' },
  { field: 'final', header: 'Final' }, { field: 'type', header: 'Type' }, { field: 'minute', header: 'Min' },
  { field: 'atCapture', header: 'At capture' }, { field: 'csProb', header: 'CS prob.' }, { field: 'picks', header: 'Picks' },
];
/** UX-011: secondary columns start hidden so Result and Picks fit a 1440px screen. */
const HIDDEN_BY_DEFAULT = ['minute', 'atCapture', 'csProb'];
const COLS_KEY = 'matchmind.predictions.columns';

/** "2 Win · 1 Loss · 1 Pending": every pick of the prediction, not just the top one. */
export function pickSummary(p: PredictionRow): string {
  return ([[p.pickWins, 'Win'], [p.pickHalfWins, 'Half win'], [p.pickLosses, 'Loss'], [p.pickHalfLosses, 'Half loss'],
    [p.pickPushOrVoid, 'Push/void'], [p.pickPending, 'Pending']] as const)
    .filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(' · ');
}

@Component({
  selector: 'mm-predictions',
  imports: [RouterLink, FilterBar, SortHeader, Paginator, ScoreChip, ResultTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <mm-filter-bar [fields]="['search', 'dates', 'league', 'model', 'type', 'market', 'result', 'resultScope']" (changed)="onFilters($event)" />
      <section class="panel flush">
        <div class="toolbar">
          <details class="menu">
            <summary class="btn btn-sm"><i class="pi pi-table"></i> Columns ({{ shownCount() }}/{{ cols.length }})</summary>
            <div class="menu-body" role="group" aria-label="Visible columns">
              @for (c of cols; track c.field) {
                <label class="check"><input type="checkbox" [checked]="show(c.field)" (change)="toggle(c.field)" /> {{ c.header }}</label>
              }
            </div>
          </details>
          <span class="muted-text units">One row per prediction · {{ pagePicks() }} picks on this page · Result is the top pick's</span>
          @if (newCount() && list.page() > 0) {
            <button type="button" class="btn btn-outline btn-sm" data-testid="new-predictions" (click)="showNew()">
              <i class="pi pi-refresh"></i> {{ newCount() }} new — refresh</button>
          }
        </div>
        <div class="table-wrap tall">
        <table class="dt compact-sm cards" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
          <thead>
            <tr>
              <th class="hide-sm" mmSort="predictedAt" [sort]="list.sort()" (sortChange)="list.setSort($event)">Predicted at</th>
              <th mmSort="startTime" [sort]="list.sort()" (sortChange)="list.setSort($event)">Match</th>
              <th class="hide-sm" mmSort="model" [sort]="list.sort()" (sortChange)="list.setSort($event)">Model</th>
              <th>Top pick</th>
              @if (show('probability')) { <th class="num hide-sm" mmSort="probability" [sort]="list.sort()" (sortChange)="list.setSort($event)">Prob.</th> }
              @if (show('price')) { <th class="num hide-sm">Price</th> }
              @if (show('predictedScore')) { <th class="hide-sm">Predicted score</th> }
              @if (show('final')) { <th class="hide-sm">Final</th> }
              <th class="sticky-end" title="Result of the top-ranked pick. The Picks column counts every pick.">Top pick result</th>
              @if (show('type')) { <th class="hide-sm" mmSort="type" [sort]="list.sort()" (sortChange)="list.setSort($event)">Type</th> }
              @if (show('minute')) { <th class="num hide-sm" mmSort="minute" [sort]="list.sort()" (sortChange)="list.setSort($event)">Min</th> }
              @if (show('atCapture')) { <th class="hide-sm">At capture</th> }
              @if (show('csProb')) { <th class="num hide-sm">CS prob.</th> }
              @if (show('picks')) { <th class="hide-sm">Picks</th> }
            </tr>
          </thead>
          <tbody>
            @for (p of list.rows(); track p.id) {
            <tr class="clickable" [routerLink]="['/predictions', p.id]">
              <td class="nowrap hide-sm"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
              <td><span class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam">{{ p.homeTeam }} – {{ p.awayTeam }}</span><span class="cell-sub">{{ p.league }}</span><a class="cell-sub show-sm" [routerLink]="['/predictions', p.id]">{{ p.modelName }} · {{ fmt(p.predictedAt) }}</a></td>
              <td class="nowrap hide-sm">{{ p.modelName }} <span class="cell-sub">{{ p.modelVersion }}</span></td>
              <td class="nowrap">{{ pickLabel(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}<span class="cell-sub">{{ humanize(p.topPickStage) }}</span></td>
              @if (show('probability')) { <td class="num hide-sm">{{ pct(p.topPickProbability) }}</td> }
              @if (show('price')) { <td class="num hide-sm">{{ num(p.topPickPrice) }}</td> }
              @if (show('predictedScore')) { <td class="hide-sm"><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td> }
              @if (show('final')) { <td class="hide-sm"><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="p.matchStatus !== 'FINISHED'" /></td> }
              <td class="sticky-end"><mm-result [value]="p.settlementStatus" /></td>
              @if (show('type')) { <td class="hide-sm">{{ humanize(p.predictionType) }}</td> }
              @if (show('minute')) { <td class="num hide-sm">{{ p.matchMinute ?? '—' }}</td> }
              @if (show('atCapture')) { <td class="hide-sm"><mm-score [home]="p.currentHomeScore" [away]="p.currentAwayScore" [muted]="true" /></td> }
              @if (show('csProb')) { <td class="num hide-sm">{{ pct(p.correctScoreProbability) }}</td> }
              @if (show('picks')) { <td class="hide-sm nowrap" [title]="summary(p)">{{ p.pickCount }}<span class="cell-sub">{{ summary(p) }}</span></td> }
            </tr>
            } @empty {
              <tr><td [attr.colspan]="4 + 1 + shownCount()" class="empty">
                @if (list.loading()) { Loading… }
                @else if (list.error()) {
                  <div class="empty-state" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i><strong>Couldn't load predictions</strong><span>{{ list.error() }}</span>
                    <button type="button" class="btn btn-outline btn-sm" data-testid="retry" (click)="list.load()"><i class="pi pi-refresh"></i> Retry</button></div>
                }
                @else { No predictions match these filters. }
              </td></tr>
            }
          </tbody>
        </table>
        </div>
        @if (!list.error()) {
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" unit="predictions" (change)="list.setPage($event)" />
        }
      </section>
    </div>`,
  styles: `
    .toolbar { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; padding: .45rem .75rem; border-bottom: 1px solid var(--mm-line); }
    .units { font-size: .8rem; }
    @media (max-height: 500px) { .table-wrap.tall { max-height: none; } }
    /* UX-011: under 600px each prediction is a card (match + result, then the pick); no sideways scrolling. */
    @media (max-width: 600px) {
      table.cards thead { display: none; }
      table.cards tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .2rem .75rem; padding: .6rem .75rem; border-bottom: 1px solid var(--mm-line); }
      table.cards tbody td { border: 0; padding: 0; white-space: normal; }
      table.cards tbody td.sticky-end { position: static; box-shadow: none; grid-column: 2; grid-row: 1; background: none; }
      table.cards tbody td.empty { grid-column: 1 / -1; }
    }`,
})
export class PredictionsPage {
  private readonly api = inject(ApiService);
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly pct = pct;
  readonly num = num;
  readonly pickLabel = pickLabel;
  readonly summary = pickSummary;
  readonly cols = OPTIONAL_COLS;
  private filters: Filters = {};
  private resultScope: 'TOP' | 'ANY' | undefined;

  readonly list = new PagedList<PredictionRow>(paging => this.api.predictions(this.filters, paging, this.resultScope), { field: 'predictedAt', dir: 'desc' });

  private readonly visible = signal<string[]>(this.restoreVisible());
  readonly shownCount = computed(() => this.visible().length);
  readonly pagePicks = computed(() => this.list.rows().reduce((n, p) => n + p.pickCount, 0));
  /** Predictions announced while the user is on a later page; the rows are not reloaded under them (UX-071). */
  readonly newCount = signal(0);

  constructor() {
    const live = inject(LiveService);
    live.predictions.pipe(takeUntilDestroyed()).subscribe(() => { if (this.list.page() > 0) this.newCount.update(n => n + 1); });
    // Page 1 refreshes in place; on later pages new rows would shift what the user is looking at, so only offer it.
    live.refresh.pipe(takeUntilDestroyed()).subscribe(() => { if (this.list.page() === 0) this.list.load(); });
  }

  show(field: string): boolean { return this.visible().includes(field); }

  toggle(field: string): void {
    this.visible.update(v => v.includes(field) ? v.filter(f => f !== field) : [...v, field]);
    try { localStorage.setItem(COLS_KEY, JSON.stringify(this.visible())); } catch { /* storage off: the choice lasts this visit */ }
  }

  showNew(): void { this.newCount.set(0); this.list.load(); }

  private first = true;

  onFilters({ resultScope, ...f }: BarFilters): void {
    this.filters = f;
    this.resultScope = resultScope;
    this.newCount.set(0);
    // The filter bar reports once on init: keep the page and sort from the URL then, start over on later changes.
    if (this.first) { this.first = false; this.list.load(); } else this.list.reload();
  }

  private restoreVisible(): string[] {
    try {
      const saved = JSON.parse(localStorage.getItem(COLS_KEY) ?? 'null');
      if (Array.isArray(saved)) return saved.filter(f => OPTIONAL_COLS.some(c => c.field === f));
    } catch { /* unreadable or blocked storage: defaults */ }
    return OPTIONAL_COLS.map(c => c.field).filter(f => !HIDDEN_BY_DEFAULT.includes(f));
  }
}
