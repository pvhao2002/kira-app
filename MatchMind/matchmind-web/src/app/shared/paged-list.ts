import { signal, WritableSignal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Paging } from '../core/api.service';
import { apiError } from '../core/http';
import { Page } from '../core/models';
import { Sort, sortParam } from './kit';

/** State of one server-paged, sortable table. `fetch` reads the page's current filters each time it runs. */
export class PagedList<T> {
  readonly rows = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(0);
  readonly size: WritableSignal<number>;
  readonly sort: WritableSignal<Sort>;
  private req?: Subscription;

  constructor(private readonly fetch: (p: Paging) => Observable<Page<T>>, sort: Sort, size = 25) {
    this.sort = signal(sort);
    this.size = signal(size);
  }

  /** Back to the first page, e.g. after the filters changed. */
  reload(): void { this.page.set(0); this.load(); }
  setSort(s: Sort): void { this.sort.set(s); this.reload(); }
  setPage(e: { page: number; size: number }): void { this.page.set(e.page); this.size.set(e.size); this.load(); }

  load(): void {
    this.loading.set(true);
    this.req?.unsubscribe(); // drop a slower, superseded response
    this.req = this.fetch({ page: this.page(), size: this.size(), sort: sortParam(this.sort()) }).subscribe({
      next: p => { this.rows.set(p.data); this.total.set(p.meta.totalElements); this.error.set(''); this.loading.set(false); },
      error: err => { this.rows.set([]); this.total.set(0); this.error.set(apiError(err).message); this.loading.set(false); },
    });
  }
}
