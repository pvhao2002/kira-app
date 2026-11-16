import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';

export interface Sort {
  field: string;
  dir: 'asc' | 'desc';
}

/** `field,asc|desc` as the API expects it. */
export function sortParam(sort: Sort): string {
  return `${sort.field},${sort.dir}`;
}

/** Clicking the active column flips direction; a new column starts descending (largest/newest first). */
export function nextSort(current: Sort, field: string): Sort {
  return current.field === field ? {field, dir: current.dir === 'asc' ? 'desc' : 'asc'} : {field, dir: 'desc'};
}

export function sortRows<T>(rows: readonly T[], sort: Sort): T[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = (a as Record<string, unknown>)[sort.field], y = (b as Record<string, unknown>)[sort.field];
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign;
    return String(x ?? '').localeCompare(String(y ?? ''), 'vi') * sign;
  });
}

/** Sortable column header: `<th appSortHeader field="gmv" [sort]="sort()" (sortChange)="sort.set($event)">GMV</th>` */
@Component({
  selector: 'th[appSortHeader]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'[attr.aria-sort]': 'ariaSort()', scope: 'col'},
  template: `
    <button type="button" class="inline-flex items-center gap-1 font-semibold hover:text-ink" (click)="sortChange.emit(next())">
      <ng-content/>
      <span aria-hidden="true" class="w-2 text-[10px]" [class.text-brand-strong]="active()">{{ active() ? (sort().dir === 'asc' ? '▲' : '▼') : '↕' }}</span>
    </button>
  `
})
export class SortHeader {
  readonly field = input.required<string>();
  readonly sort = input.required<Sort>();
  readonly sortChange = output<Sort>();
  protected readonly active = computed(() => this.sort().field === this.field());
  protected readonly ariaSort = computed(() => !this.active() ? 'none' : this.sort().dir === 'asc' ? 'ascending' : 'descending');

  protected next(): Sort {
    return nextSort(this.sort(), this.field());
  }
}

/** Pager for the API's 0-based pages. */
@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5" aria-label="Phân trang">
      <p class="muted">{{ total() }} kết quả · Trang {{ page() + 1 }}/{{ pages() }}</p>
      <div class="flex gap-2">
        <button type="button" class="btn btn-sm" [disabled]="page() <= 0" (click)="pageChange.emit(page() - 1)" data-testid="pager-prev">Trước</button>
        <button type="button" class="btn btn-sm" [disabled]="page() + 1 >= pages()" (click)="pageChange.emit(page() + 1)" data-testid="pager-next">Sau</button>
      </div>
    </nav>
  `
})
export class Pager {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();
  protected readonly pages = computed(() => Math.max(1, this.totalPages()));
}
