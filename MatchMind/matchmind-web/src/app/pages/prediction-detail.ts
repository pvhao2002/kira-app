import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { PageTitle } from '../core/page-title';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { PickDetail, PickResultRow, PredictionDetail } from '../core/models';
import {
  basisNote, bidiSafe, extraStatRows, fmtDateTime, humanize, lineSplit, lineText, num, pct, pickText, probabilityTables, score, settlementSentence, statRows,
} from '../shared/format';
import { Dialog, Expansion, Tabs, ToastService } from '../shared/kit';
import { Select, SelectOption } from '../shared/select';
import { ParlaySlip } from '../shared/parlay-slip';
import { JsonView, ResultTag, ScoreChip, StateView } from '../shared/ui';

type Action = { kind: 'recalculate' | 'override'; pick: PickDetail };
const MIN_REASON = 5;

@Component({
  selector: 'mm-prediction-detail',
  imports: [FormsModule, RouterLink, Dialog, Tabs, JsonView, ResultTag, ScoreChip, StateView, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    h2, .sub, .hist-item { overflow-wrap: anywhere; min-width: 0; }
    .panel > header > div:first-child { min-width: 0; }
    .review-banner { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; }
    .actions { white-space: nowrap; }
    /* UX-071: at phone width the pick, result and admin actions fit without scrolling sideways. */
    @media (max-width: 640px) {
      .actions { white-space: normal; }
      .actions .btn { display: block; padding-inline: .25rem; }
    }
    .prob-tables { display: flex; flex-wrap: wrap; gap: 1rem; }
    .prob-tables > .table-wrap { flex: 1 1 14rem; }
    .sentence { margin: .35rem 0 0; }
    .sentence, .reason { max-width: 80ch; }
    .similar { list-style: none; margin: 0; padding: 0; }
    .similar li { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .6rem; }
    .sub-h.first { margin-top: 0; }
  `],
  template: `
    <div class="stack">
      <a routerLink="/predictions" class="back-link"><i class="pi pi-arrow-left" aria-hidden="true"></i> Predictions</a>
      <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      @if (detail(); as d) {
        <section class="panel">
          <header>
            <div>
              <h2><a [routerLink]="['/matches', d.match.id]">{{ bidi(d.match.homeTeam) }} – {{ bidi(d.match.awayTeam) }}</a></h2>
              <p class="muted-text sub">{{ bidi(d.match.league) }} · @if (d.model) { {{ bidi(d.model.name) }} {{ bidi(d.model.version) }} · }predicted {{ fmt(d.predictedAt) }} · event {{ d.eventId }}</p>
            </div>
            <mm-result [value]="d.match.status" kind="status" />
          </header>
          <div class="facts">
            <div class="fact"><span class="fact-label">Type</span>{{ humanize(d.predictionType) }}{{ d.matchMinute !== null ? ' · ' + d.matchMinute + "'" : '' }}</div>
            @if (d.predictionType === 'LIVE') {
              <div class="fact"><span class="fact-label">Score at prediction</span><mm-score [home]="d.currentHomeScore" [away]="d.currentAwayScore" [muted]="true" /></div>
              <div class="fact"><span class="fact-label">Corners at prediction</span>{{ score(d.currentHomeCorners, d.currentAwayCorners) }}</div>
            }
            <div class="fact"><span class="fact-label">Most likely score</span><span class="row"><mm-score [home]="d.correctScores[0]?.home" [away]="d.correctScores[0]?.away" /> {{ pct(d.correctScores[0]?.probability) }}</span></div>
            <div class="fact"><span class="fact-label">Final</span><mm-score [home]="d.match.finalHomeScore" [away]="d.match.finalAwayScore" [muted]="d.match.status !== 'FINISHED'" /></div>
            <div class="fact"><span class="fact-label">Final corners</span>{{ score(d.match.finalHomeCorners, d.match.finalAwayCorners) }}</div>
          </div>
        </section>

        @if (reviewFailed()) {
          <div class="alert alert-warn" role="alert" data-testid="review-failed">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            <span>Couldn't check whether picks need review, so review flags may be missing.</span>
            <button type="button" class="btn btn-outline btn-sm" (click)="reviewResource.reload()">Retry</button>
          </div>
        }
        @if (review().length) {
          <section class="panel review-banner" role="status" data-testid="review-badge">
            <span class="tag tag-warn">{{ review().length }} {{ review().length === 1 ? 'pick needs' : 'picks need' }} review</span>
            <span class="muted-text">The match result changed after settlement; the flagged picks would settle differently now.
              @if (auth.isAdmin()) { Recalculate them here, or all picks of the match on the <a [routerLink]="['/matches', d.match.id]">match page</a>. }</span>
          </section>
        }

        @if (d.counted === false) {
          <div class="alert alert-info" role="status" data-testid="not-counted">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
            <span>Not counted in reports: superseded by
              @if (supersededBy(d); as s) { <a [routerLink]="['/predictions', s.predictionId]">the prediction of {{ fmt(s.predictedAt) }}</a> }
              @else { a later prediction } of the same match, model, type and minute.</span>
          </div>
        }
        @if (d.similar?.length) {
          <section class="panel" aria-label="Similar predictions" data-testid="similar">
            <header><h2>Similar predictions</h2><span class="muted-text">Same match, model, type and minute; reports count only the latest.</span></header>
            <ul class="similar">
              @for (s of d.similar; track s.predictionId) {
                <li class="hist-item"><a [routerLink]="['/predictions', s.predictionId]">{{ fmt(s.predictedAt) }}</a>
                  @if (s.exact) { <span class="tag tag-warn" title="Same content apart from eventId, predictedAt and metadata">same content</span> }
                  @if (s.counted) { <span class="tag tag-success">counted</span> } @else { <span class="tag tag-secondary">not counted</span> }</li>
              }
            </ul>
          </section>
        }

        <section class="panel">
        <mm-tabs controls="prediction-panel" [tabs]="tabList()" [(value)]="tab" />
        <div class="tabpanel" id="prediction-panel" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab()">
          @switch (tab()) {
            @case ('picks') {
              @if (auth.isAdmin() && !isFinal()) {
                <p class="page-note mb-2" id="pick-actions-note" data-testid="actions-note">Override needs a Finished or Cancelled match: enter the final result first. Recalculate waits for it too while a pick is pending.</p>
              }
              <div class="table-wrap"><table class="dt compact-sm" aria-label="Picks">
                <thead>
                  <tr><th class="th-icon"><span class="sr-only">Details</span></th><th class="num hide-sm">#</th><th class="hide-sm">Market</th><th>Pick</th><th class="num">Line</th><th class="hide-sm">Stage</th>
                    <th class="num hide-sm">Prob.</th><th class="num hide-sm">Price</th><th>Result</th><th class="hide-sm">Settled by</th><th><span class="sr-only">Parlay</span></th>@if (auth.isAdmin()) { <th><span class="sr-only">Actions</span></th> }</tr>
                </thead>
                <tbody>
                  @for (p of d.picks; track p.id) {
                  <tr data-testid="pick-row">
                    <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="expanded.has(p.id)" [attr.aria-controls]="'pick-hist-' + p.id" (click)="expanded.toggle(p.id)"
                      [attr.aria-label]="expanded.has(p.id) ? 'Hide settlement history' : 'Show settlement history'">
                      <i class="pi" [class.pi-chevron-down]="expanded.has(p.id)" [class.pi-chevron-right]="!expanded.has(p.id)"></i></button></td>
                    <td class="num hide-sm">{{ p.rank }}</td>
                    <td class="hide-sm">{{ p.market }}</td>
                    <td><span class="show-sm">{{ p.market }} </span>{{ p.pick }}
                      @if (noteOf(p); as n) { <span class="cell-sub" [title]="'Settles on the remaining match: only what happens after the odds were captured counts'">{{ n }}</span> }</td>
                    <td class="num" [title]="lineSplit(p.market, p.line)">{{ lineText(p.market, p.line) }}</td>
                    <td class="hide-sm">{{ humanize(p.stage) }}</td>
                    <td class="num hide-sm">{{ pct(p.probability) }}</td>
                    <td class="num hide-sm">{{ num(p.price) }}</td>
                    <td>
                      @if (reviewOf(p.id); as r) {
                        <span class="tag tag-warn" data-testid="pick-review" [title]="'Stored ' + humanize(r.currentResult) + ', the corrected result gives ' + humanize(r.newResult)">Needs review</span>
                        <span class="cell-sub">{{ humanize(r.currentResult) }} → {{ humanize(r.newResult) }}</span>
                      } @else { <mm-result [value]="p.settlementStatus" /> }
                    </td>
                    <td class="hide-sm">{{ currentSource(p) }}</td>
                    <td>@if (p.price) {
                      <button type="button" class="btn btn-sm" data-testid="add-parlay" [class.btn-primary]="slip.has(p.id)"
                        [attr.aria-pressed]="slip.has(p.id)" (click)="toggleParlay(d, p)">
                        <i class="pi" [class.pi-check]="slip.has(p.id)" [class.pi-plus]="!slip.has(p.id)" aria-hidden="true"></i>
                        {{ slip.has(p.id) ? 'In parlay' : 'Add to parlay' }}</button>
                    }</td>
                    @if (auth.isAdmin()) {
                      <td class="actions">
                        <button type="button" class="btn btn-text btn-sm" data-testid="recalculate" [attr.aria-describedby]="isFinal() ? null : 'pick-actions-note'" (click)="open('recalculate', p)" [disabled]="!isFinal() && p.settlementStatus === 'PENDING'">Recalculate</button>
                        <button type="button" class="btn btn-text btn-sm quiet" data-testid="override" [attr.aria-describedby]="isFinal() ? null : 'pick-actions-note'" (click)="open('override', p)" [disabled]="!isFinal()"
                          [title]="isFinal() ? 'Set the result by hand, with a reason' : 'Enter the final result of the match first: overrides need a Finished or Cancelled match'">Override</button>
                      </td>
                    }
                  </tr>
                  @if (expanded.has(p.id)) {
                  <tr class="expanded" [id]="'pick-hist-' + p.id"><td [attr.colspan]="auth.isAdmin() ? 12 : 11">
                    @for (r of p.results; track r.id; let i = $index) {
                      <div class="hist-item">
                        <mm-result [value]="r.result" /> <strong>{{ humanize(r.source) }}</strong>@if (actedBy(r)) { by {{ actedBy(r) }} } · {{ fmt(r.settledAt) }} · {{ r.calculationVersion }}
                        @if (unchanged(p.results, i)) { <span class="tag tag-secondary" title="Recalculated with the same result; the reason is recorded">Unchanged</span> }
                        @if (!r.current) { <span class="muted-text"> · superseded {{ fmt(r.supersededAt) }}</span> }
                        <p class="sentence">{{ sentence(r.details, r.result) }}</p>
                        @if (r.reason) { <div class="muted-text reason">Reason: {{ r.reason }}</div> }
                        <details class="raw"><summary>View JSON</summary><mm-json [value]="r.details" /></details>
                      </div>
                    } @empty { <p class="muted-text">Not settled yet. It settles automatically when the match result arrives.</p> }
                  </td></tr>
                  }
                  } @empty { <tr><td [attr.colspan]="auth.isAdmin() ? 12 : 11" class="empty">No picks.</td></tr> }
                </tbody>
              </table></div>
            }
            @case ('odds') {
              <div class="table-wrap"><table class="dt compact-sm" aria-label="Odds">
                <thead>
                  <tr><th class="hide-sm">Ref</th><th>Stage</th><th class="num hide-sm" title="Snapshot number within the stage">#</th><th class="num">Line</th><th class="num">Home</th><th class="num">Draw</th><th class="num">Away</th>
                    <th class="num">Over</th><th class="num">Under</th><th class="hide-sm">Basis</th><th>At capture</th><th class="hide-sm">Captured</th></tr>
                </thead>
                <tbody>
                  @for (g of oddsGroups(); track g.market) {
                    <tr><td colspan="12" class="group-cell">{{ g.market }}</td></tr>
                    @for (o of g.rows; track $index) {
                    <tr>
                      <td class="hide-sm">{{ o.ref }}</td><td>{{ humanize(o.stage) }}</td><td class="num hide-sm">{{ o.snapshotOrder }}</td>
                      <td class="num" [title]="lineSplit(o.market, o.line) || o.lineDisplay || ''">{{ lineText(o.market, o.line, o.lineDisplay) }}</td>
                      <td class="num">{{ num(o.homeOdds) }}</td><td class="num">{{ num(o.drawOdds) }}</td><td class="num">{{ num(o.awayOdds) }}</td>
                      <td class="num">{{ num(o.overOdds) }}</td><td class="num">{{ num(o.underOdds) }}</td>
                      <td class="hide-sm">{{ humanize(o.settlementBasis) }}</td>
                      <td>@if (o.homeScoreAtCapture !== null) { <mm-score [home]="o.homeScoreAtCapture" [away]="o.awayScoreAtCapture" [muted]="true" /> } @else { — }</td>
                      <td class="nowrap hide-sm">{{ fmt(o.capturedAt) }}</td>
                    </tr>
                    }
                  } @empty { <tr><td colspan="12" class="empty">No odds were sent with this prediction.</td></tr> }
                </tbody>
              </table></div>
            }
            @case ('scores') {
              <div class="table-wrap"><table class="dt" aria-label="Correct scores">
                <thead><tr><th class="num">Rank</th><th>Score</th><th class="num">Probability</th></tr></thead>
                <tbody>
                  @for (c of d.correctScores; track c.rank) { <tr><td class="num">{{ c.rank }}</td><td><mm-score [home]="c.home" [away]="c.away" /></td><td class="num">{{ pct(c.probability) }}</td></tr> }
                  @empty { <tr><td colspan="3" class="empty">No correct-score prediction.</td></tr> }
                </tbody>
              </table></div>
            }
            @case ('stats') {
              @if (d.stats; as s) {
                <div class="table-wrap"><table class="dt" aria-label="Stats">
                  <thead><tr><th>Stat</th><th class="num">{{ bidi(d.match.homeTeam) }}</th><th class="num">{{ bidi(d.match.awayTeam) }}</th></tr></thead>
                  <tbody>@for (r of statRows(); track r[0]) { <tr><td>{{ r[0] }}</td><td class="num">{{ r[1] ?? '—' }}</td><td class="num">{{ r[2] ?? '—' }}</td></tr> }</tbody>
                </table></div>
                @if (extraStats(); as x) {
                  @if (x.rows.length) {
                    <h3 class="sub-h">Other stats</h3>
                    <div class="table-wrap"><table class="dt" aria-label="Other stats">
                      <thead><tr><th>Stat</th><th class="num">{{ bidi(d.match.homeTeam) }}</th><th class="num">{{ bidi(d.match.awayTeam) }}</th></tr></thead>
                      <tbody>@for (r of x.rows; track r[0]) { <tr><td>{{ r[0] }}</td><td class="num">{{ r[1] ?? '—' }}</td><td class="num">{{ r[2] ?? '—' }}</td></tr> }</tbody>
                    </table></div>
                  }
                  @if (x.rest) { <h3 class="sub-h">More stats</h3><mm-json [value]="x.rest" /> }
                }
              } @else { <p class="muted-text">No stats were sent with this prediction.</p> }
            }
            @case ('sim') {
              @if (d.simulation; as s) {
                <div class="grid-2">
                  <dl class="dl">
                    <dt>Method</dt><dd>{{ s.method }}</dd>
                    <dt>Iterations</dt><dd>{{ int(s.simulationCount) }}</dd>
                    <dt>Seed</dt><dd>{{ s.randomSeed ?? '—' }}</dd>
                    <dt>Algorithm</dt><dd>{{ s.algorithmVersion ?? '—' }}</dd>
                    <dt>Expected remaining goals</dt><dd>{{ num(s.expectedRemainingHomeGoals) }} – {{ num(s.expectedRemainingAwayGoals) }}</dd>
                    <dt>Expected remaining corners</dt><dd>{{ num(s.expectedRemainingHomeCorners) }} – {{ num(s.expectedRemainingAwayCorners) }}</dd>
                  </dl>
                  <div><h3 class="sub-h first">Probabilities</h3>
                    <div class="prob-tables">
                      @for (t of probTables(); track t.market) {
                        <div class="table-wrap"><table class="dt" [attr.aria-label]="(t.market || 'Outcome') + ' probabilities'">
                          <thead><tr><th>{{ t.market || 'Outcome' }}</th><th class="num">Probability</th></tr></thead>
                          <tbody>@for (r of t.rows; track r.outcome) { <tr><td>{{ r.outcome }}</td><td class="num">{{ pct(r.probability) }}</td></tr> }</tbody>
                        </table></div>
                      } @empty { @if (!s.probabilities) { <p class="muted-text">Not provided</p> } }
                    </div>
                    @if (s.probabilities) { <details class="raw"><summary>View JSON</summary><mm-json [value]="s.probabilities" /></details> }
                  </div>
                </div>
                @if (s.correctScoreDistribution?.length) {
                  <h3 class="sub-h">Score distribution</h3>
                  <div class="table-wrap short"><table class="dt" aria-label="Score distribution">
                    <thead><tr><th>Score</th><th class="num">Probability</th></tr></thead>
                    <tbody>@for (c of s.correctScoreDistribution!; track $index) { <tr><td><mm-score [home]="c.home" [away]="c.away" [muted]="true" /></td><td class="num">{{ pct(c.probability) }}</td></tr> }</tbody>
                  </table></div>
                }
                <h3 class="sub-h">Parameters</h3><mm-json [value]="s.parameters" />
              } @else { <p class="muted-text">No simulation was sent with this prediction.</p> }
            }
            @case ('raw') {
              <h3 class="sub-h first">Request payload</h3><mm-json [value]="d.payload" />
              <h3 class="sub-h">Metadata</h3><mm-json [value]="d.metadata" />
            }
          }
        </div>
        </section>
      }
    </div>

    <mm-dialog [open]="!!action()" [busy]="saving()" (closed)="action.set(null)" [header]="action()?.kind === 'override' ? 'Override result' : 'Recalculate result'">
      @if (action(); as a) {
        <form class="stack" (ngSubmit)="submitAction()">
          <p class="muted-text">{{ a.pick.market }} {{ a.pick.pick }} {{ lineText(a.pick.market, a.pick.line) }} — current: {{ humanize(a.pick.settlementStatus) }}.
            The current result is kept in history and marked superseded.</p>
          <p class="page-note" data-testid="impact">{{ impact(a) }}</p>
          @if (a.kind === 'override') {
            <div class="field"><label for="ov-result">New result</label>
              <mm-select class="w-full" id="ov-result" name="result" [(ngModel)]="overrideResult" required autofocus placeholder="Choose a result" [options]="overrideOptions" /></div>
          }
          <!-- UX-032: the dialog opens on its first field, not on Close. -->
          <div class="field"><label for="ov-reason">Reason</label>
            <textarea class="input" id="ov-reason" name="reason" [(ngModel)]="reason" rows="3" maxlength="2000" required [attr.minlength]="minReason"
              aria-describedby="ov-hint" [attr.autofocus]="a.kind === 'recalculate' ? '' : null"></textarea>
            @if (submitBlocker(a); as why) { <small id="ov-hint" class="muted-text">{{ why }}</small> }</div>
          @if (actionError()) { <div class="field-error" role="alert">{{ actionError() }}</div> }
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="action.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving() || !!submitBlocker(a)">
              @if (saving()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } {{ a.kind === 'override' ? 'Save override' : 'Recalculate' }}</button>
          </div>
        </form>
      }
    </mm-dialog>`,
})
export class PredictionDetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  readonly auth = inject(AuthService);
  protected readonly resource = this.api.predictionResource(() => this.id());
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  /** The counted prediction of the same key, i.e. the one that supersedes this one (UX-046). */
  supersededBy(d: PredictionDetail) { return d.similar?.find(x => x.counted); }
  readonly detail = safeValue(this.resource);
  readonly action = signal<Action | null>(null);
  readonly saving = signal(false);
  readonly tab = signal('picks');
  readonly expanded = new Expansion();
  readonly tabList = computed(() => {
    const d = this.detail();
    return [
      { value: 'picks', label: `Picks (${d?.picks.length ?? 0})` }, { value: 'odds', label: `Odds (${d?.odds.length ?? 0})` },
      { value: 'scores', label: 'Correct scores' }, { value: 'stats', label: 'Stats' }, { value: 'sim', label: 'Monte Carlo' },
      { value: 'raw', label: 'Raw payload' },
    ];
  });
  /** Odds grouped by market, in first-seen order. */
  readonly oddsGroups = computed(() => {
    const groups = new Map<string, PredictionDetail['odds']>();
    for (const o of this.detail()?.odds ?? []) groups.set(o.market, [...(groups.get(o.market) ?? []), o]);
    return [...groups].map(([market, rows]) => ({ market, rows }));
  });
  readonly actionError = signal('');
  readonly overrideOptions: SelectOption[] = ['WIN', 'HALF_WIN', 'PUSH', 'HALF_LOSS', 'LOSS', 'VOID'].map(r => ({ label: humanize(r), value: r }));
  reason = '';
  overrideResult: string | null = null;
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly pct = pct;
  readonly num = num;
  readonly slip = inject(ParlaySlip);

  /** Adds the pick to the draft parlay (replacing another pick of this match), or takes it out again. */
  toggleParlay(d: PredictionDetail, p: PickDetail): void {
    this.slip.toggle({ pickId: p.id, matchId: d.match.id, match: `${d.match.homeTeam} – ${d.match.awayTeam}`,
      pick: pickText(p.market, p.pick, p.line), price: Number(p.price) });
  }
  /** A count with thousands separators (100000 becomes 100,000). */
  readonly int = (n: number): string => n.toLocaleString();
  readonly lineText = lineText;
  readonly score = score;
  readonly lineSplit = lineSplit;
  readonly bidi = bidiSafe;
  readonly sentence = settlementSentence;
  readonly minReason = MIN_REASON;
  protected readonly reviewResource = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.needsReview({ predictionId: params }) });
  readonly review = safeValue(this.reviewResource, []);
  readonly reviewFailed = computed(() => !!this.reviewResource.error());
  readonly isFinal = computed(() => ['FINISHED', 'CANCELLED'].includes(this.detail()?.match.status ?? ''));

  readonly statRows = computed(() => {
    const s = this.detail()?.stats;
    return s ? statRows(s) : [];
  });
  readonly extraStats = computed(() => extraStatRows(this.detail()?.stats?.extra));
  readonly probTables = computed(() => probabilityTables(this.detail()?.simulation?.probabilities));

  constructor() {
    effect(() => { this.id(); this.expanded.clear(); }); // another prediction: collapse the opened rows
    const title = inject(PageTitle);
    effect(() => { const m = this.detail()?.match; if (m) title.set(`${bidiSafe(m.homeTeam)} – ${bidiSafe(m.awayTeam)}`); });
  }

  reviewOf(pickId: string) { return this.review().find(r => r.pickId === pickId); }

  /** UX-095: "Goals after 55' from 1–0" for a pick settled on the remaining match. */
  noteOf(p: PickDetail): string {
    const o = this.detail()?.odds.find(x => x.id === p.oddsId);
    if (!o) return '';
    const corner = p.market.startsWith('CORNER_');
    return basisNote(o.settlementBasis, p.market, corner ? o.homeCornersAtCapture : o.homeScoreAtCapture,
      corner ? o.awayCornersAtCapture : o.awayScoreAtCapture, this.detail()?.matchMinute);
  }

  actedBy(r: PickResultRow): string { return typeof r.details?.['actedBy'] === 'string' ? r.details['actedBy'] : ''; }

  /** UX-034: a recalculation that kept the result still writes a row; the row below it (older) has the same result. */
  unchanged(rows: PickResultRow[], i: number): boolean { return i + 1 < rows.length && rows[i + 1].result === rows[i].result; }

  /** UX-032: what the action will do, shown before submitting. */
  impact(a: Action): string {
    const now = humanize(a.pick.settlementStatus);
    if (a.kind === 'override') {
      return `Replaces ${now} with the result you choose. Win rates and reports count it from now on; a later recalculation replaces it again.`;
    }
    const r = this.reviewOf(a.pick.id);
    return r ? `The match result changed: this pick will become ${humanize(r.newResult)} (now ${now}).`
      : `Runs the engine again on the current match result. If it gives ${now} again, the pick stays ${now} and the reason is still recorded.`;
  }

  /** Why the submit button is disabled; '' when it can be sent. */
  submitBlocker(a: Action): string {
    if (a.kind === 'override' && !this.overrideResult) return 'Choose the new result.';
    const n = this.reason.trim().length;
    return n < MIN_REASON ? `Enter a reason of at least ${MIN_REASON} characters (${n}/${MIN_REASON}).` : '';
  }

  currentSource(p: PickDetail): string {
    const r = p.results.find(x => x.current);
    return r ? humanize(r.source) : '—';
  }

  open(kind: Action['kind'], pick: PickDetail): void {
    this.reason = '';
    this.overrideResult = null;
    this.actionError.set('');
    this.action.set({ kind, pick });
  }

  submitAction(): void {
    const a = this.action();
    if (!a || this.saving() || this.submitBlocker(a)) return;   // UX-109: a double click sends once
    this.saving.set(true);
    const call = a.kind === 'override'
      ? this.api.overridePick(a.pick.id, this.overrideResult!, this.reason.trim())
      : this.api.recalculatePick(a.pick.id, this.reason.trim());
    call.subscribe({
      next: r => {
        this.saving.set(false);
        if (this.action() === a) this.action.set(null);
        const summary = r.status === 'UNCHANGED' ? (a.kind === 'override' ? 'Already this result' : 'Recalculated, result unchanged')
          : a.kind === 'override' ? 'Override saved' : r.status === 'UNSETTLED' ? 'Back to pending' : 'Recalculated';
        this.messages.add({ severity: 'success', summary, detail: `${r.market} ${r.pick}: ${humanize(r.result)}` });
        this.expanded.clear();
        this.resource.reload();
        this.reviewResource.reload();
      },
      error: e => { this.saving.set(false); this.actionError.set(apiError(e).message); },
    });
  }
}
