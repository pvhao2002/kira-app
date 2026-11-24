import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { LiveService } from '../core/live.service';
import { Filters, OddsSnapshot, PickDetail, PredictionRow } from '../core/models';
import { BarFilters, FilterBar } from '../shared/filter-bar';
import { dayEndExclusive, dayStart, fmtDateTime, humanize, lineSplit, lineText, num, pct, pickText } from '../shared/format';
import { Paginator, SortHeader } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { DetailsMenu, ResultTag, ScoreChip, StateView } from '../shared/ui';

/** Columns a user can show or hide; the rest (match, model, pick, result) always show. */
const OPTIONAL_COLS = [
  { field: 'probability', header: 'Prob.' }, { field: 'price', header: 'Price' }, { field: 'predictedScore', header: 'Predicted score' },
  { field: 'final', header: 'Final' }, { field: 'type', header: 'Type' }, { field: 'minute', header: 'Min' },
  { field: 'atCapture', header: 'At capture' }, { field: 'csProb', header: 'CS prob.' }, { field: 'picks', header: 'Picks' },
];
/** UX-011: secondary columns start hidden so Result and Picks fit a 1440px screen. */
const HIDDEN_BY_DEFAULT = ['minute', 'atCapture', 'csProb'];
const COLS_KEY = 'matchmind.predictions.columns';

/** A match kicked off this long ago may still be on: the default list keeps it. */
const LIVE_WINDOW_MS = 2 * 3_600_000;

/** "2 Win · 1 Loss · 1 Pending": every pick of the prediction, not just the top one. */
export function pickSummary(p: PredictionRow): string {
  return ([[p.pickWins, 'Win'], [p.pickHalfWins, 'Half win'], [p.pickLosses, 'Loss'], [p.pickHalfLosses, 'Half loss'],
    [p.pickPushOrVoid, 'Push/void'], [p.pickPending, 'Pending']] as const)
    .filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(' · ');
}

