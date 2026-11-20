import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { AdminResultRequest, MATCH_STATUSES, MatchStatus, ResultHistory, ReviewItem, ScorePair } from '../core/models';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { fmtDateTime, humanize, lineSplit, pct, pickText, resultChanges, statRows } from '../shared/format';
import { Dialog, ToastService } from '../shared/kit';
import { JsonView, ResultTag, ScoreChip, StateView } from '../shared/ui';

interface ResultForm {
  status: MatchStatus; finalHome: number | null; finalAway: number | null; htHome: number | null; htAway: number | null;
  cornersHome: number | null; cornersAway: number | null; htCornersHome: number | null; htCornersAway: number | null; reason: string;
}
type PairKey = keyof Omit<ResultForm, 'status' | 'reason'>;
const PAIRS: { label: string; home: PairKey; away: PairKey; field: 'finalScore' | 'halfTimeScore' | 'finalCorners' | 'halfTimeCorners' }[] = [
  { label: 'Final score', home: 'finalHome', away: 'finalAway', field: 'finalScore' },
  { label: 'Half-time score', home: 'htHome', away: 'htAway', field: 'halfTimeScore' },
  { label: 'Corners', home: 'cornersHome', away: 'cornersAway', field: 'finalCorners' },
  { label: 'Half-time corners', home: 'htCornersHome', away: 'htCornersAway', field: 'halfTimeCorners' },
];
const MIN_REASON = 5;

