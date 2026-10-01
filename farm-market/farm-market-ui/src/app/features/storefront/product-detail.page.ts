import {ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {toApiError} from '../../core/api';
import {ApiProductDetail, ApiReview, CatalogApi, toProduct} from '../../core/catalog.api';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {WishlistStore} from '../../core/wishlist.store';
import {vnd} from '../../core/format';
import {ImageSlot} from '../../shared/image-slot';
import {QtyStepper} from '../../shared/qty-stepper';
import {Stars} from '../../shared/stars';

type TabId = 'desc' | 'reviews';

@Component({
  selector: 'app-product-detail-page',
  imports: [RouterLink, ImageSlot, QtyStepper, Stars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (product(); as p) {
      <div class="container">
        <nav class="crumb" aria-label="Breadcrumb">
          <a routerLink="/">Trang chủ</a> / <a routerLink="/products" [queryParams]="{cat: p.categorySlug}">{{ p.cat }}</a> / <b>{{ p.name }}</b>
        </nav>
        <div class="top">
          <div class="thumbs">
            @for (t of [1, 2, 3, 4]; track t) {
              <button type="button" class="thumb" [class.on]="t === shot()" [attr.aria-label]="'Ảnh ' + t" (click)="shot.set(t)">
                <app-image-slot caption="Ảnh" [radius]="10" ratio="1 / 1" />
              </button>
            }
          </div>
          <div class="main-img"><app-image-slot [caption]="'Ảnh chính: ' + p.ph" [radius]="24" ratio="auto" class="fill" /></div>

          <div class="info">
            <div class="row wrap tags">
              @if (p.badge) {
                <span class="pill accent">{{ p.badge }}</span>
              }
              <span class="pill ok" [class.bad]="stock() === 0">{{ stockText() }}</span>
            </div>
            <h1>{{ p.name }}</h1>
            <div class="rate"><app-stars [value]="p.rating" /> <b>{{ p.rating }}</b> <span class="muted">· {{ p.reviews }} đánh giá @if (p.sold) {· Đã bán {{ p.sold.replace(' đã bán', '') }}}</span></div>
            <div class="price-row">
              <span class="price">{{ vnd(p.price) }}</span>
              @if (p.old) {
                <s class="old">{{ vnd(p.old) }}</s>
              }
              <span class="muted">/ {{ p.unit }}</span>
            </div>
            @if (detail()?.description; as d) {
              <p class="lead">{{ d }}</p>
            }

            <div class="buy">
              <app-qty-stepper [value]="qty()" (changed)="qty.set($event)" />
              <button type="button" class="btn buy-btn" [disabled]="stock() === 0" (click)="add()">
                {{ stock() === 0 ? 'Hết hàng tại chi nhánh' : 'Thêm vào giỏ · ' + vnd(p.price * qty()) }}
              </button>
            </div>
            <button type="button" class="btn secondary" [attr.aria-pressed]="wish.has(p.productId)" (click)="wish.toggle(p.productId)">
              {{ wish.has(p.productId) ? '♥ Đã yêu thích' : '♡ Thêm vào yêu thích' }}
            </button>
            <button type="button" class="btn accent buy-now" [disabled]="stock() === 0" (click)="buyNow()">Mua ngay</button>
            @if (added()) {
              <div class="pill ok flash" role="status">Đã thêm vào giỏ hàng</div>
            }

            <div class="similar card">
              <div class="sim-head"><b>Có ở chi nhánh khác</b><span class="muted sm">{{ similar().length }} chi nhánh</span></div>
              <div class="muted sm mb">Mỗi chi nhánh tự nhập hàng, nên giá và tồn kho có thể khác nhau.</div>
              @for (r of similar(); track r.branchId) {
                <div class="sim-row">
                  <span class="sim-img"><app-image-slot caption="Ảnh" [radius]="10" ratio="1 / 1" /></span>
                  <div class="grow">
                    <div class="sim-name">{{ r.branchName }}</div>
                    <div class="sim-meta"><i class="dot" [style.background]="r.color"></i>{{ r.available < 10 ? 'Còn ' + r.available : 'Còn hàng' }}</div>
                  </div>
                  <div class="sim-r">
                    <div class="sim-price" [style.color]="r.color">{{ vnd(r.price) }}</div>
                    <button type="button" class="sim-go" [style.color]="r.color" (click)="branch.select(r.branchId - 1)">Xem →</button>
                  </div>
                </div>
              } @empty {
                <div class="muted sm">Hiện chưa chi nhánh nào khác còn hàng.</div>
              }
            </div>

            <dl class="specs">
              @for (s of specs(); track s.k) {
                <dt>{{ s.k }}</dt><dd>{{ s.v }}</dd>
              }
            </dl>
          </div>
        </div>

        <div class="tabs-wrap">
          <div class="tabs" role="tablist">
            <button type="button" role="tab" class="tab" [class.on]="tab() === 'desc'" [attr.aria-selected]="tab() === 'desc'" (click)="tab.set('desc')">Mô tả sản phẩm</button>
            <button type="button" role="tab" class="tab" [class.on]="tab() === 'reviews'" [attr.aria-selected]="tab() === 'reviews'" (click)="tab.set('reviews')">Đánh giá ({{ p.reviews }})</button>
          </div>
          @if (tab() === 'desc') {
            <div class="prose">
              <p>{{ detail()?.description || 'Sản phẩm từ trại Đồi Nắng, giao từ chi nhánh gần bạn.' }}</p>
            </div>
          } @else {
            <div class="reviews">
              <div>
                <div class="serif big">{{ p.rating }}</div>
                <app-stars [value]="p.rating" />
                <div class="muted sm mb">{{ p.reviews }} đánh giá</div>
              </div>
              <div>
                @for (r of reviews(); track r.id) {
                  <article class="rev">
                    <div class="rev-h"><b>{{ r.author }} <span class="verified">· Đã mua hàng</span></b><span class="muted sm">{{ dateText(r.createdAt) }}</span></div>
                    <app-stars [value]="r.rating" />
                    <p>{{ r.body }}</p>
                    @if (r.reply) {
                      <p class="muted sm">Phản hồi từ Đồi Nắng: {{ r.reply.body }}</p>
                    }
                  </article>
                } @empty {
                  <div class="muted">Chưa có đánh giá nào.</div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    } @else if (loading()) {
      <div class="container nf"><div class="state-box" role="status">Đang tải sản phẩm…</div></div>
    } @else {
      <div class="container nf">
        <div class="state-box" role="alert">
          <div class="serif big">{{ error() ? 'Không tải được sản phẩm.' : 'Không tìm thấy sản phẩm.' }}</div>
          <div>{{ error() || 'Sản phẩm có thể đã ngừng bán hoặc đường dẫn không đúng.' }}</div>
          <a class="btn" routerLink="/products">Khám phá sản phẩm</a>
        </div>
      </div>
    }
  `,
  styles: `
    h1 { font-family: var(--serif); font-weight: 400; font-size: 52px; line-height: 1.05; letter-spacing: -.02em; margin-bottom: 14px; }
    .crumb { padding: 28px 0 20px; font-size: 14px; color: var(--muted); }
    .crumb b { color: var(--ink); font-weight: 400; }
    .sm { font-size: 13px; }
    .mb { margin-bottom: 12px; }
    .grow { flex: 1; min-width: 0; }
    .row { display: flex; gap: 8px; }
    .row.wrap { flex-wrap: wrap; }
    .top { display: grid; grid-template-columns: 96px minmax(0, 1fr) minmax(0, 1fr); gap: 20px 40px; padding-bottom: 72px; }
    .thumbs { display: flex; flex-direction: column; gap: 12px; }
    .thumb { border: 2px solid transparent; border-radius: 14px; padding: 2px; background: none; }
    .thumb.on { border-color: var(--primary); }
    .main-img { height: 640px; }
    .fill { height: 100%; }
    .info { padding-top: 8px; }
    .tags { margin-bottom: 18px; }
    .rate { font-size: 15px; margin-bottom: 24px; }
    .price-row { display: flex; align-items: baseline; gap: 14px; margin-bottom: 22px; }
    .price { font-size: 36px; font-weight: 700; color: var(--primary); }
    .old { font-size: 18px; color: rgba(31, 42, 28, .45); }
    .lead { font-size: 16px; line-height: 1.6; color: rgba(31, 42, 28, .72); max-width: 520px; margin-bottom: 28px; }
    .lot { background: var(--surface); border: 1px dashed rgba(139, 94, 60, .5); border-radius: 16px; padding: 18px 20px; margin-bottom: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; font-size: 13px; }
    .lot span { display: block; color: var(--brown); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; font-size: 11px; margin-bottom: 4px; }
    .buy { display: flex; gap: 12px; margin-bottom: 14px; align-items: center; }
    .buy-btn { flex: 1; height: 56px; font-size: 16px; }
    .buy-now { width: 100%; height: 56px; font-size: 16px; margin-bottom: 32px; }
    .flash { margin: -18px 0 20px; }
    .similar { padding: 18px 20px; margin-bottom: 28px; border-radius: 16px; }
    .sim-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; gap: 8px; }
    .sim-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid rgba(31, 42, 28, .08); }
    .sim-img { width: 48px; flex: none; }
    .sim-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sim-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .sim-r { text-align: right; }
    .sim-price { font-weight: 700; font-size: 14px; }
    .sim-go { background: none; border: 0; padding: 0; font-size: 12px; font-weight: 600; }
    .specs { display: grid; grid-template-columns: 150px 1fr; font-size: 14px; border-top: 1px solid rgba(31, 42, 28, .12); margin: 0; }
    .specs dt, .specs dd { padding: 11px 0; border-bottom: 1px solid rgba(31, 42, 28, .08); margin: 0; }
    .specs dt { color: var(--muted); }
    .tabs-wrap { padding-bottom: 72px; }
    .tabs { display: flex; gap: 36px; border-bottom: 1px solid rgba(31, 42, 28, .14); margin-bottom: 36px; overflow-x: auto; }
    .tab { background: none; border: 0; border-bottom: 2px solid transparent; padding: 0 0 14px; font-size: 16px; font-weight: 500; color: var(--muted); white-space: nowrap; margin-bottom: -1px; }
    .tab.on { color: var(--primary); border-color: var(--primary); }
    .two { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 64px; }
    .prose { font-size: 16px; line-height: 1.7; color: rgba(31, 42, 28, .78); }
    .prose p { margin-bottom: 16px; }
    .tips { padding-left: 20px; display: flex; flex-direction: column; gap: 10px; }
    .nutri { border-radius: 20px; padding: 24px 28px; }
    .nutri.wide { max-width: 520px; }
    .nut-grid { display: grid; grid-template-columns: 1fr auto; gap: 10px; font-size: 14px; margin-top: 14px; }
    .reviews { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 56px; }
    .big { font-size: 64px; line-height: 1; }
    .bars { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
    .bar-row { display: flex; align-items: center; gap: 10px; }
    .bs { width: 14px; }
    .bn { width: 30px; }
    .track { flex: 1; height: 6px; background: rgba(31, 42, 28, .1); border-radius: 6px; overflow: hidden; }
    .fill-bar { height: 100%; background: var(--primary); }
    .rev { padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid rgba(31, 42, 28, .1); }
    .rev-h { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
    .verified { font-weight: 400; color: var(--primary); font-size: 13px; }
    .rev p { font-size: 15px; line-height: 1.6; color: rgba(31, 42, 28, .78); margin-top: 8px; }
    .nf { padding-top: 48px; }
    @media (max-width: 1100px) { .top { grid-template-columns: 72px minmax(0, 1fr); } .info { grid-column: 1 / -1; } .main-img { height: 460px; } }
    @media (max-width: 767px) {
      h1 { font-size: 32px; }
      .top { grid-template-columns: 1fr; gap: 16px; padding-bottom: 40px; }
      .thumbs { flex-direction: row; order: 2; }
      .thumb { width: 64px; }
      .main-img { height: 320px; order: 1; }
      .info { order: 3; }
      .price { font-size: 28px; }
      .lot { grid-template-columns: 1fr 1fr 1fr; padding: 14px; }
      .specs { grid-template-columns: 120px 1fr; }
      .two, .reviews { grid-template-columns: 1fr; gap: 28px; }
      .tabs { gap: 22px; }
      .big { font-size: 48px; }
    }
  `
})
export class ProductDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogApi);
  readonly branch = inject(BranchStore);
  private readonly cart = inject(CartStore);
  protected readonly wish = inject(WishlistStore);
  readonly vnd = vnd;

  private readonly slug = toSignal(this.route.paramMap.pipe(map(p => p.get('slug') ?? '')), {initialValue: ''});
  readonly detail = signal<ApiProductDetail | null>(null);
  readonly reviews = signal<ApiReview[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
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

  private seq = 0;

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => void this.load(slug));
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

  private async load(slug: string): Promise<void> {
    const my = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    this.detail.set(null);
    this.reviews.set([]);
    try {
      const d = await this.catalog.detail(slug);
      if (my !== this.seq) return;
      this.detail.set(d);
      // Follow the product's branch so the header/theme match what is on screen.
      if (this.branch.branchId() !== d.branch.id) this.branch.select(d.branch.id - 1);
      this.catalog.reviews(slug).then(r => { if (my === this.seq) this.reviews.set(r.data); }).catch(() => undefined);
    } catch (e) {
      if (my !== this.seq) return;
      const err = toApiError(e);
      this.error.set(err.status === 404 ? '' : err.message);
    } finally {
      if (my === this.seq) this.loading.set(false);
    }
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
