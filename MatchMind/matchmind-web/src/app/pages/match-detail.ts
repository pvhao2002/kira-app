import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { changedFields, fmtDateTime, humanize, pct, pickLabel, statRows } from '../shared/format';
import { ToastService } from '../shared/kit';
import { JsonView, ResultTag, ScoreChip, StateView } from '../shared/ui';

@Component({
  selector: 'mm-match-detail',
  imports: [RouterLink, ScoreChip, ResultTag, StateView, JsonView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <a routerLink="/matches" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i> Matches</a>
      <mm-state [state]="state()" [message]="error()" />
      @if (detail(); as d) {
        <section class="panel">
          <header>
            <div>
              <h2>{{ d.match.homeTeam }} <span class="muted-text">vs</span> {{ d.match.awayTeam }}</h2>
              <p class="muted-text sub">{{ d.match.league }} · kick-off {{ fmt(d.match.startTime) }} · {{ d.match.providerName }} · {{ d.match.externalMatchId }}</p>
            </div>
            <div class="row">
              <mm-result [value]="d.match.status" kind="status" />
              @if (auth.isAdmin() && (d.match.status === 'FINISHED' || d.match.status === 'CANCELLED')) {
                <button type="button" class="btn btn-outline btn-sm" [disabled]="settling()" (click)="settle()"><i class="pi" [class.pi-calculator]="!settling()" [class.pi-spinner]="settling()" [class.pi-spin]="settling()"></i> Settle pending picks</button>
              }
            </div>
          </header>
          <div class="facts">
            <div class="fact"><span class="fact-label">Full time</span><mm-score [home]="d.match.finalHomeScore" [away]="d.match.finalAwayScore" /></div>
            <div class="fact"><span class="fact-label">Half time</span><mm-score [home]="d.match.htHomeScore" [away]="d.match.htAwayScore" [muted]="true" /></div>
            <div class="fact"><span class="fact-label">Corners</span><mm-score [home]="d.match.finalHomeCorners" [away]="d.match.finalAwayCorners" [muted]="true" /></div>
            <div class="fact"><span class="fact-label">HT corners</span><mm-score [home]="d.match.htHomeCorners" [away]="d.match.htAwayCorners" [muted]="true" /></div>
            <div class="fact"><span class="fact-label">Result updated</span>{{ fmt(d.match.resultUpdatedAt) }}</div>
          </div>
        </section>

        <section class="panel flush">
          <header><h2>Models on this match</h2></header>
          <div class="table-wrap"><table class="dt compact-sm">
            <thead><tr><th>Model</th><th class="num hide-sm">Predictions</th><th class="hide-sm">Latest</th><th class="hide-sm">Predicted score</th><th>Top pick</th><th class="num hide-sm">Prob.</th>
                <th class="num hide-sm">Price</th><th>Result</th><th class="num hide-sm">W / L</th><th class="num" title="(Win + half win) divided by settled picks. Push and void are left out.">Win rate</th><th class="num hide-sm">Pending</th></tr></thead>
            <tbody>
              @for (m of d.models; track m.modelId) {
              <tr>
                <td><a [routerLink]="['/models', m.modelId]">{{ m.modelName }}</a> <span class="cell-sub">{{ m.modelVersion }}</span>
                  @if (m.latest) { <a class="cell-sub show-sm" [routerLink]="['/predictions', m.latest.predictionId]">{{ fmt(m.latest.predictedAt) }}</a> }</td>
                <td class="num hide-sm">{{ m.predictions }}</td>
                <td class="nowrap hide-sm">
                  @if (m.latest) { <a [routerLink]="['/predictions', m.latest.predictionId]">{{ fmt(m.latest.predictedAt) }}</a>
                    <span class="cell-sub">{{ humanize(m.latest.predictionType) }}{{ m.latest.matchMinute !== null ? ' · ' + m.latest.matchMinute + "'" : '' }}</span> }
                </td>
                <td class="hide-sm"><mm-score [home]="m.latest?.predictedHomeScore" [away]="m.latest?.predictedAwayScore" [muted]="true" /></td>
                <td class="nowrap">{{ pickLabel(m.latest?.topPickMarket, m.latest?.topPick, m.latest?.topPickLine) }}</td>
                <td class="num hide-sm">{{ pct(m.latest?.topPickProbability) }}</td>
                <td class="num hide-sm">{{ m.latest?.topPickPrice ?? '—' }}</td>
                <td><mm-result [value]="m.latest?.topPickResult" /></td>
                <td class="num hide-sm"><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></td>
                <td class="num">{{ pct(m.winRate) }}</td>
                <td class="num hide-sm">{{ m.pending }}</td>
              </tr>
              } @empty { <tr><td colspan="11" class="empty">No model has predicted this match yet.</td></tr> }
            </tbody>
          </table></div>
        </section>

        <div class="grid-2 align-start">
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
              <div class="hist-item">
                <strong>{{ fmt(h.changedAt) }}</strong> <span class="muted-text">· {{ humanize(h.changeSource) }}</span>
                @if (changes(h.previousResult, h.newResult); as rows) {
                  @if (rows.length) {
                    <div class="table-wrap"><table class="dt">
                      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                      <tbody>@for (c of rows; track c.field) { <tr><td>{{ c.field }}</td><td class="muted-text">{{ c.before }}</td><td><strong>{{ c.after }}</strong></td></tr> }</tbody>
                    </table></div>
                  } @else { <p class="muted-text">No field changed.</p> }
                }
                <details class="raw"><summary>Raw JSON</summary><mm-json [value]="{ previous: h.previousResult, new: h.newResult }" /></details>
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
  private readonly resource = this.api.matchResource(() => this.id());
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly detail = safeValue(this.resource);
  readonly settling = signal(false);
  readonly fmt = fmtDateTime;
  readonly pct = pct;
  readonly humanize = humanize;
  readonly statRows = statRows;
  readonly changes = changedFields;
  readonly pickLabel = pickLabel;

  settle(): void {
    this.settling.set(true);
    this.api.settleMatch(this.id()).subscribe({
      next: r => {
        this.settling.set(false);
        this.messages.add({ severity: 'success', summary: 'Settled', detail: `${r.settled} settled, ${r.alreadySettled} already settled, ${r.pending} pending.` });
        this.resource.reload();
      },
      error: e => { this.settling.set(false); this.messages.add({ severity: 'error', summary: 'Settlement failed', detail: apiError(e).message }); },
    });
  }
}
