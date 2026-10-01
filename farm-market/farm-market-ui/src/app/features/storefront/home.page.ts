import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {vnd} from '../../core/format';
import {toApiError} from '../../core/api';
import {CatalogApi, Category} from '../../core/catalog.api';
import {Product} from '../../core/mock-data';
import {ImageSlot} from '../../shared/image-slot';
import {ProductCard} from '../../shared/product-card';
import {ABOUT, POSTS, PROMISES} from './home.data';

const ALL = 'Tất cả';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, ImageSlot, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container hero">
      <div class="hero-copy">
        <span class="tag">Trứng thu hoạch lúc 6:10 sáng nay</span>
        <h1>Thực phẩm tươi sạch từ <i>nông trại</i> đến bàn ăn</h1>
        <p>Gà, trứng và các sản phẩm chăn nuôi được tuyển chọn kỹ càng, đảm bảo chất lượng và nguồn gốc rõ ràng.</p>
        <div class="row wrap">
          <a class="btn lg" routerLink="/products">Mua ngay</a>
          <a class="btn lg outline" routerLink="/products">Khám phá sản phẩm</a>
        </div>
      </div>
      <div class="hero-media">
        <app-image-slot class="hero-img" caption="Ảnh: đàn gà thả vườn trên đồi cỏ, nắng sớm" [radius]="28" ratio="auto" />
        <div class="farm-tag">
          <div class="ft-head"><span>Farm tag</span><span>Lô TG-0927</span></div>
          <div class="serif ft-name">Trứng gà ta – 10 quả</div>
          <dl>
            <dt>Trại</dt><dd>Đồi Nắng, Đơn Dương – Lâm Đồng</dd>
            <dt>Thu hoạch</dt><dd>06:10, 30/09/2026</dd>
            <dt>Chăn nuôi</dt><dd>Thả vườn, ăn ngô &amp; cám</dd>
          </dl>
        </div>
      </div>
    </section>

    <section class="container sec">
      <div class="sec-head"><h2>Danh mục</h2><a routerLink="/products" class="more">Tất cả sản phẩm →</a></div>
      <div class="cats">
        @for (c of categories(); track c.id) {
          <a class="cat" routerLink="/products" [queryParams]="{cat: c.slug}">
            <app-image-slot class="cat-img" [caption]="c.name" [radius]="18" ratio="auto" />
            <span class="cat-row"><b>{{ c.name }}</b><span class="muted">{{ c.count }}</span></span>
          </a>
        }
      </div>
    </section>

    <section class="container sec">
      <div class="sec-head">
        <h2>Sản phẩm nổi bật</h2>
        <div class="row" role="tablist">
          @for (t of tabs(); track t) {
            <button type="button" role="tab" class="tab-pill" [class.on]="tab() === t" [attr.aria-selected]="tab() === t" (click)="tab.set(t)">{{ t }}</button>
          }
        </div>
      </div>
      @if (loading()) {
        <div class="state-box" role="status">Đang tải sản phẩm…</div>
      } @else if (error()) {
        <div class="state-box" role="alert">{{ error() }} <button type="button" class="btn" (click)="reload()">Thử lại</button></div>
      } @else if (featured().length) {
        <div class="featured">
          @for (p of featured(); track p.id) {
            <app-product-card [product]="p" />
          }
        </div>
      } @else {
        <div class="state-box">Chưa có sản phẩm trong nhóm này.</div>
      }
    </section>

    <section class="container sec">
      <div class="best">
        <div>
          <h2>Được khách hàng yêu thích</h2>
          <p>Bán chạy nhất 30 ngày qua.</p>
        </div>
        <div class="best-list">
          @for (p of best(); track p.id; let i = $index) {
            <div class="best-item">
              <span class="rank serif">{{ i + 1 }}</span>
              <a [routerLink]="['/products', p.slug]" class="thumb"><app-image-slot [caption]="p.ph" [radius]="12" ratio="1 / 1" /></a>
              <div class="best-info">
                <a [routerLink]="['/products', p.slug]" class="best-name">{{ p.name }}</a>
                <div class="muted sm">★ {{ p.rating }} · {{ p.sold }}</div>
                <div class="best-price">{{ vnd(p.price) }} <span class="unit">/ {{ p.unit }}</span></div>
              </div>
              <button type="button" class="plus" [attr.aria-label]="'Thêm ' + p.name + ' vào giỏ'" (click)="cart.add(p)">+</button>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="promises">
      <div class="container">
        <h2>Cam kết của trang trại</h2>
        <div class="pgrid">
          @for (c of promises; track c.n) {
            <div class="pitem"><span class="serif pn">{{ c.n }}</span><b>{{ c.t }}</b><span class="pd">{{ c.d }}</span></div>
          }
        </div>
      </div>
    </section>

    <section class="container about">
      <app-image-slot class="about-img" caption="Ảnh: chuồng gà và đồi trang trại Đồi Nắng" [radius]="28" ratio="auto" />
      <div>
        <div class="eyebrow">Về trang trại</div>
        <h2 class="about-title">12 hecta đồi cỏ ở Đơn Dương, Lâm Đồng</h2>
        <div class="about-grid">
          @for (a of about; track a.t) {
            <div><b>{{ a.t }}</b><p>{{ a.d }}</p></div>
          }
        </div>
        <a class="btn lg outline" routerLink="/">Về trang trại</a>
      </div>
    </section>

    <section class="container sec">
      <div class="sec-head"><h2>Từ nông trại</h2><a routerLink="/" class="more">Tất cả bài viết →</a></div>
      <div class="posts">
        @for (b of posts; track b.id) {
          <article class="post">
            <app-image-slot class="post-img" [caption]="b.ph" [radius]="18" ratio="auto" />
            <div class="eyebrow">{{ b.tag }} · {{ b.read }}</div>
            <h3>{{ b.title }}</h3>
          </article>
        }
      </div>
    </section>

    <section class="container sec">
      <div class="sec-head">
        <div><h2>Hệ thống cửa hàng</h2><div class="muted lead">Hàng về từ trại mỗi sáng. Nhận tại cửa hàng hoặc giao từ chi nhánh gần nhất.</div></div>
        <a routerLink="/" class="more">Tìm cửa hàng →</a>
      </div>
      <div class="stores">
        <app-image-slot class="map" caption="Bản đồ các chi nhánh (TP.HCM, Đà Lạt)" [radius]="24" ratio="auto" />
        <div class="store-list">
          @for (b of branch.branches; track b.id; let i = $index) {
            <button type="button" class="store" [class.on]="branch.index() === i" (click)="branch.select(i)">
              <span class="grow">
                <span class="store-name"><b>{{ b.name }}</b><span class="pill" [class.ok]="b.open" [class.bad]="!b.open">{{ b.open ? 'Đang mở cửa' : 'Tạm đóng' }}</span></span>
                <span class="muted">{{ b.addr }}</span>
              </span>
              <span class="store-meta"><b>{{ b.dist }}</b>{{ b.hours }}</span>
            </button>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    h1, h2, h3 { font-family: var(--serif); font-weight: 400; letter-spacing: -.02em; }
    h2 { font-size: 44px; }
    .sm { font-size: 13px; }
    .btn.lg { padding: 16px 30px; font-size: 16px; }
    .btn.outline { background: transparent; color: var(--primary); border: 1.5px solid var(--primary); }
    .hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 56px; padding-top: 56px; padding-bottom: 72px; align-items: center; }
    .tag { display: inline-flex; background: var(--accent); color: var(--brown-dark); font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 999px; margin-bottom: 24px; }
    .hero h1 { font-size: 76px; line-height: 1.02; margin-bottom: 24px; text-wrap: balance; }
    .hero h1 i { color: var(--primary); }
    .hero p { font-size: 19px; line-height: 1.55; color: rgba(31, 42, 28, .72); max-width: 520px; margin-bottom: 36px; }
    .hero-media { position: relative; height: 560px; }
    .hero-img { position: absolute; inset: 0 0 0 70px; width: auto; height: auto; }
    .farm-tag { position: absolute; left: 0; bottom: 48px; width: 300px; background: var(--surface); border-radius: 18px; padding: 20px 22px; box-shadow: var(--shadow-pop); }
    .ft-head { display: flex; justify-content: space-between; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--brown); font-weight: 600; margin-bottom: 12px; }
    .ft-name { font-size: 22px; margin-bottom: 12px; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: 13px; margin: 0; }
    dt { color: rgba(31, 42, 28, .55); }
    dd { margin: 0; }
    .sec { padding-bottom: 80px; }
    .sec-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .more { font-weight: 600; font-size: 15px; }
    .lead { font-size: 16px; margin-top: 8px; }
    .cats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px; }
    .cat { display: flex; flex-direction: column; gap: 14px; }
    .cat-img { height: 200px; }
    .cat-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 17px; }
    .cat-row .muted { font-size: 13px; }
    .featured { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; }
    .best { background: var(--accent); border-radius: 28px; padding: 48px; display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 48px; }
    .best h2 { font-size: 44px; line-height: 1.05; color: #3d2a17; margin-bottom: 16px; }
    .best p { color: var(--brown-dark); font-size: 16px; }
    .best-list { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .best-item { display: flex; align-items: center; gap: 18px; background: var(--surface); border-radius: 18px; padding: 12px 18px 12px 12px; }
    .rank { font-size: 36px; color: var(--brown); width: 30px; text-align: center; }
    .thumb { width: 96px; flex: none; }
    .best-info { flex: 1; min-width: 0; }
    .best-name { display: block; font-weight: 600; font-size: 16px; margin-bottom: 4px; }
    .best-price { font-weight: 700; color: var(--primary); margin-top: 8px; }
    .unit { font-weight: 400; font-size: 13px; color: var(--muted); }
    .plus { width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--primary); color: #fff; font-size: 22px; flex: none; }
    .plus:hover { background: var(--primary-dark); }
    .promises { background: var(--primary); color: #f7f2e7; padding: 72px 0; margin-bottom: 88px; }
    .promises h2 { margin-bottom: 44px; max-width: 640px; }
    .pgrid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-top: 1px solid rgba(247, 242, 231, .25); }
    .pitem { padding: 24px 24px 0 0; display: flex; flex-direction: column; gap: 12px; }
    .pn { font-size: 18px; color: var(--accent); }
    .pitem b { font-size: 19px; }
    .pd { font-size: 14px; line-height: 1.55; color: rgba(247, 242, 231, .72); }
    .about { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; padding-bottom: 88px; align-items: center; }
    .about-img { height: 520px; }
    .about-title { font-size: 48px; line-height: 1.05; margin: 16px 0 32px; }
    .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px 32px; margin-bottom: 36px; }
    .about-grid p { font-size: 14px; line-height: 1.55; color: rgba(31, 42, 28, .68); margin-top: 6px; }
    .posts { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 24px; }
    .post { display: flex; flex-direction: column; gap: 14px; }
    .post-img { height: 240px; }
    .post h3 { font-size: 26px; line-height: 1.15; }
    .stores { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
    .map { height: 460px; }
    .store-list { display: flex; flex-direction: column; gap: 10px; }
    .store { display: flex; gap: 16px; align-items: center; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 20px; }
    .store.on { border: 1.5px solid var(--primary); }
    .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .store-name { display: flex; gap: 8px; align-items: center; font-size: 16px; flex-wrap: wrap; }
    .grow .muted { font-size: 14px; }
    .store-meta { text-align: right; font-size: 13px; color: var(--muted); white-space: nowrap; display: flex; flex-direction: column; }
    .store-meta b { color: var(--ink); font-size: 15px; }

    @media (max-width: 1100px) {
      .hero h1 { font-size: 56px; }
      .cats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .featured { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .best { grid-template-columns: 1fr; padding: 32px; }
      .best-list { grid-template-columns: 1fr; }
      .pgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 767px) {
      h2 { font-size: 26px; }
      .hero { grid-template-columns: 1fr; gap: 24px; padding-top: 16px; padding-bottom: 32px; }
      .hero h1 { font-size: 36px; }
      .hero p { font-size: 16px; margin-bottom: 20px; }
      .hero-copy { order: 2; }
      .hero-media { order: 1; height: 340px; }
      .hero-img { inset: 0; }
      .farm-tag { left: 12px; right: 12px; bottom: 12px; width: auto; padding: 14px 16px; }
      .sec { padding-bottom: 40px; }
      .cats { display: flex; overflow-x: auto; gap: 12px; padding-bottom: 6px; }
      .cat { flex: none; width: 84px; align-items: center; gap: 8px; }
      .cat-img { height: 84px; width: 84px; }
      .cat-row { font-size: 13px; }
      .cat-row .muted { display: none; }
      .featured { gap: 12px; }
      .best { padding: 20px; border-radius: 20px; gap: 20px; }
      .best h2 { font-size: 26px; }
      .best-item { gap: 10px; padding: 8px 12px 8px 8px; }
      .rank { font-size: 24px; width: 20px; }
      .thumb { width: 64px; }
      .promises { padding: 40px 0; margin-bottom: 40px; }
      .promises h2 { margin-bottom: 24px; }
      .pgrid { grid-template-columns: 1fr; }
      .about { grid-template-columns: 1fr; gap: 24px; padding-bottom: 40px; }
      .about-img { height: 260px; }
      .about-title { font-size: 30px; }
      .about-grid { grid-template-columns: 1fr; gap: 16px; }
      .posts { grid-template-columns: 1fr; }
      .stores { grid-template-columns: 1fr; }
      .map { height: 220px; }
      .store { flex-wrap: wrap; }
    }
  `
})
export class HomePage {
  readonly branch = inject(BranchStore);
  readonly cart = inject(CartStore);
  private readonly catalog = inject(CatalogApi);
  readonly vnd = vnd;
  readonly promises = PROMISES;
  readonly posts = POSTS;
  readonly about = ABOUT;

  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tab = signal(ALL);
  readonly tabs = computed(() => [ALL, ...this.categories().filter(c => c.count > 0).slice(0, 3).map(c => c.name)]);
  readonly featured = computed(() => {
    const t = this.tab();
    const all = this.products().filter(p => !p.outOfStock);
    return (t === ALL ? all : all.filter(p => p.cat === t)).slice(0, 4);
  });
  readonly best = computed(() => this.products().slice(0, 4));

  private seq = 0;
  private readonly reloadTick = signal(0);

  constructor() {
    this.catalog.categories().then(c => this.categories.set(c)).catch(() => undefined);
    // Re-fetch whenever the branch changes (prices/stock are per branch).
    effect(() => {
      const branchId = this.branch.branchId();
      this.reloadTick();
      untracked(() => void this.load(branchId));
    });
  }

  reload(): void {
    this.reloadTick.update(n => n + 1);
  }

  private async load(branchId: number): Promise<void> {
    const my = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.catalog.search({branchId, sort: 'popular', size: 16});
      if (my === this.seq) this.products.set(r.items);
    } catch (e) {
      if (my === this.seq) {
        this.products.set([]);
        this.error.set(toApiError(e).message);
      }
    } finally {
      if (my === this.seq) this.loading.set(false);
    }
  }
}
