import { computed, inject, ResourceRef, signal, WritableSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { Paging } from '../core/api.service';
import { apiError } from '../core/http';
import { Page } from '../core/models';
import { Sort, sortParam } from './kit';
import { toQuery } from './url-state';

/**
 * State of one server-paged, sortable table, backed by an rxResource: a superseded request is cancelled, and the
 * previous rows stay on screen while the next page loads. Create it in a field initializer (needs an injection
 * context). Nothing is fetched until the page calls `reload()`/`load()` once. `fetch` reads the page's current
 * filters each time it runs.
 *
 * Page, size and sort live in the query string (`page` is 1-based; each is left out at its default), so a refreshed or
 * shared link opens the same slice of the table.
 */
export class PagedList<T> {
  readonly page = signal(0);
  readonly size: WritableSignal<number>;
  readonly sort: WritableSignal<Sort>;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly defaults: { size: number; sort: string | undefined };
  private readonly started = signal(false);
  private readonly tick = signal(0);
  private readonly resource: ResourceRef<Page<T> | undefined>;
  /** Last good page: kept while the next one loads (a resource would blank its value), dropped on error. */
  private readonly data = signal<Page<T> | undefined>(undefined);

  readonly rows = computed(() => this.data()?.data ?? []);
  readonly total = computed(() => this.data()?.meta.totalElements ?? 0);
  readonly loading = computed(() => this.resource.isLoading());
  readonly error = computed(() => (this.resource.error() ? apiError(this.resource.error()).message : ''));

  constructor(fetch: (p: Paging) => Observable<Page<T>>, sort: Sort, size = 25) {
    this.defaults = { size, sort: sortParam(sort) };
    const q = this.route.snapshot.queryParamMap;
    const fromUrl = { page: Number(q.get('page')), size: Number(q.get('size')), sort: /^(\w+),(asc|desc)$/.exec(q.get('sort') ?? '') };
    if (Number.isInteger(fromUrl.page) && fromUrl.page > 1) this.page.set(fromUrl.page - 1);
    this.size = signal(Number.isInteger(fromUrl.size) && fromUrl.size >= 1 && fromUrl.size <= 200 ? fromUrl.size : size);
    this.sort = signal(fromUrl.sort ? { field: fromUrl.sort[1], dir: fromUrl.sort[2] as 'asc' | 'desc' } : sort);
    this.resource = rxResource({
      params: () => this.started()
        ? { page: this.page(), size: this.size(), sort: sortParam(this.sort()), tick: this.tick() }
        : undefined,
      stream: ({ params: { page, size: pageSize, sort: s } }) => fetch({ page, size: pageSize, sort: s })
        .pipe(tap({ next: p => this.data.set(p), error: () => this.data.set(undefined) })),
    });
  }

  /** Back to the first page, e.g. after the filters changed. */
  reload(): void { this.page.set(0); this.load(); }
  setSort(s: Sort): void { this.sort.set(s); this.reload(); }
  setPage(e: { page: number; size: number }): void { this.page.set(e.page); this.size.set(e.size); this.load(); }

  /** Fetch again with the current page, size, sort and filters. */
  load(): void {
    this.started.set(true);
    this.tick.update(n => n + 1);
    const sort = sortParam(this.sort());
    toQuery(this.router, this.route, {
      page: this.page() > 0 ? String(this.page() + 1) : null,
      size: this.size() !== this.defaults.size ? String(this.size()) : null,
      sort: sort !== this.defaults.sort ? sort ?? null : null,
    });
  }
}
