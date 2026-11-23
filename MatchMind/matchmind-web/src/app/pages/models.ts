import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { keepPrevious, viewState } from '../core/resource';
import { ROI_DEF, fmtDateTime, pct, units } from '../shared/format';
import { Paginator, Sort, SortHeader, sortParam, sortRows } from '../shared/kit';
import { listError } from '../shared/paged-list';
import { SmallSample, StateView } from '../shared/ui';
import { fromQuery, toQuery } from '../shared/url-state';

const DEFAULT_SORT: Sort = { field: 'name', dir: 'asc' };
const SORTS = ['name', 'providerName', 'totalPredictions', 'winRate', 'units', 'roi', 'lastPredictionAt'];
const PAGE_SIZE = 25;

/** Lower case without accents, so "gemini" finds "Gémini". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

@Component({
  selector: 'mm-models',
  imports: [RouterLink, SortHeader, SmallSample, StateView, Paginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <p class="page-note">Models are added automatically the first time an agent sends a prediction with them
        (<code>X-Model-Name</code> header). Providers and their keys are managed on <a routerLink="/providers">Providers</a>.</p>
      <p class="page-note" data-testid="definitions">Win rate: (win + half win) divided by settled picks; push and void are left out. {{ roiDef }}</p>
      <div class="filter-bar">
        <input class="input f-search" type="search" [value]="search()" (input)="setSearch($any($event.target).value)"
          placeholder="Model, version or provider" aria-label="Search models" />
        <label class="check"><input type="checkbox" data-testid="show-archived" [checked]="showArchived()" (change)="setShowArchived($any($event.target).checked)" /> Show archived and merged</label>
      </div>
      @if (!loaded()) {
        <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      } @else {
        <section class="panel flush">
          <div class="table-wrap tall"><table class="dt compact-sm" aria-label="AI models" [class.loading]="state() === 'loading'" [attr.aria-busy]="state() === 'loading'">
            <thead>
              <tr><th mmSort="name" [sort]="sort()" (sortChange)="setSort($event)">Model</th><th class="hide-sm" mmSort="providerName" [sort]="sort()" (sortChange)="setSort($event)">Provider</th>
                <th mmSort="totalPredictions" class="num hide-sm" [sort]="sort()" (sortChange)="setSort($event)">Predictions</th>
                <th class="num hide-sm">Settled</th><th class="num">W / L</th><th mmSort="winRate" class="num" [sort]="sort()" (sortChange)="setSort($event)" title="(Win + half win) divided by settled picks. Push and void are left out.">Win rate</th>
                <th mmSort="units" class="num hide-sm" [sort]="sort()" (sortChange)="setSort($event)" [title]="roiDef">Units</th>
                <th mmSort="roi" class="num" [sort]="sort()" (sortChange)="setSort($event)" [title]="roiDef">ROI</th>
                <th class="num hide-sm">Pending</th><th class="hide-sm" mmSort="lastPredictionAt" [sort]="sort()" (sortChange)="setSort($event)">Last prediction</th></tr>
            </thead>
            <tbody>
              @for (m of rows(); track m.id) {
              <tr class="clickable" tabindex="-1" [routerLink]="['/models', m.id]">
                <td><a [routerLink]="['/models', m.id]">{{ m.displayName ?? m.name }}</a> @if (m.status === 'DISABLED') { <span class="tag tag-secondary">Disabled</span> }
                  @if (m.archivedAt) { <span class="tag tag-secondary">Archived</span> }
                  @if (m.mergedIntoId) { <span class="tag tag-info">merged into {{ nameOf(m.mergedIntoId) }}</span> }<span class="cell-sub">{{ m.version }}<span class="show-sm"> · {{ m.providerName }}</span></span></td>
                <td class="hide-sm">{{ m.providerName }}</td>
                <td class="num hide-sm">{{ m.totalPredictions }}</td>
                <td class="num hide-sm">{{ m.settledPicks }}</td>
                <td class="num"><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></td>
                <td class="num">{{ pct(m.winRate) }} <mm-small-sample [n]="m.wins + m.losses" /></td>
                <td class="num hide-sm">{{ units(m.units) }}</td>
                <td class="num">{{ pct(m.roi) }} <mm-small-sample [n]="m.staked" /></td>
                <td class="num hide-sm">{{ m.pendingPicks }}</td>
                <td class="nowrap hide-sm">{{ fmt(m.lastPredictionAt) }}</td>
              </tr>
              } @empty {
                <tr><td colspan="10" class="empty">
                  @if (search()) { <div class="empty-state"><i class="pi pi-search" aria-hidden="true"></i><strong>No model matches "{{ search() }}"</strong></div> }
                  @else { <div class="empty-state"><i class="pi pi-microchip-ai" aria-hidden="true"></i><strong>No models yet</strong><span>They appear after an agent's first prediction.</span></div> }
                </td></tr>
              }
            </tbody>
          </table></div>
          @if (filtered().length) {
            <mm-paginator [page]="page()" [size]="size" [total]="filtered().length" [sizes]="[]" unit="models" (pageChange)="setPage($event)" />
          }
        </section>
      }
    </div>`,
  styles: `
    /* MOD-2: at phone width the "small sample" tag drops under the figure and wraps, so the table keeps fitting. */
    @media (max-width: 640px) {
      td.num mm-small-sample { display: block; }
      :host ::ng-deep td.num mm-small-sample .tag { white-space: normal; text-align: right; }
    }`,
})
export class ModelsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly resource = this.api.modelsResource(undefined, () => this.showArchived());
  readonly state = viewState(this.resource);
  readonly error = computed(() => (this.resource.error() ? listError(this.resource.error()) : ''));
  /** Last good list: kept while a toggle reloads, so the table dims instead of being swapped for the skeleton. */
  private readonly data = keepPrevious(this.resource);
  readonly loaded = computed(() => this.data() !== undefined);
  readonly models = computed(() => this.data() ?? []);
  readonly size = PAGE_SIZE;
  readonly pct = pct;
  readonly units = units;
  readonly roiDef = ROI_DEF;
  readonly fmt = fmtDateTime;

  // The list is small and arrives whole, so search, sort and paging run here; the URL keeps them (UX-010, UX-016).
  private readonly q = fromQuery(this.route.snapshot.queryParamMap, ['search', 'sort', 'page', 'archived'] as const);
  readonly showArchived = signal(this.q.archived === 'true');
  readonly search = signal(this.q.search ?? '');
  readonly sort = signal<Sort>(this.parseSort(this.q.sort));
  private readonly wantedPage = signal(Math.max(0, (Number(this.q.page) || 1) - 1));

  readonly filtered = computed(() => {
    const s = fold(this.search().trim());
    const hits = s ? this.models().filter(m => fold(`${m.displayName ?? ''} ${m.name} ${m.version} ${m.providerName}`).includes(s)) : this.models();
    return sortRows(hits, this.sort());
  });
  /** The asked-for page, clamped once the rows are known (a link to page 9 of 2 shows page 2). */
  readonly page = computed(() => Math.min(this.wantedPage(), Math.max(0, Math.ceil(this.filtered().length / PAGE_SIZE) - 1)));
  readonly rows = computed(() => this.filtered().slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE));

  constructor() {
    effect(() => {
      if (this.state() !== 'ready') return;
      const sort = sortParam(this.sort());
      toQuery(this.router, this.route, {
        search: this.search().trim() || null,
        sort: sort !== sortParam(DEFAULT_SORT) ? sort ?? null : null,
        page: this.page() > 0 ? String(this.page() + 1) : null,
        archived: this.showArchived() ? 'true' : null,
      });
    });
  }

  setSearch(v: string): void { this.search.set(v); this.wantedPage.set(0); }
  setSort(s: Sort): void { this.sort.set(s); this.wantedPage.set(0); }
  setPage(e: { page: number }): void { this.wantedPage.set(e.page); }
  setShowArchived(v: boolean): void { this.showArchived.set(v); this.wantedPage.set(0); }

  /** Name of a merge target; it is listed when archived and merged models are shown. */
  nameOf(id: string): string {
    const t = this.models().find(m => m.id === id);
    return t ? t.displayName ?? t.name : 'another model';
  }

  private parseSort(v: string | undefined): Sort {
    const m = /^(\w+),(asc|desc)$/.exec(v ?? '');
    return m && SORTS.includes(m[1]) ? { field: m[1], dir: m[2] as 'asc' | 'desc' } : DEFAULT_SORT;
  }
}
