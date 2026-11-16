import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/** A labelled figure. Without a `value` it shows the projected content instead (e.g. "not available" notes). */
@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {class: 'card block min-w-0 p-4'},
  template: `
    <p class="text-[13px] font-medium text-muted">{{ label() }}</p>
    @if (value() !== null) {
      <p class="mt-1 text-xl font-semibold tabular-nums break-words" [class.text-brand-strong]="accent()">{{ value() }}</p>
    }
    @if (hint()) {
      <p class="mt-1 text-xs text-muted">{{ hint() }}</p>
    }
    <ng-content/>
  `
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input<string | null>(null);
  readonly hint = input('');
  readonly accent = input(false);
}
