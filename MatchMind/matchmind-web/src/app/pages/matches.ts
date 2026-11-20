import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { MATCH_STATUSES, MatchRow } from '../core/models';
import { safeValue } from '../core/resource';
import { localDay } from '../shared/filter-bar';
import { dayEndExclusive, dayStart, fmtDateTime, humanize } from '../shared/format';
import { Paginator, SortHeader } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { fromQuery, toQuery } from '../shared/url-state';
import { ResultTag, ScoreChip } from '../shared/ui';

@Component({
  selector: 'mm-matches',
  imports: [FormsModule, RouterLink, ScoreChip, ResultTag, SortHeader, Paginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <form class="filter-bar" (ngSubmit)="apply()">
        <div class="filter-fields">
          <input class="input f-search" name="search" [(ngModel)]="search" placeholder="Team, league or match id" aria-label="Search matches" />
          <span class="date-range">
            <input class="input" type="date" name="from" [(ngModel)]="from" aria-label="Kick-off from" />
            <span aria-hidden="true">–</span>
            <input class="input" type="date" name="to" [(ngModel)]="to" aria-label="Kick-off to" />
          </span>
          <input class="input f-select" name="league" [(ngModel)]="league" list="mm-match-leagues" placeholder="All leagues" aria-label="League" />
          <datalist id="mm-match-leagues">@for (l of leagues(); track l) { <option [value]="l"></option> }</datalist>
          <span class="filter-actions">
            <button type="submit" class="btn btn-primary btn-sm"><i class="pi pi-check"></i> Apply</button>
            <button type="button" class="btn btn-text btn-sm" (click)="reset()">Reset</button>
          </span>
        </div>
        <div class="chips" role="group" aria-label="Status">
          <button type="button" class="chip" [attr.aria-pressed]="status() === ''" (click)="setStatus('')">All</button>
          @for (s of statuses; track s.value) {
            <button type="button" class="chip" [attr.aria-pressed]="status() === s.value" (click)="setStatus(s.value)">{{ s.label }}</button>
          }
        </div>
      </form>
      <section class="panel flush">
        <div class="table-wrap tall">
          <table class="dt compact-sm" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
            <thead>
              <tr>
                <th class="hide-sm" mmSort="startTime" [sort]="list.sort()" (sortChange)="list.setSort($event)">Kick-off</th>
                <th class="hide-sm" mmSort="league" [sort]="list.sort()" (sortChange)="list.setSort($event)">League</th>
                <th mmSort="homeTeam" [sort]="list.sort()" (sortChange)="list.setSort($event)">Match</th>
                <th>Score</th><th class="hide-sm">HT</th><th class="hide-sm">Corners</th>
                <th mmSort="status" [sort]="list.sort()" (sortChange)="list.setSort($event)">Status</th>
                <th class="num hide-sm" mmSort="predictionCount" [sort]="list.sort()" (sortChange)="list.setSort($event)">Predictions</th>
                <th class="num hide-sm">Models</th><th class="hide-sm">Provider</th>
              </tr>
            </thead>
            <tbody>
              @for (m of list.rows(); track m.id) {
                <tr class="clickable" [routerLink]="['/matches', m.id]">
                  <td class="nowrap hide-sm">{{ fmt(m.startTime) }}</td>
                  <td class="hide-sm"><span class="truncate" [title]="m.league">{{ m.league }}</span></td>
                  <td><a class="truncate" [routerLink]="['/matches', m.id]" [title]="m.homeTeam + ' – ' + m.awayTeam">{{ m.homeTeam }} – {{ m.awayTeam }}</a><span class="cell-sub hide-sm">{{ m.externalMatchId }}</span><span class="cell-sub show-sm">{{ m.league }} · {{ fmt(m.startTime) }}</span></td>
                  <td><mm-score [home]="m.finalHomeScore" [away]="m.finalAwayScore" [muted]="m.status !== 'FINISHED'" /></td>
                  <td class="hide-sm"><mm-score [home]="m.htHomeScore" [away]="m.htAwayScore" [muted]="true" /></td>
                  <td class="nowrap hide-sm">{{ m.finalHomeCorners ?? '—' }} : {{ m.finalAwayCorners ?? '—' }}</td>
                  <td><mm-result [value]="m.status" kind="status" /></td>
                  <td class="num hide-sm">{{ m.predictionCount }}</td>
                  <td class="num hide-sm">{{ m.modelCount }}</td>
                  <td class="hide-sm">{{ m.providerName }}</td>
                </tr>
              } @empty {
                <tr><td colspan="10" class="empty">
                  @if (list.loading()) { <div class="empty-state"><i class="pi pi-spinner pi-spin" aria-hidden="true"></i><span>Loading…</span></div> }
                  @else if (list.error()) { <div class="empty-state"><i class="pi pi-exclamation-circle" aria-hidden="true"></i><span>{{ list.error() }}</span></div> }
                  @else { <div class="empty-state"><i class="pi pi-calendar" aria-hidden="true"></i><strong>No matches found</strong><span>Widen the dates or reset the filters.</span></div> }
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" unit="matches" (change)="list.setPage($event)" />
      </section>
    </div>`,
})
export class MatchesPage {
  private readonly api = inject(ApiService);
  readonly leagues = safeValue(this.api.leaguesResource(), []);
  readonly statuses = MATCH_STATUSES.map(s => ({ label: humanize(s), value: s }));
  readonly fmt = fmtDateTime;
  readonly search = signal('');
  readonly league = signal('');
  readonly status = signal('');
  readonly from = signal('');
  readonly to = signal('');

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    // A shared or refreshed link restores the filters.
    const q = fromQuery(this.route.snapshot.queryParamMap, ['search', 'league', 'status', 'from', 'to'] as const);
    this.search.set(q.search ?? ''); this.league.set(q.league ?? ''); this.status.set(q.status ?? '');
    this.from.set(q.from ?? ''); this.to.set(q.to ?? '');
    this.apply(false);
  }

  /** Filters as of the last Apply, so paging and sorting never pick up half-typed values. */
  private applied: Parameters<ApiService['matches']>[0] = {};
  readonly list = new PagedList<MatchRow>(paging => this.api.matches({ ...this.applied, ...paging }), { field: 'startTime', dir: 'desc' });

  reset(): void {
    for (const f of [this.search, this.league, this.status, this.from, this.to]) f.set('');
    this.apply();
  }

  setStatus(value: string): void { this.status.set(value); this.apply(); }

  apply(updateUrl = true): void {
    const [search, league, status, from, to] = [this.search().trim(), this.league().trim(), this.status(), this.from(), this.to()];
    const start = localDay(from) ?? localDay(to);
    const end = localDay(to) ?? start;
    this.applied = {
      search: search || undefined, league: league || undefined, status: status || undefined,
      from: start ? dayStart(start) : undefined, to: end ? dayEndExclusive(end) : undefined,
    };
    // First load keeps the page and sort that came with the URL; an applied filter starts over at page 1.
    if (updateUrl) this.list.reload(); else this.list.load();
    if (updateUrl) {
      toQuery(this.router, this.route, {
        search: search || null, league: league || null, status: status || null, from: from || null, to: to || null,
      });
    }
  }
}
