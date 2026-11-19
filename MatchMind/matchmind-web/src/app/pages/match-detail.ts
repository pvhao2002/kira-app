import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { MatchDetail } from '../core/models';
import { fmtDateTime, humanize, pct, pickLabel, statRows } from '../shared/format';
import { ToastService } from '../shared/kit';
import { JsonView, ResultTag, ScoreChip, StateView } from '../shared/ui';

@Component({
  selector: 'mm-match-detail',
  imports: [RouterLink, ScoreChip, ResultTag, StateView, JsonView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <a routerLink="/matches"><i class="pi pi-arrow-left"></i> Matches</a>
      <mm-state [state]="state()" [message]="error()" />
      @if (detail(); as d) {
        <section class="panel">
          <header>
            <div>
              <h2>{{ d.match.homeTeam }} <span class="muted-text" style="display:inline">vs</span> {{ d.match.awayTeam }}</h2>
              <p class="muted-text">{{ d.match.league }} · kick-off {{ fmt(d.match.startTime) }} · {{ d.match.providerName }} · {{ d.match.externalMatchId }}</p>
            </div>
            <div class="row">
              <mm-result [value]="d.match.status" kind="status" />
              @if (auth.isAdmin() && (d.match.status === 'FINISHED' || d.match.status === 'CANCELLED')) {
                <button type="button" class="btn btn-outline btn-sm" [disabled]="settling()" (click)="settle()"><i class="pi" [class.pi-calculator]="!settling()" [class.pi-spinner]="settling()" [class.pi-spin]="settling()"></i> Settle pending picks</button>
              }
            </div>
          </header>
          <div class="row" style="gap:1.5rem">
            <div><span class="cell-sub">Full time</span><mm-score [home]="d.match.finalHomeScore" [away]="d.match.finalAwayScore" /></div>
            <div><span class="cell-sub">Half time</span><mm-score [home]="d.match.htHomeScore" [away]="d.match.htAwayScore" [muted]="true" /></div>
            <div><span class="cell-sub">Corners</span><mm-score [home]="d.match.finalHomeCorners" [away]="d.match.finalAwayCorners" [muted]="true" /></div>
            <div><span class="cell-sub">HT corners</span><mm-score [home]="d.match.htHomeCorners" [away]="d.match.htAwayCorners" [muted]="true" /></div>
            <div><span class="cell-sub">Result updated</span>{{ fmt(d.match.resultUpdatedAt) }}</div>
          </div>
        </section>

        <section class="panel flush">
          <header><h2>Models on this match</h2></header>
          <div class="table-wrap"><table class="dt">
            <thead><tr><th>Model</th><th class="num">Predictions</th><th>Latest</th><th>Predicted score</th><th>Top pick</th><th class="num">Prob.</th>
                <th class="num">Price</th><th>Result</th><th class="num">W / L</th><th class="num">Win rate</th><th class="num">Pending</th></tr></thead>
            <tbody>
              @for (m of d.models; track m.modelId) {
              <tr>
                <td><a [routerLink]="['/models', m.modelId]">{{ m.modelName }}</a> <span class="cell-sub">{{ m.modelVersion }}</span></td>
                <td class="num">{{ m.predictions }}</td>
                <td class="nowrap">
                  @if (m.latest) { <a [routerLink]="['/predictions', m.latest.predictionId]">{{ fmt(m.latest.predictedAt) }}</a>
                    <span class="cell-sub">{{ humanize(m.latest.predictionType) }}{{ m.latest.matchMinute !== null ? ' · ' + m.latest.matchMinute + "'" : '' }}</span> }
                </td>
                <td><mm-score [home]="m.latest?.predictedHomeScore" [away]="m.latest?.predictedAwayScore" [muted]="true" /></td>
                <td class="nowrap">{{ pickLabel(m.latest?.topPickMarket, m.latest?.topPick, m.latest?.topPickLine) }}</td>
                <td class="num">{{ pct(m.latest?.topPickProbability) }}</td>
                <td class="num">{{ m.latest?.topPickPrice ?? '—' }}</td>
                <td><mm-result [value]="m.latest?.topPickResult" /></td>
                <td class="num"><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></td>
                <td class="num">{{ pct(m.winRate) }}</td>
                <td class="num">{{ m.pending }}</td>
              </tr>
              } @empty { <tr><td colspan="11" class="empty">No model has predicted this match yet.</td></tr> }
            </tbody>
          </table></div>
        </section>

        <div class="grid-2">
          <section class="panel">
            <header><h2>Latest live stats</h2>@if (d.latestStats) { <span class="muted-text">{{ d.latestStats.matchMinute ?? '—' }}' · {{ fmt(d.latestStats.predictedAt) }}</span> }</header>
            @if (d.latestStats; as s) {
              <table class="dt"><thead><tr><th>Stat</th><th class="num">{{ d.match.homeTeam }}</th><th class="num">{{ d.match.awayTeam }}</th></tr></thead>
                <tbody>@for (r of statRows(s); track r[0]) { <tr><td>{{ r[0] }}</td><td class="num">{{ r[1] ?? '—' }}</td><td class="num">{{ r[2] ?? '—' }}</td></tr> }</tbody></table>
            } @else { <p class="muted-text">No stats were sent with predictions for this match.</p> }
          </section>
          <section class="panel">
            <header><h2>Result history</h2></header>
            @for (h of d.resultHistory; track h.id) {
              <div style="margin-bottom:.75rem">
                <strong>{{ fmt(h.changedAt) }}</strong> <span class="muted-text" style="display:inline">· {{ h.changeSource }}</span>
                <mm-json [value]="{ previous: h.previousResult, new: h.newResult }" />
              </div>
            } @empty { <p class="muted-text">No result has been reported yet.</p> }
          </section>
        </div>
      }
    </div>`,
})
export class MatchDetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  readonly error = signal('');
  readonly detail = signal<MatchDetail | null>(null);
  readonly settling = signal(false);
  readonly fmt = fmtDateTime;
  readonly pct = pct;
  readonly humanize = humanize;
  readonly statRows = statRows;
  readonly pickLabel = pickLabel;

  constructor() {
    effect(() => this.load(this.id()));
  }

  load(id: string): void {
    this.state.set('loading');
    this.api.match(id).subscribe({
      next: d => { this.detail.set(d); this.state.set('ready'); },
      error: e => { this.detail.set(null); this.error.set(apiError(e).message); this.state.set('error'); },
    });
  }

  settle(): void {
    this.settling.set(true);
    this.api.settleMatch(this.id()).subscribe({
      next: r => {
        this.settling.set(false);
        this.messages.add({ severity: 'success', summary: 'Settled', detail: `${r.settled} settled, ${r.alreadySettled} already settled, ${r.pending} pending.` });
        this.load(this.id());
      },
      error: e => { this.settling.set(false); this.messages.add({ severity: 'error', summary: 'Settlement failed', detail: apiError(e).message }); },
    });
  }
}
