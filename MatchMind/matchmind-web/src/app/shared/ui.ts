import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { humanize, resultSeverity, statusSeverity } from './format';
import { ToastService } from './kit';

/** Scoreboard tile: the one signature visual of MatchMind. Missing values stay a dash, never 0. */
@Component({
  selector: 'mm-score',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="score-chip" role="img" [class.muted]="muted()" [attr.aria-label]="label()">
    <span>{{ home() ?? '—' }}</span><span class="sep">:</span><span>{{ away() ?? '—' }}</span></span>`,
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

/** Pretty JSON for JSONB fields and raw payloads, with a copy button. */
@Component({
  selector: 'mm-json',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value() === null || value() === undefined) {
      <p class="muted-text">Not provided</p>
    } @else {
      <div class="json-wrap">
        <button type="button" class="btn btn-text btn-icon json-copy" aria-label="Copy JSON" (click)="copy()"><i class="pi pi-copy"></i></button>
        <pre class="json">{{ pretty() }}</pre>
      </div>
    }`,
})
export class JsonView {
  private readonly toast = inject(ToastService);
  readonly value = input<unknown>(null);
  readonly pretty = computed(() => {
    const v = this.value();
    if (typeof v === 'string') {
      try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
    }
    return JSON.stringify(v, null, 2);
  });

  copy(): void { this.toast.copy(this.pretty(), 'JSON'); }
}

@Component({
  selector: 'mm-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="state-loading" aria-busy="true" aria-label="Loading">
          @for (r of rowsArr(); track $index) { <div class="skeleton"></div> }
        </div>
      }
      @case ('error') {
        <div class="state-box error" role="alert">
          <i class="pi pi-exclamation-circle"></i>
          <div><strong>Couldn't load this data.</strong><p>{{ message() }}</p></div>
        </div>
      }
      @case ('empty') {
        <div class="state-box"><i class="pi {{ icon() }}"></i><div><strong>{{ message() }}</strong><ng-content /></div></div>
      }
    }`,
})
export class StateView {
  readonly state = input<'loading' | 'error' | 'empty' | 'ready'>('loading');
  readonly message = input('');
  readonly icon = input('pi-inbox');
  readonly rows = input(6);
  readonly rowsArr = computed(() => Array.from({ length: this.rows() }));
}