@Component({
  selector: 'mm-predictions',
  imports: [RouterLink, FilterBar, SortHeader, Paginator, ScoreChip, ResultTag, StateView, DetailsMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (matchId(); as match) {
        <p class="page-note">Showing prediction history for <a [routerLink]="['/matches', match]">this match</a>.</p>
      }
      <mm-filter-bar [fields]="['search', 'dates', 'league', 'model', 'type', 'market', 'result', 'resultScope']" [initialDays]="1" [daysAhead]="1" (changed)="onFilters($event)" />
      <section class="panel flush">
        <div class="toolbar">
          <details class="menu">
            <summary class="btn btn-sm"><i class="pi pi-table" aria-hidden="true"></i> Columns ({{ shownCount() }}/{{ cols.length }})</summary>
            <div class="menu-body" role="group" aria-label="Visible columns">
              @for (c of cols; track c.field) {
                <label class="check"><input type="checkbox" [checked]="show(c.field)" (change)="toggle(c.field)" /> {{ c.header }}</label>
              }
            </div>
          </details>
          <span class="muted-text units">One row per prediction · {{ pagePicks() }} picks on this page · Result is the top pick's; Picks counts every pick</span>
          @if (newCount() && list.page() > 0) {
            <button type="button" class="btn btn-outline btn-sm" data-testid="new-predictions" (click)="showNew()">
              <i class="pi pi-refresh" aria-hidden="true"></i> {{ newCount() }} new — refresh</button>
          }
        </div>
        <div class="table-wrap tall">
        <table class="dt compact-sm cards" aria-label="Predictions" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
          <thead>
            <tr>
              <th class="hide-sm" mmSort="predictedAt" [sort]="list.sort()" (sortChange)="list.setSort($event)">Predicted at</th>
              <th mmSort="startTime" [sort]="list.sort()" (sortChange)="list.setSort($event)">Match</th>
              @if (isAdmin()) { <th class="hide-sm" mmSort="model" [sort]="list.sort()" (sortChange)="list.setSort($event)">Model</th> }
              <th>Top pick</th>
              @if (show('probability')) { <th class="num hide-sm" mmSort="probability" [sort]="list.sort()" (sortChange)="list.setSort($event)">Prob.</th> }
              @if (show('price')) { <th class="num hide-sm">Price</th> }
              @if (show('predictedScore')) { <th class="hide-sm">Predicted score</th> }
              @if (show('final')) { <th class="hide-sm">Final</th> }
              @if (show('type')) { <th class="hide-sm" mmSort="type" [sort]="list.sort()" (sortChange)="list.setSort($event)">Type</th> }
              @if (show('minute')) { <th class="num hide-sm" mmSort="minute" [sort]="list.sort()" (sortChange)="list.setSort($event)">Min</th> }
              @if (show('atCapture')) { <th class="hide-sm">At capture</th> }
              @if (show('csProb')) { <th class="num hide-sm">CS prob.</th> }
              @if (show('picks')) { <th class="hide-sm">Picks</th> }
              <th class="sticky-end">Top pick result</th>
            </tr>
          </thead>
          <tbody>
            @for (p of list.rows(); track p.id) {
            <tr class="clickable" tabindex="-1" [routerLink]="['/predictions', p.id]" (mouseenter)="peek(p.id, $event)" (mouseleave)="unpeek()">
              <td class="nowrap hide-sm"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
              <td>@if (p.matchStatus === 'LIVE') { <span class="tag tag-danger" data-testid="live">Live</span> }<span class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam">{{ p.homeTeam }} – {{ p.awayTeam }}</span><span class="cell-sub">{{ p.league }} · <span data-testid="kickoff" title="Kick-off">{{ fmt(p.startTime) }}</span></span><a class="cell-sub show-sm" [routerLink]="['/predictions', p.id]">@if (isAdmin()) { {{ p.modelName }} · }{{ fmt(p.predictedAt) }}</a>
                @if (p.counted === false) { <span class="tag tag-secondary" title="A later prediction of the same match, model, type and minute replaces it in reports">not counted</span><span class="sr-only"> (a later prediction of the same match, model, type and minute replaces it in reports)</span> }</td>
              @if (isAdmin()) { <td class="nowrap hide-sm">{{ p.modelName }} <span class="cell-sub">{{ p.modelVersion }}</span></td> }
              <td class="nowrap" data-testid="top-pick" [title]="lineSplit(p.topPickMarket, p.topPickLine)">{{ pickText(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}<span class="cell-sub">{{ humanize(p.topPickStage) }}</span></td>
              @if (show('probability')) { <td class="num hide-sm">{{ pct(p.topPickProbability) }}</td> }
              @if (show('price')) { <td class="num hide-sm">{{ num(p.topPickPrice) }}</td> }
              @if (show('predictedScore')) { <td class="hide-sm"><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td> }
              @if (show('final')) { <td class="hide-sm"><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="p.matchStatus !== 'FINISHED'" /></td> }
              @if (show('type')) { <td class="hide-sm">{{ humanize(p.predictionType) }}</td> }
              @if (show('minute')) { <td class="num hide-sm">{{ p.matchMinute ?? '—' }}</td> }
              @if (show('atCapture')) { <td class="hide-sm"><mm-score [home]="p.currentHomeScore" [away]="p.currentAwayScore" [muted]="true" /></td> }
              @if (show('csProb')) { <td class="num hide-sm">{{ pct(p.correctScoreProbability) }}</td> }
              @if (show('picks')) { <td class="hide-sm nowrap">{{ p.pickCount }}<span class="cell-sub">{{ summary(p) }}</span></td> }
              <td class="sticky-end"><mm-result [value]="p.settlementStatus" /></td>
            </tr>
            } @empty {
              <tr><td [attr.colspan]="(isAdmin() ? 5 : 4) + shownCount()" class="empty">
                @if (list.loading()) { <mm-state state="loading" [rows]="6" /> }
                @else if (list.error()) {
                  <div class="empty-state" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i><strong>Couldn't load predictions</strong><span>{{ list.error() }}</span>
                    <button type="button" class="btn btn-outline btn-sm" data-testid="retry" (click)="list.load()"><i class="pi pi-refresh"></i> Retry</button></div>
                }
                @else {
                  <div class="empty-state"><i class="pi pi-filter-slash" aria-hidden="true"></i><strong>No predictions match these filters</strong><span>Widen the dates or reset the filters.</span></div>
                }
              </td></tr>
            }
          </tbody>
        </table>
        </div>
        @if (!list.error()) {
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" unit="predictions" (pageChange)="list.setPage($event)" />
        }
      </section>
      @if (peeked(); as h) {
        <div class="odds-pop" role="tooltip" data-testid="odds-pop" [style.left.px]="h.left" [style.top.px]="h.top" [class.above]="h.above">
          @if (peekDetail.value(); as d) {
            <div class="pop-body">
            <table class="dt compact-sm" aria-label="Odds">
              <thead><tr><th>Market</th><th>Stage</th><th class="num">Line</th><th class="num">Prices</th></tr></thead>
              <tbody>@for (o of d.odds; track o.id) {
                <tr><td>{{ o.market }}</td><td>{{ humanize(o.stage) }}</td><td class="num">{{ lineText(o.market, o.line, o.lineDisplay) }}</td><td class="num nowrap">{{ prices(o) }}</td></tr>
              } @empty { <tr><td colspan="4" class="empty">No odds were sent with this prediction.</td></tr> }</tbody>
            </table>
            <ol class="pop-picks" aria-label="Picks" data-testid="pop-picks">
              @for (k of topPicks(d.picks); track k.id) {
                <li><span class="rank">#{{ k.rank }}</span><span><strong>{{ pickText(k.market, k.pick, k.line) }}</strong>
                  <span class="cell-sub">{{ pct(k.probability) }} · {{ num(k.price) }}</span></span><mm-result [value]="k.settlementStatus" /></li>
              } @empty { <li class="muted-text">No picks.</li> }
            </ol>
            </div>
          } @else if (peekDetail.error()) { <span>Couldn't load the odds.</span> }
          @else { <span><i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Loading odds…</span> }
        </div>
      }
    </div>`,
  styles: `
    /* Hover popover with the prediction's odds; mouse only (touch opens the detail page instead). */
    .pop-body { display: flex; gap: .75rem; align-items: flex-start; }
    .pop-picks { list-style: none; margin: 0; padding: 0 0 0 .75rem; border-left: 1px solid var(--mm-line); display: grid; gap: .5rem; min-width: 180px; }
    .pop-picks li { display: grid; grid-template-columns: auto 1fr auto; gap: .4rem; align-items: center; }
    .pop-picks .rank { font-weight: 700; color: var(--mm-ink-2); }
    .odds-pop { position: fixed; z-index: 50; pointer-events: none; max-width: min(680px, calc(100vw - 16px)); max-height: 50vh; overflow: hidden;
      padding: .5rem; background: var(--mm-card); border: 1px solid var(--mm-glass-border); border-radius: var(--mm-radius);
      box-shadow: var(--mm-shadow); backdrop-filter: var(--mm-blur); -webkit-backdrop-filter: var(--mm-blur); font-size: var(--fs-sm); }
    .odds-pop.above { transform: translateY(-100%); }
    @media (hover: none) { .odds-pop { display: none; } }
    .toolbar { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; padding: .45rem .75rem; border-bottom: 1px solid var(--mm-line); }
    .units { font-size: var(--fs-sm); }
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
  private readonly route = inject(ActivatedRoute);
  readonly isAdmin = inject(AuthService).isAdmin;
  readonly matchId = signal(this.route.snapshot.queryParamMap.get('matchId') || undefined);
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly pct = pct;
  readonly num = num;
  readonly pickText = pickText;
  readonly lineSplit = lineSplit;
  readonly summary = pickSummary;
  readonly cols = OPTIONAL_COLS;
  private filters: Filters = {};
  private resultScope: 'TOP' | 'ANY' | undefined;

  readonly list = new PagedList<PredictionRow>(paging => {
    const matchId = this.matchId();
    return this.api.predictions({ ...this.filters, matchId, includeArchived: matchId ? true : undefined }, paging, this.resultScope, true);
  }, { field: 'probability', dir: 'desc' }, 100);   // live matches on top, then the surest top pick

  private readonly visible = signal<string[]>(this.restoreVisible());
  readonly shownCount = computed(() => this.visible().length);
  readonly pagePicks = computed(() => this.list.rows().reduce((n, p) => n + p.pickCount, 0));
  /** Predictions announced while the user is on a later page; the rows are not reloaded under them (UX-071). */
  readonly newCount = signal(0);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(query => {
      const matchId = query.get('matchId') || undefined;
      if (matchId === this.matchId()) return;
      this.matchId.set(matchId);
      this.list.reload();
    });
    const live = inject(LiveService);
    live.predictions.pipe(takeUntilDestroyed()).subscribe(() => { if (this.list.page() > 0) this.newCount.update(n => n + 1); });
    // Page 1 refreshes in place; on later pages new rows would shift what the user is looking at, so only offer it.
    live.refresh.pipe(takeUntilDestroyed()).subscribe(() => { if (this.list.page() === 0) this.list.load(); });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.peekTimer));
  }

  /** The row under the mouse, after a short pause so passing over rows does not fetch each one. */
  readonly peeked = signal<{ id: string; left: number; top: number; above: boolean } | null>(null);
  readonly peekDetail = this.api.predictionResource(() => this.peeked()?.id);
  private peekTimer?: ReturnType<typeof setTimeout>;
  readonly lineText = lineText;

  peek(id: string, e: MouseEvent): void {
    const row = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = row.bottom + 280 > window.innerHeight;   // near the bottom: open upwards
    const left = Math.max(8, Math.min(e.clientX, window.innerWidth - 690));
    clearTimeout(this.peekTimer);
    this.peekTimer = setTimeout(() => this.peeked.set({ id, left, top: above ? row.top - 4 : row.bottom + 4, above }), 250);
  }

  unpeek(): void {
    clearTimeout(this.peekTimer);
    this.peeked.set(null);
  }

  /** Rank 1 and 2, in rank order. */
  topPicks(picks: PickDetail[]): PickDetail[] {
    return picks.filter(k => k.rank <= 2).sort((a, b) => a.rank - b.rank);
  }

  /** "H 1.95 · D 3.40 · A 3.60" or "O 1.85 · U 2.00": only the prices this snapshot has. */
  prices(o: OddsSnapshot): string {
    return ([['H', o.homeOdds], ['D', o.drawOdds], ['A', o.awayOdds], ['O', o.overOdds], ['U', o.underOdds]] as const)
      .filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${k} ${num(v)}`).join(' · ');
  }

  show(field: string): boolean { return this.visible().includes(field); }

  toggle(field: string): void {
    this.visible.update(v => v.includes(field) ? v.filter(f => f !== field) : [...v, field]);
    try { localStorage.setItem(COLS_KEY, JSON.stringify(this.visible())); } catch { /* storage off: the choice lasts this visit */ }
  }

  showNew(): void { this.newCount.set(0); this.list.load(); }

  private first = true;

  /**
   * The picked days bound the kick-off time, not the prediction time. On the default range (today to tomorrow) the
   * list starts 2 hours ago, not at midnight, so matches still being played stay in and finished ones drop out.
   */
  onFilters({ resultScope, from, to, ...f }: BarFilters): void {
    const now = new Date();
    const live = new Date(now.getTime() - LIVE_WINDOW_MS);
    const isDefault = from === dayStart(now) && to === dayEndExclusive(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    this.filters = { ...f, kickoffFrom: isDefault ? live.toISOString() : from, kickoffTo: to };
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
