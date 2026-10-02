import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {PageResponse, apiResource, resourceError} from '../../core/api';
import {ApiProductSummary, Category, toProduct} from '../../core/catalog.api';
import {ImageSlot} from '../../shared/image-slot';
import {ProductCard} from '../../shared/product-card';
import {ABOUT, POSTS, PROMISES} from './home.data';

const ALL = 'Tất cả';

@Component({
  selector: 'app-home-page',
  imports: [VndPipe, StateBox, RouterLink, ImageSlot, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.css'
})
export class HomePage {
  readonly branch = inject(BranchStore);
  readonly cart = inject(CartStore);
  readonly promises = PROMISES;
  readonly posts = POSTS;
  readonly about = ABOUT;

  private readonly categoriesRes = apiResource<Category[]>(() => ({path: '/categories'}), {defaultValue: []});
  // Re-fetches whenever the branch changes (prices/stock are per branch).
  private readonly productsRes = apiResource<PageResponse<ApiProductSummary>>(() => ({
    path: '/products',
    params: {branchId: this.branch.branchId(), sort: 'popular', size: 16}
  }));
  readonly categories = computed(() => (this.categoriesRes.hasValue() ? this.categoriesRes.value() : []));
  readonly products = computed(() => (this.productsRes.hasValue() ? this.productsRes.value().data.map(toProduct) : []));
  readonly loading = this.productsRes.isLoading;
  readonly error = computed(() => resourceError(this.productsRes)?.message ?? '');
  readonly tab = signal(ALL);
  readonly tabs = computed(() => [ALL, ...this.categories().filter(c => c.count > 0).slice(0, 3).map(c => c.name)]);
  readonly featured = computed(() => {
    const t = this.tab();
    const all = this.products().filter(p => !p.outOfStock);
    return (t === ALL ? all : all.filter(p => p.cat === t)).slice(0, 4);
  });
  readonly best = computed(() => this.products().slice(0, 4));

  reload(): void {
    this.productsRes.reload();
  }
}
