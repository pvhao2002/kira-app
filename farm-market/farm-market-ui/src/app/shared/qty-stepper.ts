import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';

@Component({
  selector: 'app-qty-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="q">
      <button type="button" aria-label="Giảm" [disabled]="value() <= min()" (click)="changed.emit(value() - 1)">−</button>
      <span>{{ value() }}</span>
      <button type="button" aria-label="Tăng" (click)="changed.emit(value() + 1)">+</button>
    </div>
  `,
  styles: `
    .q { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); }
    button { width: 34px; height: 34px; border: 0; background: transparent; font-size: 18px; border-radius: 50%; }
    button:disabled { opacity: .35; cursor: not-allowed; }
    span { min-width: 28px; text-align: center; font-weight: 600; }
  `
})
export class QtyStepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly changed = output<number>();
}
