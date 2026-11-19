import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { PickDetail, PredictionDetail } from '../core/models';
import { fmtDateTime, humanize, line, num, pct, statRows } from '../shared/format';
import { Dialog, Expansion, Tabs, ToastService } from '../shared/kit';
import { JsonView, ResultTag, ScoreChip, StateView } from '../shared/ui';

type Action = { kind: 'recalculate' | 'override'; pick: PickDetail };

@Component({
  selector: 'mm-prediction-detail',
  imports: [FormsModule, RouterLink, Dialog, Tabs, JsonView, ResultTag, ScoreChip, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <a routerLink="/predictions"><i class="pi pi-arrow-left"></i> Predictions</a>
      <mm-state [state]="state()" [message]="error()" />
      @if (detail(); as d) {
        <section class="panel">
          <header>
            <div>
              <h2><a [routerLink]="['/matches', d.match.id]">{{ d.match.homeTeam }} – {{ d.match.awayTeam }}</a></h2>
              <p class="muted-text">{{ d.match.league }} · {{ d.model.name }} {{ d.model.version }} · predicted {{ fmt(d.predictedAt) }} · event {{ d.eventId }}</p>
            </div>
            <mm-result [value]="d.match.status" kind="status" />
          </header>
          <div class="row" style="gap:1.5rem">
            <div><span class="cell-sub">Type</span>{{ humanize(d.predictionType) }}{{ d.matchMinute !== null ? ' · ' + d.matchMinute + "'" : '' }}</div>
            @if (d.predictionType === 'LIVE') {
              <div><span class="cell-sub">Score at prediction</span><mm-score [home]="d.currentHomeScore" [away]="d.currentAwayScore" [muted]="true" /></div>
              <div><span class="cell-sub">Corners at prediction</span>{{ d.currentHomeCorners ?? '–' }} : {{ d.currentAwayCorners ?? '–' }}</div>
            }
            <div><span class="cell-sub">Most likely score</span><mm-score [home]="d.correctScores[0]?.home" [away]="d.correctScores[0]?.away" /> {{ pct(d.correctScores[0]?.probability) }}</div>
            <div><span class="cell-sub">Final</span><mm-score [home]="d.match.finalHomeScore" [away]="d.match.finalAwayScore" [muted]="d.match.status !== 'FINISHED'" /></div>
            <div><span class="cell-sub">Final corners</span>{{ d.match.finalHomeCorners ?? '–' }} : {{ d.match.finalAwayCorners ?? '–' }}</div>
          </div>
        </section>

        <section class="panel">
        <mm-tabs [tabs]="tabList()" [(value)]="tab" />
        <div class="tabpanel" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab()">
          @switch (tab()) {
            @case ('picks') {
              <div class="table-wrap"><table class="dt">
                <thead>
                  <tr><th style="width:2.5rem"></th><th class="num">#</th><th>Market</th><th>Pick</th><th class="num">Line</th><th>Stage</th>
                    <th class="num">Prob.</th><th class="num">Price</th><th>Result</th><th>Settled by</th>@if (auth.isAdmin()) { <th></th> }</tr>
                </thead>
                <tbody>
                  @for (p of d.picks; track p.id) {
                  <tr>
                    <td><button type="button" class="btn btn-text btn-icon" [attr.aria-expanded]="expanded.has(p.id)" (click)="expanded.toggle(p.id)"
                      [attr.aria-label]="expanded.has(p.id) ? 'Hide settlement history' : 'Show settlement history'">
                      <i class="pi" [class.pi-chevron-down]="expanded.has(p.id)" [class.pi-chevron-right]="!expanded.has(p.id)"></i></button></td>
                    <td class="num">{{ p.rank }}</td>
                    <td>{{ p.market }}</td>
                    <td>{{ p.pick }}</td>
                    <td class="num">{{ line(p.market, p.line) }}</td>
                    <td>{{ humanize(p.stage) }}</td>
                    <td class="num">{{ pct(p.probability) }}</td>
                    <td class="num">{{ num(p.price) }}</td>
                    <td><mm-result [value]="p.settlementStatus" /></td>
                    <td>{{ currentSource(p) }}</td>
                    @if (auth.isAdmin()) {
                      <td class="nowrap">
                        <button type="button" class="btn btn-text btn-sm" (click)="open('recalculate', p)" [disabled]="d.match.status !== 'FINISHED' && d.match.status !== 'CANCELLED' && p.settlementStatus === 'PENDING'">Recalculate</button>
                        <button type="button" class="btn btn-text btn-sm" style="color:var(--mm-ink-2)" (click)="open('override', p)">Override</button>
                      </td>
                    }
                  </tr>
                  @if (expanded.has(p.id)) {
                  <tr class="expanded"><td [attr.colspan]="auth.isAdmin() ? 11 : 10">
                    @for (r of p.results; track r.id) {
                      <div style="padding:.35rem 0;border-bottom:1px solid var(--mm-line)">
                        <mm-result [value]="r.result" /> <strong>{{ humanize(r.source) }}</strong> · {{ fmt(r.settledAt) }} · {{ r.calculationVersion }}
                        @if (!r.current) { <span class="muted-text" style="display:inline"> · superseded {{ fmt(r.supersededAt) }}</span> }
                        @if (r.reason) { <div class="muted-text">Reason: {{ r.reason }}</div> }
                        <mm-json [value]="r.details" />
                      </div>
                    } @empty { <p class="muted-text">Not settled yet. It settles automatically when the match result arrives.</p> }
                  </td></tr>
                  }
                  } @empty { <tr><td colspan="11" class="empty">No picks.</td></tr> }
                </tbody>
              </table></div>
            }
            @case ('odds') {
              <div class="table-wrap"><table class="dt">
                <thead>
                  <tr><th>Ref</th><th>Stage</th><th class="num">Line</th><th class="num">Home</th><th class="num">Draw</th><th class="num">Away</th>
                    <th class="num">Over</th><th class="num">Under</th><th>Basis</th><th>At capture</th><th>Captured</th></tr>
                </thead>
                <tbody>
                  @for (g of oddsGroups(); track g.market) {
                    <tr><td colspan="11" class="group-cell">{{ g.market }}</td></tr>
                    @for (o of g.rows; track $index) {
                    <tr>
                      <td>{{ o.ref }}</td><td>{{ humanize(o.stage) }} {{ o.snapshotOrder }}</td><td class="num">{{ line(o.market, o.line, o.lineDisplay) }}</td>
                      <td class="num">{{ num(o.homeOdds) }}</td><td class="num">{{ num(o.drawOdds) }}</td><td class="num">{{ num(o.awayOdds) }}</td>
                      <td class="num">{{ num(o.overOdds) }}</td><td class="num">{{ num(o.underOdds) }}</td>
                      <td>{{ humanize(o.settlementBasis) }}</td>
                      <td>@if (o.homeScoreAtCapture !== null) { <mm-score [home]="o.homeScoreAtCapture" [away]="o.awayScoreAtCapture" [muted]="true" /> } @else { — }</td>
                      <td class="nowrap">{{ fmt(o.capturedAt) }}</td>
                    </tr>
                    }
                  } @empty { <tr><td colspan="11" class="empty">No odds were sent with this prediction.</td></tr> }
                </tbody>
              </table></div>
            }
            @case ('scores') {
              <table class="dt">
                <thead><tr><th class="num">Rank</th><th>Score</th><th class="num">Probability</th></tr></thead>
                <tbody>
                  @for (c of d.correctScores; track c.rank) { <tr><td class="num">{{ c.rank }}</td><td><mm-score [home]="c.home" [away]="c.away" /></td><td class="num">{{ pct(c.probability) }}</td></tr> }
                  @empty { <tr><td colspan="3" class="empty">No correct-score prediction.</td></tr> }
                </tbody>
              </table>
            }
            @case ('stats') {
              @if (d.stats; as s) {
                <table class="dt">
                  <thead><tr><th>Stat</th><th class="num">{{ d.match.homeTeam }}</th><th class="num">{{ d.match.awayTeam }}</th></tr></thead>
                  <tbody>@for (r of statRows(); track r[0]) { <tr><td>{{ r[0] }}</td><td class="num">{{ r[1] ?? '—' }}</td><td class="num">{{ r[2] ?? '—' }}</td></tr> }</tbody>
                </table>
                @if (s.extra) { <h3 style="margin:1rem 0 .5rem">Other stats</h3><mm-json [value]="s.extra" /> }
              } @else { <p class="muted-text">No stats were sent with this prediction.</p> }
            }
            @case ('sim') {
              @if (d.simulation; as s) {
                <div class="grid-2">
                  <dl class="dl">
                    <dt>Method</dt><dd>{{ s.method }}</dd>
                    <dt>Iterations</dt><dd>{{ s.simulationCount }}</dd>
                    <dt>Seed</dt><dd>{{ s.randomSeed ?? '—' }}</dd>
                    <dt>Algorithm</dt><dd>{{ s.algorithmVersion ?? '—' }}</dd>
                    <dt>Expected remaining goals</dt><dd>{{ num(s.expectedRemainingHomeGoals) }} – {{ num(s.expectedRemainingAwayGoals) }}</dd>
                    <dt>Expected remaining corners</dt><dd>{{ num(s.expectedRemainingHomeCorners) }} – {{ num(s.expectedRemainingAwayCorners) }}</dd>
                  </dl>
                  <div><h3 class="mb-2">Probabilities</h3><mm-json [value]="s.probabilities" /></div>
                </div>
                @if (s.correctScoreDistribution?.length) {
                  <h3 style="margin:1rem 0 .5rem">Score distribution</h3>
                  <div class="table-wrap short"><table class="dt">
                    <thead><tr><th>Score</th><th class="num">Probability</th></tr></thead>
                    <tbody>@for (c of s.correctScoreDistribution!; track $index) { <tr><td><mm-score [home]="c.home" [away]="c.away" [muted]="true" /></td><td class="num">{{ pct(c.probability) }}</td></tr> }</tbody>
                  </table></div>
                }
                <h3 style="margin:1rem 0 .5rem">Parameters</h3><mm-json [value]="s.parameters" />
              } @else { <p class="muted-text">No simulation was sent with this prediction.</p> }
            }
            @case ('raw') {
              <h3 class="mb-2">Request payload</h3><mm-json [value]="d.payload" />
              <h3 style="margin:1rem 0 .5rem">Metadata</h3><mm-json [value]="d.metadata" />
            }
          }
        </div>
        </section>
      }
    </div>

    <mm-dialog [open]="!!action()" (closed)="action.set(null)" [header]="action()?.kind === 'override' ? 'Override result' : 'Recalculate result'">
      @if (action(); as a) {
        <form class="stack" (ngSubmit)="submitAction()">
          <p class="muted-text">{{ a.pick.market }} {{ a.pick.pick }} {{ line(a.pick.market, a.pick.line) }} — current: {{ humanize(a.pick.settlementStatus) }}.
            The current result is kept in history and marked superseded.</p>
          @if (a.kind === 'override') {
            <div class="field"><label for="ov-result">New result</label>
              <select class="input w-full" id="ov-result" name="result" [(ngModel)]="overrideResult" required>
                <option [ngValue]="null" disabled>Choose a result</option>
                @for (o of overrideOptions; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
              </select></div>
          }
          <div class="field"><label for="ov-reason">Reason</label>
            <textarea class="input" id="ov-reason" name="reason" [(ngModel)]="reason" rows="3" maxlength="2000" required></textarea></div>
          @if (actionError()) { <div class="field-error">{{ actionError() }}</div> }
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="action.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving() || !reason.trim() || (a.kind === 'override' && !overrideResult)">
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
  readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  readonly error = signal('');
  readonly detail = signal<PredictionDetail | null>(null);
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
  readonly overrideOptions = ['WIN', 'HALF_WIN', 'PUSH', 'HALF_LOSS', 'LOSS', 'VOID'].map(r => ({ label: humanize(r), value: r }));
  reason = '';
  overrideResult: string | null = null;
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly pct = pct;
  readonly num = num;
  readonly line = line;

  readonly statRows = computed(() => {
    const s = this.detail()?.stats;
    return s ? statRows(s) : [];
  });

  constructor() {
    effect(() => this.load(this.id()));
  }

  load(id: string): void {
    this.state.set('loading');
    this.expanded.clear();
    this.api.prediction(id).subscribe({
      next: d => { this.detail.set(d); this.state.set('ready'); },
      error: e => { this.detail.set(null); this.error.set(apiError(e).message); this.state.set('error'); },
    });
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
    if (!a || !this.reason.trim()) return;
    this.saving.set(true);
    const call = a.kind === 'override'
      ? this.api.overridePick(a.pick.id, this.overrideResult!, this.reason.trim())
      : this.api.recalculatePick(a.pick.id, this.reason.trim());
    call.subscribe({
      next: r => {
        this.saving.set(false);
        if (this.action() === a) this.action.set(null);
        this.messages.add({ severity: 'success', summary: a.kind === 'override' ? 'Override saved' : r.status === 'UNSETTLED' ? 'Back to pending' : 'Recalculated', detail: `${r.market} ${r.pick}: ${humanize(r.result)}` });
        this.load(this.id());
      },
      error: e => { this.saving.set(false); this.actionError.set(apiError(e).message); },
    });
  }
}