@Component({
  selector: 'mm-match-detail',
  imports: [FormsModule, RouterLink, Dialog, ScoreChip, ResultTag, StateView, JsonView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    h2, .sub, .hist-item { overflow-wrap: anywhere; min-width: 0; }
    .panel > header > div:first-child { min-width: 0; }
    .review-banner { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; }
    .pair { display: flex; align-items: center; gap: .4rem; }
    .pair .input { width: 5rem; }
    .head-actions { flex-wrap: wrap; justify-content: flex-end; }
    .outcome { margin-top: .75rem; }
    fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: .6rem; }
  `],
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
            <div class="row head-actions">
              <mm-result [value]="d.match.status" kind="status" />
              @if (auth.isAdmin()) {
                <button type="button" class="btn btn-outline btn-sm" data-testid="result-open" (click)="openResult()"><i class="pi pi-pencil" aria-hidden="true"></i>
                  {{ d.match.finalHomeScore === null ? 'Enter result' : 'Correct result' }}</button>
                @if (d.match.status === 'FINISHED' || d.match.status === 'CANCELLED') {
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="settling()" (click)="settle()"><i class="pi" [class.pi-calculator]="!settling()" [class.pi-spinner]="settling()" [class.pi-spin]="settling()"></i> Settle pending picks</button>
                }
              }
              <button type="button" class="btn btn-text btn-sm" data-testid="prompt-input-copy" (click)="copyPromptInput()"
                title="Copies the match result and every pick with its id, as the settlement prompt expects"><i class="pi pi-copy" aria-hidden="true"></i> Copy settlement input</button>
            </div>
          </header>
          <div class="facts">
            <div class="fact"><span class="fact-label">Full time</span><mm-score [home]="d.match.finalHomeScore" [away]="d.match.finalAwayScore" /></div>
            <div class="fact"><span class="fact-label">Half time</span><mm-score [home]="d.match.htHomeScore" [away]="d.match.htAwayScore" [muted]="true" /></div>
            <div class="fact"><span class="fact-label">Corners</span><mm-score [home]="d.match.finalHomeCorners" [away]="d.match.finalAwayCorners" [muted]="true" /></div>
            <div class="fact"><span class="fact-label">HT corners</span><mm-score [home]="d.match.htHomeCorners" [away]="d.match.htAwayCorners" [muted]="true" /></div>
            <div class="fact"><span class="fact-label">Result updated</span>{{ fmt(d.match.resultUpdatedAt) }}</div>
          </div>
          @if (outcome()) { <p class="page-note outcome" role="status" data-testid="result-outcome">{{ outcome() }}</p> }
        </section>

        @if (review().length) {
          <section class="panel review-banner" role="status" data-testid="review-badge">
            <span class="tag tag-warn">{{ review().length }} {{ review().length === 1 ? 'pick needs' : 'picks need' }} review</span>
            <span class="muted-text">The result changed after these picks were settled; they would settle differently now. Win rates count the stored result until an admin recalculates.</span>
            @if (auth.isAdmin()) {
              <button type="button" class="btn btn-primary btn-sm" data-testid="review-recalc" (click)="openRecalc()">Recalculate all affected</button>
            }
          </section>
        }

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
                <td class="nowrap" [title]="lineSplit(m.latest?.topPickMarket, m.latest?.topPickLine)">{{ pickText(m.latest?.topPickMarket, m.latest?.topPick, m.latest?.topPickLine) }}</td>
                <td class="num hide-sm">{{ pct(m.latest?.topPickProbability) }}</td>
                <td class="num hide-sm">{{ m.latest?.topPickPrice ?? '—' }}</td>
                <td data-testid="model-result">
                  @if (reviewOf(m.latest?.predictionId, m.latest?.topPickMarket, m.latest?.topPick); as r) {
                    <span class="tag tag-warn" [title]="'Stored ' + humanize(r.currentResult) + ', the corrected result gives ' + humanize(r.newResult)">Needs review</span>
                    <span class="cell-sub">{{ humanize(r.currentResult) }} → {{ humanize(r.newResult) }}</span>
                  } @else { <mm-result [value]="m.latest?.topPickResult" /> }
                </td>
                <td class="num hide-sm"><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></td>
                <td class="num">{{ pct(m.winRate) }}</td>
                <td class="num hide-sm">{{ m.pending }}</td>
              </tr>
              } @empty { <tr><td colspan="11" class="empty">No model has predicted this match yet.</td></tr> }
            </tbody>
          </table></div>
        </section>

        <section class="panel flush" id="prediction-history" data-testid="prediction-history">
          <header><h2>Prediction history ({{ predTotal() }})</h2>
            @if (predTotal() > predictions().length) { <span class="muted-text">Showing the latest {{ predictions().length }}</span> }</header>
          <div class="table-wrap"><table class="dt compact-sm" aria-label="Prediction history">
            <thead><tr><th>Predicted</th><th>Model</th><th class="hide-sm">Type</th><th class="hide-sm">Score then</th><th>Top pick</th><th class="num hide-sm">Prob.</th><th>Result</th></tr></thead>
            <tbody>
              @for (p of predictions(); track p.id) {
              <tr>
                <td class="nowrap"><a [routerLink]="['/predictions', p.id]">{{ fmt(p.predictedAt) }}</a></td>
                <td>{{ p.modelName }} <span class="cell-sub">{{ p.modelVersion }}</span></td>
                <td class="hide-sm">{{ humanize(p.predictionType) }}{{ p.matchMinute !== null ? ' · ' + p.matchMinute + "'" : '' }}</td>
                <td class="hide-sm">@if (p.predictionType === 'LIVE') { <mm-score [home]="p.currentHomeScore" [away]="p.currentAwayScore" [muted]="true" /> } @else { — }</td>
                <td class="nowrap" [title]="lineSplit(p.topPickMarket, p.topPickLine)">{{ pickText(p.topPickMarket, p.topPick, p.topPickLine, p.topPickLineDisplay) }}</td>
                <td class="num hide-sm">{{ pct(p.topPickProbability) }}</td>
                <td><mm-result [value]="p.settlementStatus" /></td>
              </tr>
              } @empty { <tr><td colspan="7" class="empty">No predictions yet.</td></tr> }
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
          <section class="panel" data-testid="result-history">
            <header><h2>Result history</h2></header>
            @for (h of d.resultHistory; track h.id) {
              <div class="hist-item">
                <strong>{{ fmt(h.changedAt) }}</strong> <span class="muted-text">· {{ humanize(h.changeSource) }}@if (who(h)) { · by {{ who(h) }} }</span>
                @if (h.newResult['startTime']) { <span class="tag tag-info">Kick-off moved</span> }
                @if (why(h)) { <div class="muted-text">Reason: {{ why(h) }}</div> }
                @if (changes(h.previousResult, h.newResult); as rows) {
                  @if (rows.length) {
                    <div class="table-wrap"><table class="dt">
                      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                      <tbody>@for (c of rows; track c.field) { <tr><td>{{ c.field }}</td><td class="muted-text">{{ c.before }}</td><td><strong>{{ c.after }}</strong></td></tr> }</tbody>
                    </table></div>
                  } @else { <p class="muted-text">No field changed.</p> }
                }
                <details class="raw"><summary>View JSON</summary><mm-json [value]="{ previous: h.previousResult, new: h.newResult }" /></details>
              </div>
            } @empty { <p class="muted-text">No result has been reported yet.</p> }
          </section>
        </div>
      }
    </div>

    <mm-dialog [open]="resultOpen()" (closed)="resultOpen.set(false)" header="Match result">
      @if (resultOpen()) {
        <form class="stack" (ngSubmit)="submitResult()">
          <p class="muted-text">Saved as an admin result in the result history. FINISHED or CANCELLED settles the pending picks;
            already-settled picks that now differ are flagged for review, never changed silently.</p>
          <div class="field"><label for="res-status">Status</label>
            <select class="input w-full" id="res-status" name="status" [(ngModel)]="resultForm.status" autofocus>
              @for (s of statuses; track s) { <option [ngValue]="s">{{ humanize(s) }}</option> }
            </select></div>
          <fieldset>
            @for (p of pairs; track p.field) {
              <div class="field"><span class="fact-label" [id]="'res-' + p.field">{{ p.label }} (home : away)</span>
                <span class="pair" role="group" [attr.aria-labelledby]="'res-' + p.field">
                  <input class="input" type="number" min="0" step="1" [name]="p.home" [(ngModel)]="resultForm[p.home]" [attr.aria-label]="p.label + ' home'">
                  <span>:</span>
                  <input class="input" type="number" min="0" step="1" [name]="p.away" [(ngModel)]="resultForm[p.away]" [attr.aria-label]="p.label + ' away'">
                </span></div>
            }
          </fieldset>
          <div class="field"><label for="res-reason">Reason (optional)</label>
            <textarea class="input" id="res-reason" name="reason" [(ngModel)]="resultForm.reason" rows="2" maxlength="2000"></textarea></div>
          @if (resultError()) { <div class="field-error" role="alert">{{ resultError() }}</div> }
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="resultOpen.set(false)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="savingResult()">
              @if (savingResult()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Save result</button>
          </div>
        </form>
      }
    </mm-dialog>

    <mm-dialog [open]="recalcOpen()" (closed)="recalcOpen.set(false)" header="Recalculate affected picks">
      @if (recalcOpen()) {
        <form class="stack" (ngSubmit)="recalculateAll()">
          <p class="muted-text">These picks get a new result from the current match result. The old results stay in history, marked superseded:</p>
          <ul class="muted-text">@for (r of review(); track r.pickId) { <li>{{ r.market }} {{ r.pick }}: {{ humanize(r.currentResult) }} → <strong>{{ humanize(r.newResult) }}</strong></li> }</ul>
          <div class="field"><label for="rc-reason">Reason</label>
            <textarea class="input" id="rc-reason" name="reason" [(ngModel)]="recalcReason" rows="3" maxlength="2000" required [attr.minlength]="minReason" autofocus aria-describedby="rc-hint"></textarea>
            <small id="rc-hint" class="muted-text">At least {{ minReason }} characters; it is stored with every new result.</small></div>
          @if (recalcError()) { <div class="field-error" role="alert">{{ recalcError() }}</div> }
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="recalcOpen.set(false)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="recalcPending() || recalcReason.trim().length < minReason">
              @if (recalcPending()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Recalculate {{ review().length }}</button>
          </div>
        </form>
      }
    </mm-dialog>`,
})
export class MatchDetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  readonly auth = inject(AuthService);
  private readonly resource = this.api.matchResource(() => this.id());
  private readonly reviewResource = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.needsReview({ matchId: params }) });
  private readonly predResource = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.predictions({ matchId: params }, { page: 0, size: 100, sort: 'predictedAt,desc' }),
  });
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly detail = safeValue(this.resource);
  readonly review = safeValue(this.reviewResource, []);
  private readonly predPage = safeValue(this.predResource);
  readonly predictions = computed(() => this.predPage()?.data ?? []);
  readonly predTotal = computed(() => this.predPage()?.meta.totalElements ?? 0);
  readonly settling = signal(false);
  readonly resultOpen = signal(false);
  readonly savingResult = signal(false);
  readonly resultError = signal('');
  readonly outcome = signal('');
  readonly recalcOpen = signal(false);
  readonly recalcPending = signal(false);
  readonly recalcError = signal('');
  resultForm: ResultForm = MatchDetailPage.emptyForm();
  recalcReason = '';
  readonly statuses = MATCH_STATUSES;
  readonly pairs = PAIRS;
  readonly minReason = MIN_REASON;
  readonly fmt = fmtDateTime;
  readonly pct = pct;
  readonly humanize = humanize;
  readonly statRows = statRows;
  readonly changes = resultChanges;
  readonly pickText = pickText;
  readonly lineSplit = lineSplit;

  constructor() {
    const title = inject(Title);
    effect(() => { const m = this.detail()?.match; if (m) title.setTitle(`${m.homeTeam} – ${m.awayTeam} · MatchMind`); });
    effect(() => { this.id(); this.outcome.set(''); });
  }

  private static emptyForm(): ResultForm {
    return { status: 'FINISHED', finalHome: null, finalAway: null, htHome: null, htAway: null, cornersHome: null,
      cornersAway: null, htCornersHome: null, htCornersAway: null, reason: '' };
  }

  reviewOf(predictionId: string | undefined, market: string | null | undefined, pick: string | null | undefined): ReviewItem | undefined {
    return this.review().find(r => r.predictionId === predictionId && r.market === market && r.pick === pick);
  }

  who(h: ResultHistory): string { return typeof h.newResult['changedBy'] === 'string' ? h.newResult['changedBy'] : ''; }
  why(h: ResultHistory): string { return typeof h.newResult['reason'] === 'string' ? h.newResult['reason'] : ''; }

  private reload(): void {
    this.resource.reload();
    this.reviewResource.reload();
    this.predResource.reload();
  }

  settle(): void {
    this.settling.set(true);
    this.api.settleMatch(this.id()).subscribe({
      next: r => {
        this.settling.set(false);
        this.messages.add({ severity: 'success', summary: 'Settled', detail: `${r.settled} settled, ${r.alreadySettled} already settled, ${r.pending} pending.` });
        this.reload();
      },
      error: e => { this.settling.set(false); this.messages.add({ severity: 'error', summary: 'Settlement failed', detail: apiError(e).message }); },
    });
  }

  openResult(): void {
    const m = this.detail()?.match;
    if (!m) return;
    this.resultForm = {
      status: m.status === 'SCHEDULED' || m.status === 'LIVE' ? 'FINISHED' : m.status,
      finalHome: m.finalHomeScore, finalAway: m.finalAwayScore, htHome: m.htHomeScore, htAway: m.htAwayScore,
      cornersHome: m.finalHomeCorners, cornersAway: m.finalAwayCorners, htCornersHome: m.htHomeCorners, htCornersAway: m.htAwayCorners,
      reason: '',
    };
    this.resultError.set('');
    this.resultOpen.set(true);
  }

  submitResult(): void {
    if (this.savingResult()) return;   // a double click sends once
    const f = this.resultForm;
    const body: AdminResultRequest = { status: f.status };
    for (const p of PAIRS) {
      const home = f[p.home], away = f[p.away];
      if (home === null && away === null) continue;
      if (home === null || away === null || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
        this.resultError.set(`${p.label}: enter whole numbers of 0 or more for both sides, or leave both empty.`);
        return;
      }
      body[p.field] = { home, away } satisfies ScorePair;
    }
    if (f.status === 'FINISHED' && !body.finalScore) { this.resultError.set('A FINISHED match needs the final score.'); return; }
    if (f.reason.trim()) body.reason = f.reason.trim();
    this.resultError.set('');
    this.savingResult.set(true);
    this.api.enterMatchResult(this.id(), body).subscribe({
      next: r => {
        this.savingResult.set(false);
        this.resultOpen.set(false);
        const s = r.settlement;
        this.outcome.set(!r.changed ? 'Nothing changed: this result was already stored.'
          : s ? `Result saved. Settlement: ${s.settled} settled, ${s.alreadySettled} already settled, ${s.pending} pending, ${s.needsReview} need review.`
          : 'Result saved. Picks settle when the match is Finished or Cancelled.');
        this.reload();
      },
      error: e => {
        this.savingResult.set(false);
        const err = apiError(e);
        this.resultError.set([err.message, ...Object.entries(err.fieldErrors ?? {}).map(([k, v]) => `${k}: ${v}`)].join(' '));
      },
    });
  }

  openRecalc(): void {
    this.recalcReason = '';
    this.recalcError.set('');
    this.recalcOpen.set(true);
  }

  recalculateAll(): void {
    if (this.recalcPending() || this.recalcReason.trim().length < MIN_REASON) return;
    this.recalcPending.set(true);
    this.api.recalculateMatch(this.id(), this.recalcReason.trim()).subscribe({
      next: rows => {
        this.recalcPending.set(false);
        this.recalcOpen.set(false);
        this.messages.add({ severity: 'success', summary: 'Recalculated', detail: `${rows.length} ${rows.length === 1 ? 'pick' : 'picks'} recalculated.` });
        this.reload();
      },
      error: e => { this.recalcPending.set(false); this.recalcError.set(apiError(e).message); },
    });
  }

  copyPromptInput(): void {
    this.api.settlementPromptInput(this.id()).subscribe({
      next: x => this.messages.copy(JSON.stringify(x, null, 2), 'settlement input'),
      error: e => this.messages.add({ severity: 'error', summary: 'Copy failed', detail: apiError(e).message }),
    });
  }
}
