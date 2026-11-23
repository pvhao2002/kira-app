import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiErrorText } from '../core/http';
import { AuthService } from '../core/auth.service';
import { FixtureSuggestion, FixtureSuggestionSide, LeagueAlias, MATCH_STATUSES, MatchRow } from '../core/models';
import { errorMessage, safeValue } from '../core/resource';
import { dayRange } from '../shared/filter-bar';
import { fmtDateTime, humanize } from '../shared/format';
import { DateInput, DateRange } from '../shared/date-picker';
import { Paginator, SortHeader, Tabs } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { fromQuery, toQuery } from '../shared/url-state';
import { ReasonAction, ReasonDialog, ResultTag, ScoreChip, StateView } from '../shared/ui';

@Component({
  selector: 'mm-matches',
  imports: [FormsModule, RouterLink, ScoreChip, ResultTag, SortHeader, Paginator, ReasonDialog, Tabs, DateInput, DateRange, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (auth.isAdmin()) { <mm-tabs controls="matches-panel" [tabs]="tabs" [(value)]="tab" /> }
      <div class="stack" id="matches-panel" [attr.role]="auth.isAdmin() ? 'tabpanel' : null" [attr.aria-labelledby]="auth.isAdmin() ? 'tab-' + tab() : null">
      @if (tab() === 'suggestions' && auth.isAdmin()) {
      <section class="panel flush" data-testid="suggestions">
        <header><div><h2>Suggested merges</h2><p class="muted-text sub">Matches that look like one game: same or similar team names, kick-off within 24 hours</p></div>
          <span class="row backfill">
            @if (backfillNote()) { <span class="muted-text" role="status">{{ backfillNote() }}</span> }
            <button type="button" class="btn btn-outline btn-sm" data-testid="fixture-backfill" [disabled]="backfilling()" (click)="backfill()"
              title="Link every match recorded before fixtures existed to its game (safe to run again)">
              <i class="pi" [class.pi-link]="!backfilling()" [class.pi-spinner]="backfilling()" [class.pi-spin]="backfilling()" aria-hidden="true"></i> Link existing matches</button>
          </span></header>
        <div class="table-wrap"><table class="dt compact-sm" aria-label="Suggested merges" [class.loading]="suggestionsResource.isLoading()" [attr.aria-busy]="suggestionsResource.isLoading()">
          <thead><tr><th>Match A</th><th>Match B</th><th>Why</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            @for (s of suggestions(); track s.a.fixtureId + s.b.fixtureId) {
            <tr>
              <td><a [routerLink]="['/matches', s.a.matchId]">{{ s.a.homeTeam }} – {{ s.a.awayTeam }}</a><span class="cell-sub">{{ side(s.a) }}</span></td>
              <td><a [routerLink]="['/matches', s.b.matchId]">{{ s.b.homeTeam }} – {{ s.b.awayTeam }}</a><span class="cell-sub">{{ side(s.b) }}</span></td>
              <td class="nowrap">{{ s.reason === 'SAME_TEAMS' ? 'Same teams' : 'Similar names' }} <span class="cell-sub">score {{ s.score }}</span></td>
              <td class="actions"><button type="button" class="btn btn-text btn-sm" data-testid="suggestion-merge" (click)="mergePair(s)">Merge</button></td>
            </tr>
            } @empty {
              <tr><td colspan="4" class="empty">
                @if (suggestionsError()) { <mm-state state="error" [message]="suggestionsError()" retryable (retry)="suggestionsResource.reload()" /> }
                @else if (suggestionsResource.isLoading()) { <mm-state state="loading" [rows]="3" /> } @else { No suggested merges. }
              </td></tr>
            }
          </tbody>
        </table></div>
        <mm-paginator [page]="sugPage()" [size]="sugSize" [total]="suggestionsTotal()" unit="pairs" (pageChange)="sugPage.set($event.page)" />
      </section>
      } @else if (tab() === 'leagues' && auth.isAdmin()) {
      <section class="panel flush" data-testid="league-aliases">
        <header><div><h2>League aliases</h2><p class="muted-text sub">Variant league names that filters, the league list and reports count as one league</p></div>
          <button type="button" class="btn btn-primary btn-sm alias-add" data-testid="alias-add" (click)="addAlias()"><i class="pi pi-plus" aria-hidden="true"></i> Add alias</button></header>
        <div class="table-wrap"><table class="dt compact-sm" aria-label="League aliases" [class.loading]="aliasesResource.isLoading()" [attr.aria-busy]="aliasesResource.isLoading()">
          <thead><tr><th>Alias</th><th>Counts as</th><th class="hide-sm">Added</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            @for (a of aliases(); track a.id) {
            <tr>
              <td><span class="truncate" [title]="a.alias">{{ a.alias }}</span></td>
              <td><span class="truncate" [title]="a.canonical">{{ a.canonical }}</span></td>
              <td class="nowrap hide-sm">{{ fmt(a.createdAt) }}</td>
              <td class="actions"><button type="button" class="btn btn-text btn-sm danger" [attr.data-testid]="'alias-remove-' + a.id" (click)="removeAlias(a)">Remove</button></td>
            </tr>
            } @empty {
              <tr><td colspan="4" class="empty">
                @if (aliasesError()) { <mm-state state="error" [message]="aliasesError()" retryable (retry)="aliasesResource.reload()" /> }
                @else if (aliasesResource.isLoading()) { <mm-state state="loading" [rows]="3" /> } @else { No league aliases. }
              </td></tr>
            }
          </tbody>
        </table></div>
      </section>
      } @else {
      <form class="filter-bar" (ngSubmit)="apply()">
        <button type="button" class="filter-toggle" (click)="collapsed.set(!collapsed())" [attr.aria-expanded]="!collapsed()">
          <i class="pi pi-sliders-h" aria-hidden="true"></i> Filters
          @if (activeCount()) { <span class="count">{{ activeCount() }}</span> }
          @if (pending()) { <span class="pending-note">· not applied</span> }
          <i class="pi" [class.pi-chevron-down]="collapsed()" [class.pi-chevron-up]="!collapsed()" aria-hidden="true"></i>
        </button>
        @if (!collapsed()) {
        <div class="filter-fields">
          <input class="input f-search" name="search" [(ngModel)]="search" placeholder="Team, league or match id" aria-label="Search matches" />
          <mm-date-range label="Kick-off">
            <mm-date-input name="from" [(ngModel)]="from" />
            <mm-date-input name="to" [(ngModel)]="to" />
          </mm-date-range>
          <input class="input f-select" name="league" [(ngModel)]="league" list="mm-match-leagues" placeholder="All leagues" aria-label="League" />
          <datalist id="mm-match-leagues">@for (l of leagues(); track l) { <option [value]="l"></option> }</datalist>
          <label class="check"><input type="checkbox" data-testid="show-archived" [checked]="archived()" (change)="archived.set($any($event.target).checked)" /> Show archived</label>
          @if (dateError()) { <span class="field-error" role="alert">{{ dateError() }}</span> }
          <span class="filter-actions">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="!!rangeError()"><i class="pi pi-check" aria-hidden="true"></i> Apply</button>
            <button type="button" class="btn btn-text btn-sm" (click)="reset()">Reset</button>
            @if (pending()) { <span class="pending-note" role="status">Changes not applied</span> }
          </span>
        </div>
        <div class="chips" role="group" aria-label="Status">
          <button type="button" class="chip" [attr.aria-pressed]="status() === '' && !overdue()" (click)="setStatus('')">All</button>
          <button type="button" class="chip" data-testid="overdue-chip" [attr.aria-pressed]="overdue()" (click)="setOverdue()"
            title="Kick-off more than 3 hours ago and still scheduled or live: the result is due">Awaiting result</button>
          @for (s of statuses; track s.value) {
            <button type="button" class="chip" [attr.aria-pressed]="status() === s.value" (click)="setStatus(s.value)">{{ s.label }}</button>
          }
        </div>
        }
      </form>
      @if (auth.isAdmin() && selected().length) {
        <div class="panel row selection-bar" data-testid="selection-bar">
          <span role="status">{{ selected().length }} selected</span>
          <button type="button" class="btn btn-primary btn-sm" data-testid="merge-open" [disabled]="selected().length < 2 || selected().length > 20"
            title="Treat the selected rows as one real game, so their models are compared together" (click)="mergeSelected()"><i class="pi pi-link" aria-hidden="true"></i> Merge matches</button>
          <button type="button" class="btn btn-text btn-sm" (click)="selected.set([])">Clear</button>
          @if (selected().length < 2) { <span class="muted-text">Select at least 2 matches to merge.</span> }
          @else if (selected().length > 20) { <span class="muted-text">Merge at most 20 matches at once.</span> }
        </div>
      }
      <section class="panel flush">
        <div class="table-wrap tall">
          <table class="dt compact-sm" aria-label="Matches" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
            <thead>
              <tr>
                @if (auth.isAdmin()) { <th class="select"><span class="sr-only">Select</span></th> }
                <th class="hide-sm" mmSort="startTime" [sort]="list.sort()" (sortChange)="list.setSort($event)">Kick-off</th>
                <th class="hide-sm" mmSort="league" [sort]="list.sort()" (sortChange)="list.setSort($event)">League</th>
                <th mmSort="homeTeam" [sort]="list.sort()" (sortChange)="list.setSort($event)">Match</th>
                <th>Score</th><th class="hide-sm">HT</th><th class="hide-sm">Corners</th>
                <th mmSort="status" [sort]="list.sort()" (sortChange)="list.setSort($event)">Status</th>
                <th class="num hide-sm" mmSort="predictionCount" [sort]="list.sort()" (sortChange)="list.setSort($event)">Predictions</th>
                <th class="num hide-sm">Models</th><th class="hide-sm">Provider</th>
                @if (auth.isAdmin()) { <th class="actions"><span class="sr-only">Actions</span></th> }
              </tr>
            </thead>
            <tbody>
              @for (m of list.rows(); track m.id) {
                <tr class="clickable" tabindex="-1" [routerLink]="['/matches', m.id]">
                  @if (auth.isAdmin()) {
                    <td class="select" (click)="$event.stopPropagation()"><input type="checkbox" [attr.data-testid]="'select-' + m.id"
                      [attr.aria-label]="'Select ' + m.homeTeam + ' – ' + m.awayTeam" [checked]="isSelected(m)" (change)="toggle(m)" /></td>
                  }
                  <td class="nowrap hide-sm">{{ fmt(m.startTime) }}</td>
                  <td class="hide-sm league"><span class="truncate" [title]="m.league">{{ m.league }}</span></td>
                  <td><a class="truncate" [routerLink]="['/matches', m.id]" [title]="m.homeTeam + ' – ' + m.awayTeam">{{ m.homeTeam }} – {{ m.awayTeam }}</a><span class="cell-sub hide-sm">{{ m.externalMatchId }}</span><span class="cell-sub show-sm">{{ m.league }} · {{ fmt(m.startTime) }}</span></td>
                  <td><mm-score [home]="m.finalHomeScore" [away]="m.finalAwayScore" [muted]="m.status !== 'FINISHED'" /></td>
                  <td class="hide-sm"><mm-score [home]="m.htHomeScore" [away]="m.htAwayScore" [muted]="true" /></td>
                  <td class="hide-sm"><mm-score [home]="m.finalHomeCorners" [away]="m.finalAwayCorners" [muted]="true" /></td>
                  <td class="nowrap"><mm-result [value]="m.status" kind="status" />
                    @if (m.overdue) { <span class="tag tag-warn" title="Kick-off more than 3 hours ago and no final result yet">Overdue</span> }
                    @if (m.archivedAt) { <span class="tag tag-secondary">Archived</span> }</td>
                  <td class="num hide-sm">{{ m.predictionCount }}</td>
                  <td class="num hide-sm">{{ m.modelCount }}</td>
                  <td class="hide-sm">{{ m.providerName }}</td>
                  @if (auth.isAdmin()) {
                    <td class="actions"><button type="button" class="btn btn-text btn-sm" [class.danger]="!m.archivedAt" [attr.data-testid]="'archive-' + m.id"
                      (click)="$event.stopPropagation(); archive(m)">{{ m.archivedAt ? 'Unarchive' : 'Archive' }}</button></td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="auth.isAdmin() ? 12 : 10" class="empty">
                  @if (list.loading()) { <mm-state state="loading" [rows]="6" /> }
                  @else if (list.error()) {
                    <div class="empty-state" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i><strong>Couldn't load matches</strong><span>{{ list.error() }}</span>
                      <button type="button" class="btn btn-outline btn-sm" data-testid="retry" (click)="list.load()"><i class="pi pi-refresh" aria-hidden="true"></i> Retry</button></div>
                  }
                  @else { <div class="empty-state"><i class="pi pi-calendar" aria-hidden="true"></i><strong>No matches found</strong><span>Widen the dates or reset the filters.</span></div> }
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (!list.error()) {
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" unit="matches" (pageChange)="list.setPage($event)" />
        }
      </section>
      }
      </div>
    </div>
    <mm-reason-dialog [action]="action()" [ready]="!aliasForm() || (!!aliasName().trim() && !!aliasCanonical().trim())"
      (closed)="action.set(null); aliasForm.set(false)">
      @if (aliasForm()) {
        <div class="field"><label for="mm-alias-name">Alias (as agents send it)</label>
          <input class="input" id="mm-alias-name" maxlength="160" list="mm-alias-leagues" data-testid="alias-name"
            [value]="aliasName()" (input)="aliasName.set($any($event.target).value)" /></div>
        <div class="field"><label for="mm-alias-canonical">Counts as</label>
          <input class="input" id="mm-alias-canonical" maxlength="160" list="mm-alias-leagues" data-testid="alias-canonical"
            [value]="aliasCanonical()" (input)="aliasCanonical.set($any($event.target).value)" /></div>
        <datalist id="mm-alias-leagues">@for (l of leagues(); track l) { <option [value]="l"></option> }</datalist>
      }
    </mm-reason-dialog>`,
  styles: `
    .league .truncate { max-width: 11rem; }
    .tag-warn { margin-left: .3rem; }
    .selection-bar { gap: .75rem; align-items: center; flex-wrap: wrap; padding: var(--sp-2) var(--sp-3); }
    mm-date-range { min-width: 0; }
    th.select, td.select { width: 2rem; }
    .backfill, .alias-add { margin-left: auto; }
    .backfill { gap: .5rem; align-items: center; flex-wrap: wrap; }`,
})
export class MatchesPage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly action = signal<ReasonAction | null>(null);
  /** Also list archived matches (and those of archived providers). */
  readonly archived = signal(false);
  private readonly leaguesResource = this.api.leaguesResource();
  readonly leagues = safeValue(this.leaguesResource, []);
  readonly statuses = MATCH_STATUSES.map(s => ({ label: humanize(s), value: s }));
  readonly fmt = fmtDateTime;
  readonly search = signal('');
  readonly league = signal('');
  readonly status = signal('');
  readonly overdue = signal(false);
  readonly from = signal('');
  readonly to = signal('');
  /** Starts collapsed on phones and short (landscape) screens, where an open form would push the table below the fold. */
  readonly collapsed = signal(typeof window !== 'undefined' && (window.innerWidth < 760 || window.innerHeight <= 500));
  /** How many filters the last Apply put in force. */
  readonly activeCount = signal(0);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Every control (text, dates, status chips, archived) waits for Apply; differences are shown as not applied.
   * Reset applies at once.
   */
  private readonly appliedKey = signal('');
  private readonly key = computed(() => JSON.stringify([this.search(), this.league(), this.from(), this.to(), this.status(), this.overdue(), this.archived()]));
  readonly pending = computed(() => this.key() !== this.appliedKey());
  private readonly dateRange = viewChild(DateRange);
  readonly rangeError = computed(() => this.dateRange()?.error() || dayRange(this.from(), this.to()).error || '');
  /** The server's date error only: the range shows the From-after-To error itself. */
  readonly dateError = computed(() => this.list.fieldErrors()['from'] ?? '');

  constructor() {
    // A shared or refreshed link restores the filters.
    const q = fromQuery(this.route.snapshot.queryParamMap, ['search', 'league', 'status', 'from', 'to', 'overdue', 'archived'] as const);
    this.archived.set(q.archived === 'true');
    this.search.set(q.search ?? ''); this.league.set(q.league ?? ''); this.status.set(q.status ?? '');
    this.from.set(q.from ?? ''); this.to.set(q.to ?? ''); this.overdue.set(q.overdue === 'true');
    this.apply(false);
  }

  /** Filters as of the last Apply, so paging and sorting never pick up half-typed values. */
  private applied: Parameters<ApiService['matches']>[0] = {};
  readonly list = new PagedList<MatchRow>(paging => this.api.matches({ ...this.applied, ...paging }), { field: 'startTime', dir: 'desc' });

  reset(): void {
    for (const f of [this.search, this.league, this.status, this.from, this.to]) f.set('');
    this.dateRange()?.setRange('', '');
    this.overdue.set(false);
    this.archived.set(false);
    this.apply();
  }

  // Fixtures (admin): merge selected rows into one game, or a suggested pair.
  readonly tabs = [{ value: 'matches', label: 'Matches' }, { value: 'suggestions', label: 'Suggested merges' },
    { value: 'leagues', label: 'League aliases' }];
  readonly tab = signal('matches');
  readonly selected = signal<MatchRow[]>([]);
  readonly sugPage = signal(0);
  readonly sugSize = 25;
  readonly suggestionsResource = rxResource({
    params: () => (this.tab() === 'suggestions' && this.auth.isAdmin() ? { page: this.sugPage() } : undefined),
    stream: ({ params }) => this.api.fixtureSuggestions({ page: params.page, size: this.sugSize }),
  });
  private readonly suggestionPage = safeValue(this.suggestionsResource);
  readonly suggestions = computed<FixtureSuggestion[]>(() => this.suggestionPage()?.data ?? []);
  readonly suggestionsTotal = computed(() => this.suggestionPage()?.meta.totalElements ?? 0);
  readonly suggestionsError = errorMessage(this.suggestionsResource);

  /** Admin: links matches recorded before fixtures existed (POST /fixtures/backfill, idempotent). */
  readonly backfilling = signal(false);
  readonly backfillNote = signal('');
  backfill(): void {
    if (this.backfilling()) return;
    this.backfilling.set(true);
    this.backfillNote.set('');
    this.api.backfillFixtures().subscribe({
      next: r => {
        this.backfilling.set(false);
        this.backfillNote.set(r.linked ? `Linked ${r.linked} matches` : 'Every match is already linked');
        this.suggestionsResource.reload();
      },
      error: e => { this.backfilling.set(false); this.backfillNote.set(apiErrorText(e)); },
    });
  }

  // League aliases (UX-086, admin)
  readonly aliasesResource = rxResource({
    params: () => (this.tab() === 'leagues' && this.auth.isAdmin() ? {} : undefined),
    stream: () => this.api.leagueAliases(),
  });
  readonly aliases = safeValue(this.aliasesResource, []);
  readonly aliasesError = errorMessage(this.aliasesResource);
  readonly aliasForm = signal(false);
  readonly aliasName = signal('');
  readonly aliasCanonical = signal('');
  private aliasesChanged(): void { this.aliasesResource.reload(); this.leaguesResource.reload(); }

  addAlias(): void {
    this.aliasName.set(''); this.aliasCanonical.set(''); this.aliasForm.set(true);
    this.action.set({
      header: 'Add league alias', label: 'Add alias',
      message: 'Filters, the league list and reports then count matches of the alias as the league it counts as. Stored names do not change.',
      run: reason => this.api.addLeagueAlias({ alias: this.aliasName().trim(), canonical: this.aliasCanonical().trim(), reason }),
      done: () => this.aliasesChanged(),
    });
  }

  removeAlias(a: LeagueAlias): void {
    this.aliasForm.set(false);
    this.action.set({
      header: `Remove alias ${a.alias}`, label: 'Remove', danger: true,
      message: `${a.alias} counts as its own league again instead of ${a.canonical}.`,
      run: reason => this.api.removeLeagueAlias(a.id, reason),
      done: () => this.aliasesChanged(),
    });
  }

  isSelected(m: MatchRow): boolean { return this.selected().some(x => x.id === m.id); }
  toggle(m: MatchRow): void {
    this.selected.update(rows => (rows.some(x => x.id === m.id) ? rows.filter(x => x.id !== m.id) : [...rows, m]));
  }
  side(s: FixtureSuggestionSide): string { return `${s.providerName} · ${fmtDateTime(s.startTime)} · ${s.externalMatchId}`; }

  /** Admin: the selected rows become one game (fixture). Predictions, results and settlement do not change. */
  mergeSelected(): void {
    const rows = this.selected();
    if (rows.length < 2 || rows.length > 20) return;
    this.action.set({
      header: `Merge ${rows.length} matches into one game`, label: 'Merge',
      message: rows.map(m => `${m.homeTeam} – ${m.awayTeam} (${m.providerName}, ${fmtDateTime(m.startTime)})`).join('; ')
        + '. Their models are then compared together. Predictions, results and settlement do not change.',
      run: reason => this.api.mergeMatches(rows.map(m => m.id), reason),
      done: () => { this.selected.set([]); this.list.load(); },
    });
  }

  mergePair(s: FixtureSuggestion): void {
    this.action.set({
      header: `Merge ${s.a.homeTeam} – ${s.a.awayTeam} with ${s.b.homeTeam} – ${s.b.awayTeam}`, label: 'Merge',
      message: 'Both rows (and the rows already linked to them) become one game. Predictions, results and settlement do not change.',
      run: reason => this.api.mergeMatches([s.a.matchId, s.b.matchId], reason),
      done: () => this.suggestionsResource.reload(),
    });
  }

  archive(m: MatchRow): void {
    const archived = !m.archivedAt;
    this.action.set({
      header: `${archived ? 'Archive' : 'Unarchive'} ${m.homeTeam} – ${m.awayTeam}`, label: archived ? 'Archive' : 'Unarchive', danger: archived,
      message: archived ? 'The match and its predictions leave every list and figure, win rates included. Nothing is deleted.' : 'The match counts again.',
      run: reason => this.api.setArchived('matches', m.id, archived, reason),
      done: () => this.list.load(),
    });
  }

  setStatus(value: string): void { this.status.set(value); this.overdue.set(false); }
  /** "Awaiting result": overdue matches (still scheduled or live 3 h after kick-off); replaces the status filter. */
  setOverdue(): void { this.status.set(''); this.overdue.set(true); }

  apply(updateUrl = true): void {
    if (this.rangeError()) return;
    const [search, league, status, from, to, overdue] = [this.search().trim(), this.league().trim(), this.status(), this.from(), this.to(), this.overdue()];
    const range = dayRange(from, to);
    this.applied = {
      search: search || undefined, league: league || undefined, status: status || undefined,
      from: range.from, to: range.to, overdue: overdue || undefined, includeArchived: this.archived() || undefined,
    };
    this.appliedKey.set(this.key());
    this.activeCount.set([search, league, status || overdue, from || to, this.archived()].filter(Boolean).length);
    // First load keeps the page and sort that came with the URL; an applied filter starts over at page 1.
    if (updateUrl) this.list.reload(); else this.list.load();
    if (updateUrl) {
      toQuery(this.router, this.route, {
        search: search || null, league: league || null, status: status || null, from: from || null, to: to || null,
        overdue: overdue ? 'true' : null, archived: this.archived() ? 'true' : null,
      });
    }
  }
}
