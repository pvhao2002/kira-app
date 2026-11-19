import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { MATCH_STATUSES, MatchRow } from '../core/models';
import { localDay } from '../shared/filter-bar';
import { dayEndExclusive, dayStart, fmtDateTime, humanize } from '../shared/format';
import { Paginator, SortHeader } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
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
          <select class="input f-select-sm" name="status" [(ngModel)]="status" aria-label="Status">
            <option value="">Any status</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          <button type="submit" class="btn btn-primary btn-sm"><i class="pi pi-check"></i> Apply</button>
        </div>
      </form>
      <section class="panel flush">
        <div class="table-wrap tall">
          <table class="dt" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
            <thead>
              <tr>
                <th mmSort="startTime" [sort]="list.sort()" (sortChange)="list.setSort($event)">Kick-off</th>
                <th mmSort="league" [sort]="list.sort()" (sortChange)="list.setSort($event)">League</th>
                <th mmSort="homeTeam" [sort]="list.sort()" (sortChange)="list.setSort($event)">Match</th>
                <th>Score</th><th>HT</th><th>Corners</th>
                <th mmSort="status" [sort]="list.sort()" (sortChange)="list.setSort($event)">Status</th>
                <th mmSort="predictionCount" class="num" [sort]="list.sort()" (sortChange)="list.setSort($event)">Predictions</th>
                <th class="num">Models</th><th>Provider</th>
              </tr>
            </thead>
            <tbody>
              @for (m of list.rows(); track m.id) {
                <tr class="clickable" [routerLink]="['/matches', m.id]">
                  <td class="nowrap">{{ fmt(m.startTime) }}</td>
                  <td>{{ m.league }}</td>
                  <td><a [routerLink]="['/matches', m.id]">{{ m.homeTeam }} – {{ m.awayTeam }}</a><span class="cell-sub">{{ m.externalMatchId }}</span></td>
                  <td><mm-score [home]="m.finalHomeScore" [away]="m.finalAwayScore" [muted]="m.status !== 'FINISHED'" /></td>
                  <td><mm-score [home]="m.htHomeScore" [away]="m.htAwayScore" [muted]="true" /></td>
                  <td class="nowrap">{{ m.finalHomeCorners ?? '–' }} : {{ m.finalAwayCorners ?? '–' }}</td>
                  <td><mm-result [value]="m.status" kind="status" /></td>
                  <td class="num">{{ m.predictionCount }}</td>
                  <td class="num">{{ m.modelCount }}</td>
                  <td>{{ m.providerName }}</td>
                </tr>
              } @empty {
                <tr><td colspan="10" class="empty">{{ list.loading() ? 'Loading…' : list.error() || 'No matches match these filters.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" unit="matches" (change)="list.setPage($event)" />
      </section>
    </div>`,
})
export class MatchesPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly leagues = signal<string[]>([]);
  readonly statuses = MATCH_STATUSES.map(s => ({ label: humanize(s), value: s }));
  readonly fmt = fmtDateTime;
  search = '';
  league = '';
  status = '';
  from = '';
  to = '';

  ngOnInit(): void {
    this.api.leagues().subscribe({ next: l => this.leagues.set(l), error: () => undefined });
    this.apply();
  }

  /** Filters as of the last Apply, so paging and sorting never pick up half-typed values. */
  private applied: Parameters<ApiService['matches']>[0] = {};
  readonly list = new PagedList<MatchRow>(paging => this.api.matches({ ...this.applied, ...paging }), { field: 'startTime', dir: 'desc' });

  apply(): void {
    const start = localDay(this.from) ?? localDay(this.to);
    const end = localDay(this.to) ?? start;
    this.applied = {
      search: this.search.trim() || undefined, league: this.league.trim() || undefined, status: this.status || undefined,
      from: start ? dayStart(start) : undefined, to: end ? dayEndExclusive(end) : undefined,
    };
    this.list.reload();
  }
}
