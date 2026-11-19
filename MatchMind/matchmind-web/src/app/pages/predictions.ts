import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
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
        <table class="dt" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
          <thead>
            <tr>
              <th mmSort="predictedAt" [sort]="list.sort()" (sortChange)="list.setSort($event)">Predicted</th>
              <th mmSort="startTime" [sort]="list.sort()" (sortChange)="list.setSort($event)">Match</th>
              <th mmSort="model" [sort]="list.sort()" (sortChange)="list.setSort($event)">Model</th>
              <th mmSort="type" [sort]="list.sort()" (sortChange)="list.setSort($event)">Type</th>
              <th mmSort="minute" class="num" [sort]="list.sort()" (sortChange)="list.setSort($event)">Min</th>
              <th>At capture</th><th>Predicted</th><th class="num">CS prob.</th><th>Top pick</th>
              <th mmSort="probability" class="num" [sort]="list.sort()" (sortChange)="list.setSort($event)">Prob.</th>
              <th class="num">Price</th><th>Final</th><th>Result</th><th class="num">Picks</th>
            </tr>
          </thead>
          <tbody>
            @for (p of list.rows(); track p.id) {
            <tr class="clickable" [routerLink]="['/predictions', p.id]">
              <td class="nowrap"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
              <td><span class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam">{{ p.homeTeam }} – {{ p.awayTeam }}</span><span class="cell-sub">{{ p.league }}</span></td>
              <td class="nowrap">{{ p.modelName }} <span class="cell-sub">{{ p.modelVersion }}</span></td>
              <td>{{ humanize(p.predictionType) }}</td>
              <td class="num">{{ p.matchMinute ?? '—' }}</td>
              <td><mm-score [home]="p.currentHomeScore" [away]="p.currentAwayScore" [muted]="true" /></td>
              <td><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td>
              <td class="num">{{ pct(p.correctScoreProbability) }}</td>
              <td class="nowrap">{{ pickLabel(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}<span class="cell-sub">{{ humanize(p.topPickStage) }}</span></td>
              <td class="num">{{ pct(p.topPickProbability) }}</td>
              <td class="num">{{ num(p.topPickPrice) }}</td>
              <td><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="p.matchStatus !== 'FINISHED'" /></td>
              <td><mm-result [value]="p.settlementStatus" /></td>
              <td class="num">{{ p.pickCount }}</td>
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

  onFilters(f: Filters): void { this.filters = f; this.list.reload(); }
}
