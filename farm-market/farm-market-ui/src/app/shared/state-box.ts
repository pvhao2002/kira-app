import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';

/**
 * Presentational loading / error / empty block. Pages keep their own `@if` chain (so they never touch data that is
 * not ready) and render this for the non-data branches. Loading is announced politely (role=status), errors
 * assertively (role=alert) with an optional retry button (`[retryable]="true" (retry)="reload()"`); empty states
 * can project their own actions.
 */
@Component({
  selector: 'app-state-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './state-box.html',
  styleUrl: './state-box.css'
})
export class StateBox {
  readonly kind = input<'loading' | 'error' | 'empty'>('empty');
  readonly title = input('');
  readonly message = input('');
  readonly retryLabel = input('Thử lại');
  readonly retryable = input(false);
  readonly retry = output<void>();
}
