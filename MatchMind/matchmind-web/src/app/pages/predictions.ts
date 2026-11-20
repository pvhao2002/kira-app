import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { LiveService } from '../core/live.service';
import { Filters, PredictionRow } from '../core/models';
import { FilterBar } from '../shared/filter-bar';
import { fmtDateTime, humanize, num, pct, pickLabel } from '../shared/format';
import { Paginator, SortHeader } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { ResultTag, ScoreChip } from '../shared/ui';

@Component({
  selector: 'mm-predictions',
  imports: [RouterLink, FilterBar, SortHeader, Paginator, ScoreChip, ResultTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <mm-filter-bar [fields]="['search', 'dates', 'league', 'model', 'type', 'market', 'result']" (changed)="onFilters($event)" />
      <section class="panel flush">
        <div class="table-wrap tall">
        <table class="dt compact-sm" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
          <thead>
            <tr>
              <th class="hide-sm" mmSort="predictedAt" [sort]="list.sort()" (sortChange)="list.setSort($event)">Predicted</th>
              <th mmSort="startTime" [sort]="list.sort()" (sortChange)="list.setSort($event)">Match</th>
              <th class="hide-sm" mmSort="model" [sort]="list.sort()" (sortChange)="list.setSort($event)">Model</th>
              <th>Top pick</th>
              <th class="num hide-sm" mmSort="probability" [sort]="list.sort()" (sortChange)="list.setSort($event)">Prob.</th>
              <th class="num hide-sm">Price</th><th class="hide-sm">Pred. score</th><th class="hide-sm">Final</th><th class="sticky-end" title="Result of the top-ranked pick. Open a prediction to see every pick.">Top result</th>
              <th class="hide-sm" mmSort="type" [sort]="list.sort()" (sortChange)="list.setSort($event)">Type</th>
              <th class="num hide-sm" mmSort="minute" [sort]="list.sort()" (sortChange)="list.setSort($event)">Min</th>
              <th class="hide-sm">At capture</th><th class="num hide-sm">CS prob.</th><th class="num hide-sm">Picks</th>
            </tr>
          </thead>
          <tbody>
            @for (p of list.rows(); track p.id) {
            <tr class="clickable" [routerLink]="['/predictions', p.id]">
              <td class="nowrap hide-sm"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
              <td><span class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam">{{ p.homeTeam }} – {{ p.awayTeam }}</span><span class="cell-sub">{{ p.league }}</span><a class="cell-sub show-sm" [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
              <td class="nowrap hide-sm">{{ p.modelName }} <span class="cell-sub">{{ p.modelVersion }}</span></td>
              <td class="nowrap">{{ pickLabel(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}<span class="cell-sub">{{ humanize(p.topPickStage) }}</span></td>
              <td class="num hide-sm">{{ pct(p.topPickProbability) }}</td>
              <td class="num hide-sm">{{ num(p.topPickPrice) }}</td>
              <td class="hide-sm"><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td>
              <td class="hide-sm"><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="p.matchStatus !== 'FINISHED'" /></td>
              <td class="sticky-end"><mm-result [value]="p.settlementStatus" /></td>
              <td class="hide-sm">{{ humanize(p.predictionType) }}</td>
              <td class="num hide-sm">{{ p.matchMinute ?? '—' }}</td>
              <td class="hide-sm"><mm-score [home]="p.currentHomeScore" [away]="p.currentAwayScore" [muted]="true" /></td>
              <td class="num hide-sm">{{ pct(p.correctScoreProbability) }}</td>
              <td class="num hide-sm">{{ p.pickCount }}</td>
            </tr>
            } @empty {
              <tr><td colspan="14" class="empty">{{ list.loading() ? 'Loading…' : list.error() || 'No predictions match these filters.' }}</td></tr>
            }
          </tbody>
        </table>
        </div>
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" unit="predictions" (change)="list.setPage($event)" />
      </section>
    </div>`,
})
export class PredictionsPage {
  private readonly api = inject(ApiService);
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly pct = pct;
  readonly num = num;
  readonly pickLabel = pickLabel;
  private filters: Filters = {};

  readonly list = new PagedList<PredictionRow>(paging => this.api.predictions(this.filters, paging), { field: 'predictedAt', dir: 'desc' });

  constructor() {
    // Stay on the current page and sort; a new prediction may land on it.
    inject(LiveService).refresh.pipe(takeUntilDestroyed()).subscribe(() => this.list.load());
  }

  private first = true;

  onFilters(f: Filters): void {
    this.filters = f;
    // The filter bar reports once on init: keep the page and sort from the URL then, start over on later changes.
    if (this.first) { this.first = false; this.list.load(); } else this.list.reload();
  }
}
