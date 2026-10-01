import {ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {map} from 'rxjs';
import {BranchStore} from '../../core/branch.store';
import {vnd} from '../../core/format';
import {toApiError} from '../../core/api';
import {CatalogApi, Category} from '../../core/catalog.api';
import {Product} from '../../core/mock-data';
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
  imports: [RouterLink, ImageSlot, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <nav class="crumb" aria-label="Breadcrumb"><a routerLink="/">Trang chủ</a> / <b>Sản phẩm</b></nav>
      <div class="top">
        <h1 class="page-title title">Tất cả sản phẩm</h1>
        <div class="search">
          <form class="search-box" (submit)="$event.preventDefault(); submit()">
            <input class="input" type="search" placeholder="Tìm gà, trứng, SKU…" aria-label="Tìm sản phẩm"
              [value]="qText()" (input)="onType($event)" (focus)="focused.set(true)" (blur)="blur()">
          </form>
          @if (focused() && suggestions().length) {
            <div class="sugg" role="listbox">
              <div class="sugg-h">Sản phẩm</div>
              @for (s of suggestions(); track s.id; let i = $index) {
                <a class="sugg-row" [class.on]="i === 0" role="option" [routerLink]="['/products', s.slug]">
                  <span class="sugg-img"><app-image-slot caption="Ảnh" [radius]="8" ratio="1 / 1" /></span>
                  <span class="grow">{{ s.name }}</span>
                  <span class="mono sku">{{ vnd(s.price) }}</span>
                </a>
              }
              @if (suggestCat(); as c) {
                <a class="sugg-cat" routerLink="/products" [queryParams]="{cat: c.slug}">Danh mục: {{ c.name }} ({{ c.count }} sản phẩm) →</a>
              }
            </div>
          }
        </div>
      </div>

      <button type="button" class="btn secondary filter-toggle" [attr.aria-expanded]="filtersOpen()" (click)="filtersOpen.set(!filtersOpen())">
        Bộ lọc{{ chips().length ? ' (' + chips().length + ')' : '' }}
      </button>

      <div class="layout">
        <aside class="filters" [class.open]="filtersOpen()">
          <div>
            <div class="f-title">Danh mục</div>
            <div class="f-list">
              @for (c of categories(); track c.id) {
                <label class="check">
                  <input type="checkbox" [checked]="cat() === c.slug" (change)="toggleCat(c.slug)">
                  <span class="box">{{ cat() === c.slug ? '✓' : '' }}</span>
                  <span class="grow">{{ c.name }}</span>
                  <span class="cnt">{{ c.count }}</span>
                </label>
              }
            </div>
          </div>
          <div>
            <div class="f-title">Khoảng giá</div>
            <div class="row">
              <input class="input" type="number" min="0" step="1000" placeholder="₫20.000" aria-label="Giá từ" [value]="minPrice() ?? ''" (change)="setPrice('min', $event)">
              <input class="input" type="number" min="0" step="1000" placeholder="₫250.000" aria-label="Giá đến" [value]="maxPrice() ?? ''" (change)="setPrice('max', $event)">
            </div>
          </div>
          <div>
            <div class="f-title">Chi nhánh</div>
            <select class="input" aria-label="Chi nhánh" [value]="branch.index()" (change)="pickBranch($event)">
              @for (b of branch.branches; track b.id; let i = $index) {
                <option [value]="i" [selected]="i === branch.index()">{{ b.name }}</option>
              }
            </select>
          </div>
          <div>
            <div class="f-title">Tình trạng</div>
            <div class="row between">
              <span>Còn hàng tại chi nhánh</span>
              <button type="button" class="toggle" [class.on]="inStock()" role="switch" [attr.aria-checked]="inStock()" aria-label="Chỉ hiện sản phẩm còn hàng" (click)="inStock.set(!inStock())"></button>
            </div>
          </div>
        </aside>

        <section>
          <div class="bar">
            <div class="row wrap">
              <span class="muted">{{ total() }} sản phẩm</span>
              @for (c of chips(); track c.key) {
                <button type="button" class="chip" (click)="c.clear()">{{ c.label }} ✕</button>
              }
            </div>
            <label class="sort">Sắp xếp:
              <select aria-label="Sắp xếp" (change)="onSort($event)">
                @for (s of sorts; track s.id) {
                  <option [value]="s.id" [selected]="s.id === sort()">{{ s.name }}</option>
                }
              </select>
            </label>
          </div>

          @if (loading()) {
            <div class="grid-p">
              @for (n of skeletons; track n) {
                <div class="skel" aria-hidden="true">
                  <div class="s-img"></div>
                  <div class="s-line w40"></div><div class="s-line w85"></div><div class="s-line w60"></div>
                </div>
              }
            </div>
          } @else if (error()) {
            <div class="state-box" role="alert">
              <div class="serif big">Không tải được sản phẩm.</div>
              <div>{{ error() }}</div>
              <button type="button" class="btn" (click)="reload()">Thử lại</button>
            </div>
          } @else if (!items().length) {
            <div class="state-box">
              <div class="serif big">Không tìm thấy sản phẩm phù hợp.</div>
              <div>Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.</div>
              <button type="button" class="btn" (click)="reset()">Xóa bộ lọc</button>
            </div>
          } @else {
            <div class="grid-p">
              @for (p of items(); track p.id) {
                <app-product-card [product]="p" />
              }
            </div>
            @if (pages() > 1) {
              <nav class="pager" aria-label="Phân trang">
                <button type="button" class="pg" aria-label="Trang trước" [disabled]="page() === 1" (click)="page.set(page() - 1)">‹</button>
                @for (n of pageNums(); track n) {
                  <button type="button" class="pg" [class.on]="n === page()" [attr.aria-current]="n === page() ? 'page' : null" (click)="page.set(n)">{{ n }}</button>
                }
                <button type="button" class="pg" aria-label="Trang sau" [disabled]="page() === pages()" (click)="page.set(page() + 1)">›</button>
              </nav>
            }
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .crumb { padding: 28px 0 0; font-size: 14px; color: var(--muted); }
    .crumb b { color: var(--ink); font-weight: 400; }
    .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; padding: 12px 0 32px; }
    .title { font-size: 56px; }
    .search { position: relative; width: 480px; max-width: 100%; }
    .search .input { border: 1.5px solid var(--primary); border-radius: 14px; padding: 14px 16px; font-size: 15px; }
    .sugg { position: absolute; top: 58px; left: 0; right: 0; background: var(--surface); border-radius: 14px; box-shadow: var(--shadow-pop); padding: 8px; z-index: 5; }
    .sugg-h { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); padding: 8px 10px; }
    .sugg-row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 10px; font-size: 14px; }
    .sugg-row.on, .sugg-row:hover { background: var(--surface-2); }
    .sugg-img { width: 40px; flex: none; }
    .sku { font-size: 12px; color: var(--muted); }
    .sugg-cat { display: block; border-top: 1px solid var(--line); margin-top: 6px; padding: 10px; font-size: 14px; color: var(--primary); font-weight: 600; }
    .grow { flex: 1; }
    .layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 48px; padding-bottom: 72px; }
    .filters { display: flex; flex-direction: column; gap: 32px; font-size: 15px; }
    .f-title { font-weight: 600; margin-bottom: 14px; }
    .f-list { display: flex; flex-direction: column; gap: 12px; }
    .check { display: flex; align-items: center; gap: 10px; cursor: pointer; position: relative; }
    .check input { position: absolute; opacity: 0; width: 20px; height: 20px; margin: 0; }
    .box { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid rgba(31, 42, 28, .3); color: #fff; font-size: 13px; display: flex; align-items: center; justify-content: center; }
    .check input:checked + .box { background: var(--primary); border-color: var(--primary); }
    .check input:focus-visible + .box, .check input:focus-visible + .dot { outline: 2px solid var(--primary); outline-offset: 2px; }
    .dot { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid rgba(31, 42, 28, .3); }
    .check input:checked + .dot { border: 6px solid var(--primary); }
    .cnt { color: rgba(31, 42, 28, .45); font-size: 13px; }
    .link { background: none; border: 0; padding: 0; text-align: left; color: var(--primary); font-weight: 600; font-size: 13px; }
    .row { display: flex; align-items: center; gap: 8px; }
    .row.wrap { flex-wrap: wrap; }
    .row.between { justify-content: space-between; }
    .row .input { padding: 9px 12px; }
    .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .chip { background: var(--tint); color: var(--primary); padding: 6px 12px; border-radius: 999px; font-weight: 500; font-size: 14px; border: 0; }
    .sort { display: flex; align-items: center; gap: 8px; border: 1px solid rgba(31, 42, 28, .18); border-radius: 10px; padding: 8px 12px; background: var(--surface); font-size: 14px; }
    .sort select { border: 0; background: transparent; font-weight: 700; }
    .grid-p { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
    .pager { display: flex; justify-content: center; gap: 8px; margin-top: 40px; }
    .pg { width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(31, 42, 28, .18); background: transparent; font-size: 15px; font-weight: 500; }
    .pg.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .pg:disabled { opacity: .4; cursor: not-allowed; }
    .big { font-size: 24px; color: var(--ink); }
    .skel { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .s-img, .s-line { background: linear-gradient(90deg, #ece5d5, #f5efe2, #ece5d5); border-radius: 12px; }
    .s-img { height: 200px; }
    .s-line { height: 14px; border-radius: 6px; }
    .w40 { width: 40%; } .w60 { width: 60%; } .w85 { width: 85%; }
    .filter-toggle { display: none; margin-bottom: 16px; }
    @media (max-width: 1100px) { .grid-p { grid-template-columns: repeat(2, minmax(0, 1fr)); } .title { font-size: 44px; } }
    @media (max-width: 767px) {
      .top { flex-direction: column; align-items: stretch; gap: 16px; padding-bottom: 16px; }
      .title { font-size: 30px; }
      .search { width: 100%; }
      .filter-toggle { display: inline-flex; }
      .layout { grid-template-columns: 1fr; gap: 16px; }
      .filters { display: none; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 18px; gap: 22px; }
      .filters.open { display: flex; }
      .grid-p { gap: 12px; }
    }
  `
})
export class ProductsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogApi);
  readonly branch = inject(BranchStore);
  readonly vnd = vnd;
  readonly categories = signal<Category[]>([]);
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
  readonly loading = signal(true);
  readonly error = signal('');
  readonly sort = signal<Sort>('best');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly inStock = signal(false);

  readonly items = signal<Product[]>([]);
  readonly total = signal(0);
  readonly pages = signal(1);

  /** Everything except the page number; when it changes the page falls back to 1. */
  private readonly filterKey = computed(() => JSON.stringify([this.q(), this.cat(), this.minPrice(), this.maxPrice(), this.inStock(), this.sort(), this.branch.branchId()]));
  readonly page = linkedSignal<string, number>({source: this.filterKey, computation: () => 1});
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

  private seq = 0;
  private readonly reloadTick = signal(0);

  constructor() {
    this.catalog.categories().then(c => this.categories.set(c)).catch(() => undefined);
    effect(() => {
      const query = {
        q: this.q(),
        category: this.cat(),
        branchId: this.branch.branchId(),
        minPrice: this.minPrice(),
        maxPrice: this.maxPrice(),
        inStock: this.inStock(),
        sort: API_SORT[this.sort()],
        page: this.page() - 1,
        size: PAGE_SIZE
      };
      this.reloadTick();
      untracked(() => void this.load(query));
    });
  }

  reload(): void {
    this.reloadTick.update(n => n + 1);
  }

  private async load(query: Parameters<CatalogApi['search']>[0]): Promise<void> {
    const my = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.catalog.search(query);
      if (my !== this.seq) return;
      this.items.set(r.items);
      this.total.set(r.meta.totalElements);
      this.pages.set(Math.max(1, r.meta.totalPages));
    } catch (e) {
      if (my !== this.seq) return;
      this.items.set([]);
      this.total.set(0);
      this.error.set(toApiError(e).message);
    } finally {
      if (my === this.seq) this.loading.set(false);
    }
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
