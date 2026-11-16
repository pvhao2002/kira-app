import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
import {apiErrorMessage} from '../core/api/api-error';

/**
 * One place for the three non-data states of a view. Projected content is shown only when the view has data.
 * Content projected with `empty-action` is shown under the empty message (e.g. a button to another page).
 */
@Component({
  selector: 'app-state-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <div class="flex flex-col items-center gap-3 px-4 py-8 text-center" role="alert" data-testid="state-error">
        <p class="font-medium text-danger">{{ message() }}</p>
        <button type="button" class="btn btn-sm" (click)="retry.emit()" data-testid="state-retry">Thử lại</button>
      </div>
    } @else if (loading()) {
      <div class="flex flex-col gap-2.5 p-4" aria-busy="true" data-testid="state-loading">
        <span class="sr-only">Đang tải…</span>
        @for (w of bars(); track $index) {
          <div class="skeleton h-4" [style.width.%]="w"></div>
        }
      </div>
    } @else if (empty()) {
      <div class="flex flex-col items-center gap-2 px-4 py-8 text-center" data-testid="state-empty">
        <p class="font-medium">{{ emptyTitle() }}</p>
        @if (emptyText()) {
          <p class="muted max-w-md">{{ emptyText() }}</p>
        }
        <ng-content select="[empty-action]"/>
      </div>
    } @else {
      <ng-content/>
    }
  `
})
export class StateBox {
  readonly loading = input(false);
  readonly error = input<unknown>(null);
  readonly empty = input(false);
  readonly emptyTitle = input('Chưa có dữ liệu');
  readonly emptyText = input('');
  /** Replaces the API-derived error text for failures that are not HTTP errors. */
  readonly errorText = input('');
  readonly rows = input(4);
  readonly retry = output<void>();

  protected readonly message = computed(() => this.errorText() || apiErrorMessage(this.error()));
  protected readonly bars = computed(() => Array.from({length: this.rows()}, (_, i) => [92, 78, 85, 64][i % 4]));
}
