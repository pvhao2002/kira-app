import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {PageResponse, apiResource, resourceError} from '../../core/api';
import {ApiProductDetail, ApiReview, toProduct} from '../../core/catalog.api';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {WishlistStore} from '../../core/wishlist.store';
import {ImageSlot} from '../../shared/image-slot';
import {QtyStepper} from '../../shared/qty-stepper';
import {Stars} from '../../shared/stars';

type TabId = 'desc' | 'reviews';

@Component({
  selector: 'app-product-detail-page',
  imports: [VndPipe, StateBox, RouterLink, ImageSlot, QtyStepper, Stars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.css'
})
export class ProductDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly branch = inject(BranchStore);
  private readonly cart = inject(CartStore);
  protected readonly wish = inject(WishlistStore);

  private readonly slug = toSignal(this.route.paramMap.pipe(map(p => p.get('slug') ?? '')), {initialValue: ''});
  private readonly detailRes = apiResource<ApiProductDetail>(() => ({path: '/products/' + encodeURIComponent(this.slug())}));
  // Reviews load once the product is on screen; a failure just leaves the list empty.
  private readonly reviewsRes = apiResource<PageResponse<ApiReview>>(() =>
    this.detailRes.hasValue() ? {path: `/products/${encodeURIComponent(this.slug())}/reviews`, params: {size: 5}} : undefined);
  readonly detail = computed(() => (this.detailRes.hasValue() ? this.detailRes.value() : null));
  readonly reviews = computed(() => (this.reviewsRes.hasValue() ? this.reviewsRes.value().data : []));
  readonly loading = this.detailRes.isLoading;
  /** A 404 is not an error here: the template shows its "not found" copy instead. */
  readonly error = computed(() => {
    const err = resourceError(this.detailRes);
    return err && err.status !== 404 ? err.message : '';
  });
  readonly product = computed(() => {
    const d = this.detail();
    return d ? toProduct(d.product) : undefined;
  });

  readonly tab = signal<TabId>('desc');
  readonly shot = signal(1);
  /** Quantity resets to 1 when the product changes. */
  readonly qty = linkedSignal<string, number>({source: this.slug, computation: () => 1});
  readonly added = signal(false);

  readonly stock = computed(() => this.detail()?.product.available ?? 0);
  readonly stockText = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const where = d.branch.name.split(' – ')[0];
    return d.product.available > 0 ? `Còn ${d.product.available} ${d.product.unit} tại ${where}` : `Hết hàng tại ${where}`;
  });

  readonly specs = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const rows = [
      {k: 'Danh mục', v: d.product.categoryName},
      {k: 'Xuất xứ', v: d.product.origin ?? ''},
      {k: 'Đơn vị', v: d.product.unit},
      {k: 'Chi nhánh', v: d.branch.name},
      {k: 'SKU', v: d.sku}
    ];
    return rows.filter(r => r.v);
  });

  readonly similar = computed(() =>
    (this.detail()?.otherBranches ?? [])
      .filter(o => o.inStock)
      .map(o => ({...o, color: this.branch.themeOf(o.branchId - 1)?.primary ?? 'var(--primary)'})));

  constructor() {
    // Follow the product's branch so the header/theme match what is on screen.
    effect(() => {
      const d = this.detail();
      if (d && untracked(() => this.branch.branchId()) !== d.branch.id) this.branch.select(d.branch.id - 1);
    });
    // The user picked another branch: jump to that branch's own listing of the same item (slugs are per branch).
    effect(() => {
      const id = this.branch.branchId();
      const d = untracked(() => this.detail());
      if (!d || d.branch.id === id) return;
      const other = d.otherBranches.find(o => o.branchId === id);
      if (other) void this.router.navigate(['/products', other.slug], {replaceUrl: true});
      else void this.router.navigate(['/products']);
    });
  }

  dateText(iso: string): string {
    return new Date(iso).toLocaleDateString('vi-VN');
  }

  add(): void {
    const p = this.product();
    if (!p || this.stock() === 0) return;
    this.cart.add(p, this.qty());
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }

  buyNow(): void {
    this.add();
    void this.router.navigateByUrl('/checkout');
  }
}
