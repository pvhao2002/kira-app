import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { fmtDateTime, humanize, pct, pickLabel } from '../shared/format';
import { ResultTag, ScoreChip, StateView } from '../shared/ui';

@Component({
  selector: 'mm-model-detail',
  imports: [RouterLink, ResultTag, ScoreChip, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <a routerLink="/models" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i> AI models</a>
      <mm-state [state]="state()" [message]="error()" />
      @if (model(); as m) {
        <section class="panel">
          <header><div><h2>{{ m.name }} <span class="muted-text">{{ m.version }}</span></h2>
            <p class="muted-text sub">{{ m.providerName }}, first seen {{ fmt(m.createdAt) }}</p></div></header>
          @if (m.description) { <p class="page-note mb-2">{{ m.description }}</p> }
          <div class="kpis">
            <div class="kpi accent"><span>Win rate</span><strong>{{ pct(m.winRate) }}</strong></div>
            <div class="kpi"><span>Predictions</span><strong>{{ m.totalPredictions }}</strong></div>
            <div class="kpi"><span>Settled picks</span><strong>{{ m.settledPicks }}</strong></div>
            <div class="kpi"><span>Wins / losses</span><strong><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></strong></div>
            <div class="kpi"><span>Pending</span><strong class="pending">{{ m.pendingPicks }}</strong></div>
          </div>
        </section>
        <div class="grid-2 align-start">
          @for (b of breakdowns(); track b.title) {
            <section class="panel flush">
              <header><h2>By {{ b.title }}</h2></header>
              <div class="table-wrap"><table class="dt">
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
          <header><h2>Latest predictions</h2></header>
          <div class="table-wrap"><table class="dt compact-sm">
            <thead><tr><th class="hide-sm">Predicted</th><th>Match</th><th class="hide-sm">Type</th><th class="hide-sm">Predicted score</th><th>Top pick</th><th class="num hide-sm">Prob.</th><th class="hide-sm">Final</th><th class="sticky-end">Result</th></tr></thead>
            <tbody>
              @for (p of recent(); track p.id) {
              <tr class="clickable" [routerLink]="['/predictions', p.id]">
                <td class="nowrap hide-sm"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td><td><span class="truncate" [title]="p.homeTeam + ' – ' + p.awayTeam">{{ p.homeTeam }} – {{ p.awayTeam }}</span><span class="cell-sub">{{ p.league }}</span><a class="cell-sub show-sm" [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
                <td class="hide-sm">{{ humanize(p.predictionType) }}</td><td class="hide-sm"><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td>
                <td class="nowrap">{{ pickLabel(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}</td><td class="num hide-sm">{{ pct(p.topPickProbability) }}</td>
                <td class="hide-sm"><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="true" /></td><td class="sticky-end"><mm-result [value]="p.settlementStatus" /></td>
              </tr>
              } @empty { <tr><td colspan="8" class="empty">This model has no predictions yet.</td></tr> }
            </tbody>
          </table></div>
        </section>
      }
    </div>`,
})
export class ModelDetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly resource = this.api.modelOverviewResource(() => this.id());
  private readonly overview = safeValue(this.resource);
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly model = computed(() => this.overview()?.model);
  readonly breakdowns = computed(() => {
    const o = this.overview();
    return o ? [{ title: 'market', rows: o.market }, { title: 'prediction type', rows: o.type }] : [];
  });
  readonly recent = computed(() => this.overview()?.recent.data ?? []);
  readonly fmt = fmtDateTime;
  readonly pct = pct;
  readonly humanize = humanize;
  readonly pickLabel = pickLabel;
}
