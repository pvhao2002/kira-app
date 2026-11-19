import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { AiModel, BreakdownRow, PredictionRow } from '../core/models';
import { fmtDateTime, humanize, pct, pickLabel } from '../shared/format';
import { ResultTag, ScoreChip, StateView } from '../shared/ui';

@Component({
  selector: 'mm-model-detail',
  imports: [RouterLink, ResultTag, ScoreChip, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <a routerLink="/models"><i class="pi pi-arrow-left"></i> AI models</a>
      <mm-state [state]="state()" [message]="error()" />
      @if (model(); as m) {
        <section class="panel">
          <header><div><h2>{{ m.name }} <span class="muted-text" style="display:inline">{{ m.version }}</span></h2>
            <p class="muted-text">{{ m.providerName }}, first seen {{ fmt(m.createdAt) }}</p></div></header>
          @if (m.description) { <p style="margin-top:0">{{ m.description }}</p> }
          <div class="kpis">
            <div class="kpi accent"><span>Win rate</span><strong>{{ pct(m.winRate) }}</strong></div>
            <div class="kpi"><span>Predictions</span><strong>{{ m.totalPredictions }}</strong></div>
            <div class="kpi"><span>Settled picks</span><strong>{{ m.settledPicks }}</strong></div>
            <div class="kpi"><span>Wins / losses</span><strong><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></strong></div>
            <div class="kpi"><span>Pending</span><strong class="pending">{{ m.pendingPicks }}</strong></div>
          </div>
        </section>
        <div class="grid-2">
          @for (b of breakdowns(); track b.title) {
            <section class="panel flush">
              <header><h2>By {{ b.title }}</h2></header>
              <table class="dt">
                <thead><tr><th>{{ b.title }}</th><th class="num">Picks</th><th class="num">W / L</th><th class="num">Push/void</th><th class="num">Pending</th><th class="num">Win rate</th></tr></thead>
                <tbody>@for (r of b.rows; track r.key) { <tr><td>{{ humanize(r.key) }}</td><td class="num">{{ r.picks }}</td>
                  <td class="num"><span class="win">{{ r.wins }}</span> / <span class="loss">{{ r.losses }}</span></td><td class="num">{{ r.pushOrVoid }}</td>
                  <td class="num">{{ r.pending }}</td><td class="num">{{ pct(r.winRate) }}</td></tr> }
                @empty { <tr><td colspan="6" class="empty">No picks yet.</td></tr> }</tbody>
              </table>
            </section>
          }
        </div>
        <section class="panel flush">
          <header><h2>Latest predictions</h2></header>
          <div class="table-wrap"><table class="dt">
            <thead><tr><th>Predicted</th><th>Match</th><th>Type</th><th>Predicted score</th><th>Top pick</th><th class="num">Prob.</th><th>Final</th><th>Result</th></tr></thead>
            <tbody>
              @for (p of recent(); track p.id) {
              <tr class="clickable" [routerLink]="['/predictions', p.id]">
                <td class="nowrap"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td><td>{{ p.homeTeam }} – {{ p.awayTeam }}<span class="cell-sub">{{ p.league }}</span></td>
                <td>{{ humanize(p.predictionType) }}</td><td><mm-score [home]="p.predictedHomeScore" [away]="p.predictedAwayScore" /></td>
                <td class="nowrap">{{ pickLabel(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}</td><td class="num">{{ pct(p.topPickProbability) }}</td>
                <td><mm-score [home]="p.finalHomeScore" [away]="p.finalAwayScore" [muted]="true" /></td><td><mm-result [value]="p.settlementStatus" /></td>
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
  readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  readonly error = signal('');
  readonly model = signal<AiModel | null>(null);
  readonly breakdowns = signal<{ title: string; rows: BreakdownRow[] }[]>([]);
  readonly recent = signal<PredictionRow[]>([]);
  readonly fmt = fmtDateTime;
  readonly pct = pct;
  readonly humanize = humanize;
  readonly pickLabel = pickLabel;

  constructor() {
    effect(() => this.load(this.id()));
  }

  load(id: string): void {
    this.state.set('loading');
    const f = { modelId: id };
    forkJoin({
      model: this.api.model(id),
      market: this.api.breakdown(f, 'market'),
      type: this.api.breakdown(f, 'type'),
      recent: this.api.predictions(f, { page: 0, size: 15, sort: 'predictedAt,desc' }),
    }).subscribe({
      next: r => {
        this.model.set(r.model);
        this.breakdowns.set([{ title: 'market', rows: r.market }, { title: 'prediction type', rows: r.type }]);
        this.recent.set(r.recent.data);
        this.state.set('ready');
      },
      error: e => { this.model.set(null); this.error.set(apiError(e).message); this.state.set('error'); },
    });
  }
}
