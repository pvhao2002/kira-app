import { ChangeDetectionStrategy, Component, Directive, ElementRef, booleanAttribute, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { apiErrorText } from '../core/http';
import { BIDI_CONTROLS, SMALL_SAMPLE, humanize, resultSeverity, statusSeverity } from './format';
import { Dialog, ToastService } from './kit';

/** Scoreboard tile: the one signature visual of MatchMind. Missing values stay a dash, never 0. */
@Component({
  selector: 'mm-score',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="score-chip" role="img" [class.muted]="muted()" [attr.aria-label]="label()">
    @if (home() == null && away() == null) { <span>—</span> }
    @else { <span>{{ home() ?? '—' }}</span><span class="sep">:</span><span>{{ away() ?? '—' }}</span> }</span>`,
})
export class ScoreChip {
  readonly home = input<number | null | undefined>(null);
  readonly away = input<number | null | undefined>(null);
  readonly muted = input(false);
  readonly label = computed(() => this.home() == null && this.away() == null ? 'No score' : `${this.home() ?? 'unknown'} to ${this.away() ?? 'unknown'}`);
}

@Component({
  selector: 'mm-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tag tag-{{ severity() }}">{{ text() }}</span>`,
})
export class ResultTag {
  readonly value = input<string | null | undefined>(null);
  readonly kind = input<'result' | 'status'>('result');
  readonly text = computed(() => humanize(this.value() ?? 'PENDING'));
  readonly severity = computed(() => this.kind() === 'result' ? resultSeverity(this.value()) : statusSeverity(this.value()));
}

/**
 * UX-018: warns that a rate rests on fewer than {@link SMALL_SAMPLE} picks. `n` is the rate's denominator (wins + losses
 * for the win rate, staked for ROI). Hidden at 0: the figure itself is then a dash.
 */
@Component({
  selector: 'mm-small-sample',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (n() > 0 && n() < limit) {
    <span class="tag tag-warn nowrap" data-testid="small-sample" [title]="note()">small sample (n = {{ n() }})<span class="sr-only">. {{ note() }}</span></span>
  }`,
})
export class SmallSample {
  readonly n = input.required<number>();
  readonly limit = SMALL_SAMPLE;
  readonly note = computed(() => `Based on only ${this.n()} picks. Below ${this.limit} picks luck dominates, so treat this figure as noise.`);
}

/** Pretty JSON for JSONB fields and raw payloads, with a copy button. */
@Component({
  selector: 'mm-json',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value() === null || value() === undefined) {
      <p class="muted-text">Not provided</p>
    } @else {
      <div class="json-wrap">
        <button type="button" class="btn btn-text btn-icon json-copy" aria-label="Copy JSON" (click)="copy()"><i class="pi pi-copy" aria-hidden="true"></i></button>
        <pre class="json">{{ pretty() }}</pre>
      </div>
    }`,
})
export class JsonView {
  private readonly toast = inject(ToastService);
  readonly value = input<unknown>(null);
  /** BiDi controls are shown as JSON escapes: visible, still valid JSON, and they cannot reorder the text (UX-030). */
  readonly pretty = computed(() => {
    const v = this.value();
    let s: string;
    if (typeof v === 'string') {
      try { s = JSON.stringify(JSON.parse(v), null, 2); } catch { s = v; }
    } else s = JSON.stringify(v, null, 2);
    return s.replace(BIDI_CONTROLS, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  });

  copy(): void { this.toast.copy(this.pretty(), 'JSON'); }
}

@Component({
  selector: 'mm-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="state-loading" role="status">
          <span class="sr-only">Loading…</span>
          @for (r of rowsArr(); track $index) { <div class="skeleton" aria-hidden="true"></div> }
        </div>
      }
      @case ('error') {
        <div class="state-box error" role="alert">
          <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
          <div><strong>Couldn't load this data.</strong><p>{{ message() }}</p>
            @if (retryable()) { <button type="button" class="btn btn-outline btn-sm mt-2" data-testid="state-retry" (click)="retry.emit()">Retry</button> }</div>
        </div>
      }
      @case ('empty') {
        <div class="state-box"><i class="pi {{ icon() }}" aria-hidden="true"></i><div><strong>{{ message() }}</strong><ng-content /></div></div>
      }
    }`,
})
export class StateView {
  readonly state = input<'loading' | 'error' | 'empty' | 'ready'>('loading');
  readonly message = input('');
  readonly icon = input('pi-inbox');
  readonly rows = input(6);
  /** Error state only: shows a Retry button. Usage: `<mm-state [state]="s" [message]="m" retryable (retry)="res.reload()" />`. */
  readonly retryable = input(false, { transform: booleanAttribute });
  readonly retry = output<void>();
  readonly rowsArr = computed(() => Array.from({ length: this.rows() }));
}

/**
 * Esc and an outside click close a `<details class="menu">` (column picker): `details.menu` is the whole selector, so
 * importing `DetailsMenu` in a component is enough. Esc returns focus to the summary.
 */
@Directive({ selector: 'details.menu', host: { '(keydown.escape)': 'esc()', '(document:click)': 'outside($event)' } })
export class DetailsMenu {
  private readonly el = inject<ElementRef<HTMLDetailsElement>>(ElementRef).nativeElement;

  esc(): void {
    if (!this.el.open) return;
    this.el.open = false;
    this.el.querySelector('summary')?.focus();
  }

  outside(e: Event): void {
    if (this.el.open && !this.el.contains(e.target as Node)) this.el.open = false;
  }
}

/** One admin write that needs a reason (archive, rename, merge…). `run` gets the trimmed reason; `done` runs after success. */
export interface ReasonAction {
  header: string; label: string; message?: string; danger?: boolean;
  run: (reason: string) => Observable<unknown>; done?: () => void;
}

/**
 * The reason dialog of the admin data actions: shows `action` while it is set, sends it once, shows the API message on
 * failure. Extra fields (new name, merge target) are projected above the reason; `ready` false keeps Save disabled.
 */
@Component({
  selector: 'mm-reason-dialog',
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mm-dialog [open]="!!action()" [busy]="busy()" [header]="action()?.header ?? ''" (closed)="closed.emit()">
      @if (action(); as a) {
        <form class="stack" (submit)="$event.preventDefault(); submit(a)">
          @if (a.message) { <p class="muted-text">{{ a.message }}</p> }
          <ng-content />
          <div class="field"><label for="mm-reason">Reason</label>
            <textarea class="input" id="mm-reason" name="reason" rows="3" maxlength="500" required autofocus data-testid="reason"
              aria-describedby="mm-reason-hint" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
            <small id="mm-reason-hint" class="muted-text">Stored in the admin audit log.</small></div>
          @if (error()) { <div class="field-error" role="alert">{{ error() }}</div> }
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="closed.emit()">Cancel</button>
            <button type="submit" class="btn" [class.btn-danger]="a.danger" [class.btn-primary]="!a.danger" data-testid="reason-submit"
              [disabled]="busy() || !ready() || !reason().trim()">
              @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } {{ a.label }}</button>
          </div>
        </form>
      }
    </mm-dialog>`,
})
export class ReasonDialog {
  readonly action = input<ReasonAction | null>(null);
  readonly ready = input(true);
  readonly closed = output<void>();
  private readonly messages = inject(ToastService);
  readonly reason = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    effect(() => { this.action(); untracked(() => { this.reason.set(''); this.error.set(''); }); });
  }

  submit(a: ReasonAction): void {
    const reason = this.reason().trim();
    if (!reason || !this.ready() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    a.run(reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.messages.add({ severity: 'success', summary: 'Saved', detail: a.header });
        a.done?.();
        this.closed.emit();
      },
      error: e => { this.busy.set(false); this.error.set(apiErrorText(e)); },
    });
  }
}
