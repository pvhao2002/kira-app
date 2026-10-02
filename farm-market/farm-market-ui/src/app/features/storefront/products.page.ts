import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {BranchStore} from '../../core/branch.store';
import {PageResponse, apiResource, resourceError} from '../../core/api';
import {ApiProductSummary, Category, toProduct} from '../../core/catalog.api';
import {ImageSlot} from '../../shared/image-slot';
import {ProductCard} from '../../shared/product-card';

const PAGE_SIZE = 12;
type Sort = 'best' | 'asc' | 'desc' | 'rating';
const SORTS: {id: Sort; name: string}[] = [
  {id: 'best', name: 'Bán chạy'},
  {id: 'asc', name: 'Giá tăng dần'},
  {id: 'desc', name: 'Giá giảm dần'},
  {id: 'rating', name: 'Đánh giá cao'}
];
const API_SORT: Record<Sort, string> = {best: 'popular', asc: 'price_asc', desc: 'price_desc', rating: 'rating'};

@Component({
  selector: 'app-products-page',
  imports: [VndPipe, StateBox, RouterLink, ImageSlot, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.page.html',
  styleUrl: './products.page.css'
})
export class ProductsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly branch = inject(BranchStore);
  private readonly categoriesRes = apiResource<Category[]>(() => ({path: '/categories'}), {defaultValue: []});
  readonly categories = computed(() => (this.categoriesRes.hasValue() ? this.categoriesRes.value() : []));
  readonly sorts = SORTS;
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  private readonly params = toSignal(this.route.queryParamMap.pipe(map(p => ({q: p.get('q') ?? '', cat: p.get('cat') ?? ''}))), {
    initialValue: {q: '', cat: ''}
  });
  readonly q = computed(() => this.params().q.trim());
  /** Category slug (the API filters by a single category). */
  readonly cat = computed(() => this.params().cat);

  readonly qText = linkedSignal(() => this.q());
  readonly focused = signal(false);
  readonly filtersOpen = signal(false);
  readonly sort = signal<Sort>('best');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly inStock = signal(false);

  /** Everything except the page number; when it changes the page falls back to 1. */
  private readonly filterKey = computed(() => JSON.stringify([this.q(), this.cat(), this.minPrice(), this.maxPrice(), this.inStock(), this.sort(), this.branch.branchId()]));
  readonly page = linkedSignal<string, number>({source: this.filterKey, computation: () => 1});
  private readonly productsRes = apiResource<PageResponse<ApiProductSummary>>(() => ({
    path: '/products',
    params: {
      q: this.q(),
      category: this.cat(),
      branchId: this.branch.branchId(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      inStock: this.inStock() || undefined,
      sort: API_SORT[this.sort()],
      page: this.page() - 1,
      size: PAGE_SIZE
    }
  }));
  readonly loading = this.productsRes.isLoading;
  readonly error = computed(() => resourceError(this.productsRes)?.message ?? '');
  readonly items = computed(() => (this.productsRes.hasValue() ? this.productsRes.value().data.map(toProduct) : []));
  readonly total = computed(() => (this.productsRes.hasValue() ? this.productsRes.value().meta.totalElements : 0));
  readonly pages = computed(() => (this.productsRes.hasValue() ? Math.max(1, this.productsRes.value().meta.totalPages) : 1));
  readonly pageNums = computed(() => Array.from({length: this.pages()}, (_, i) => i + 1));

  readonly suggestions = computed(() => {
    const t = this.qText().trim().toLowerCase();
    return t ? this.items().filter(p => p.name.toLowerCase().includes(t)).slice(0, 5) : [];
  });
  readonly suggestCat = computed(() => {
    const first = this.suggestions()[0];
    return first ? this.categories().find(c => c.slug === first.categorySlug) : undefined;
  });

  readonly chips = computed(() => {
    const out: {key: string; label: string; clear: () => void}[] = [];
    if (this.q()) out.push({key: 'q', label: `"${this.q()}"`, clear: () => this.setQuery({q: null})});
    const c = this.categories().find(x => x.slug === this.cat());
    if (this.cat()) out.push({key: 'c', label: c?.name ?? this.cat(), clear: () => this.setQuery({cat: null})});
    if (this.minPrice() !== null || this.maxPrice() !== null) {
      out.push({key: 'p', label: 'Khoảng giá', clear: () => { this.minPrice.set(null); this.maxPrice.set(null); }});
    }
    if (this.inStock()) out.push({key: 's', label: 'Còn hàng', clear: () => this.inStock.set(false)});
    return out;
  });

  reload(): void {
    this.productsRes.reload();
  }

  private setQuery(patch: {q?: string | null; cat?: string | null}): void {
    void this.router.navigate([], {relativeTo: this.route, queryParams: patch, queryParamsHandling: 'merge', replaceUrl: true});
  }

  onType(ev: Event): void {
    this.qText.set((ev.target as HTMLInputElement).value);
  }

  submit(): void {
    this.setQuery({q: this.qText().trim() || null});
    this.focused.set(false);
  }

  /** Delay so a click on a suggestion registers before the dropdown disappears. */
  blur(): void {
    setTimeout(() => this.focused.set(false), 150);
  }

  toggleCat(slug: string): void {
    this.setQuery({cat: this.cat() === slug ? null : slug});
  }

  setPrice(which: 'min' | 'max', ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const v = raw === '' ? null : Math.max(0, Math.round(Number(raw)));
    (which === 'min' ? this.minPrice : this.maxPrice).set(v);
  }

  pickBranch(ev: Event): void {
    this.branch.select(Number((ev.target as HTMLSelectElement).value));
  }

  onSort(ev: Event): void {
    this.sort.set((ev.target as HTMLSelectElement).value as Sort);
  }

  reset(): void {
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.inStock.set(false);
    this.setQuery({q: null, cat: null});
  }
}
