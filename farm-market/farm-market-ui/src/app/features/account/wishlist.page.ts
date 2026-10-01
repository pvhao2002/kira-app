import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {vnd} from '../../core/format';
import {ImageSlot} from '../../shared/image-slot';
import {WishEntry, errMsg} from './account.data';

const TABS = ['Tất cả', 'Còn hàng'];

@Component({
  selector: 'app-wishlist-page',
  imports: [ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row head">
      <h1 class="page-title">Sản phẩm yêu thích</h1><span class="spacer"></span>
      <button type="button" class="btn" [disabled]="!inStockCount()" (click)="addAll()">Thêm tất cả vào giỏ</button>
    </div>
    <div class="row wrap tabs">
      @for (t of tabs; track t; let i = $index) {
        <button type="button" class="tab-pill" [class.on]="tab() === i" (click)="tab.set(i)">{{ t }} <span class="n">{{ countFor(i) }}</span></button>
      }
    </div>
    @if (notice(); as n) { <div class="msg" role="status">{{ n }}</div> }

    @if (loading()) {
      <div class="state-box">Đang tải danh sách…</div>
    } @else if (error()) {
      <div class="state-box" role="alert"><b>Không tải được danh sách</b>{{ error() }}
        <button type="button" class="btn sm" (click)="load()">Thử lại</button></div>
    } @else {
      <div class="grid3">
        @for (w of shown(); track w.productId) {
          <article class="card item">
            <div class="photo">
              <app-image-slot [caption]="w.name" [radius]="12" />
              <button type="button" class="heart" aria-label="Bỏ yêu thích" (click)="unlike(w)">♥</button>
            </div>
            <div class="name">{{ w.name }}</div>
            <div class="avail"><span class="dot" [style.background]="inStock(w) ? 'var(--primary)' : 'var(--danger)'"></span>{{ avail(w) }}</div>
            <div class="row foot">
              <div><b>{{ vnd(price(w)) }}</b> <span class="muted">/ {{ w.unit }}</span></div>
              <span class="spacer"></span>
              @if (inStock(w)) {
                <button type="button" class="btn sm" [class.secondary]="added().includes(w.productId)" (click)="add(w)">{{ added().includes(w.productId) ? 'Đã thêm ✓' : 'Thêm vào giỏ' }}</button>
              } @else {
                <button type="button" class="btn secondary sm" disabled>Hết hàng</button>
              }
            </div>
          </article>
        }
      </div>
      @if (!shown().length) {
        <div class="state-box"><b>Chưa có sản phẩm</b>Bấm ♥ trên sản phẩm để lưu vào đây.</div>
      }
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .head { margin-bottom: 20px; }
    .tabs { margin-bottom: 20px; }
    .grid3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
    .item { display: flex; flex-direction: column; gap: 8px; padding: 14px; }
    .photo { position: relative; }
    .heart { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border-radius: 50%; border: 0; background: var(--surface); color: var(--danger); font-size: 16px; }
    .drop { position: absolute; top: 8px; left: 8px; }
    .name { font-weight: 600; }
    .avail { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .foot { margin-top: auto; padding-top: 4px; flex-wrap: wrap; }
    .msg { font-size: 13px; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); margin-bottom: 16px; }
    @media (max-width: 767px) { .grid3 { grid-template-columns: 1fr 1fr; gap: 12px; } .head { flex-wrap: wrap; } }
  `
})
export class WishlistPage {
  private readonly api = inject(Api);
  private readonly branchStore = inject(BranchStore);
  private readonly cart = inject(CartStore);
  protected readonly vnd = vnd;
  protected readonly tabs = TABS;
  protected readonly tab = signal(0);
  protected readonly items = signal<WishEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly added = signal<number[]>([]);

  protected readonly shown = computed(() => this.items().filter(w => this.tab() === 0 || this.inStock(w)));
  protected readonly inStockCount = computed(() => this.items().filter(w => this.inStock(w)).length);

  constructor() {
    // availability depends on the selected branch, so reload when it changes
    effect(() => {
      this.branchStore.branchId();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set(await this.api.get<WishEntry[]>('/wishlist', {branchId: this.branchStore.branchId()}));
    } catch (e) {
      this.error.set(errMsg(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected inStock = (w: WishEntry): boolean => !!w.availability?.inStock;
  protected price = (w: WishEntry): number => w.availability?.price ?? w.price;
  protected countFor = (i: number): number => (i === 0 ? this.items().length : this.inStockCount());
  protected avail(w: WishEntry): string {
    const name = this.branchStore.current().short;
    if (!w.availability) return 'Không bán tại ' + name;
    return w.availability.inStock ? `Còn hàng tại ${name} (${w.availability.available})` : 'Tạm hết hàng tại ' + name;
  }

  /** Cart lines use the product id of the selected branch (availability.productId), not the wishlist's own. */
  private line(w: WishEntry) {
    return {productId: w.availability!.productId, branchId: this.branchStore.branchId(), name: w.name, qty: 1, unitPrice: this.price(w), unit: w.unit};
  }

  protected add(w: WishEntry): void {
    this.cart.addAll([this.line(w)]);
    this.added.update(a => [...a, w.productId]);
  }

  protected addAll(): void {
    const ready = this.items().filter(w => this.inStock(w) && !this.added().includes(w.productId));
    this.cart.addAll(ready.map(w => this.line(w)));
    this.added.update(a => [...a, ...ready.map(w => w.productId)]);
  }

  protected async unlike(w: WishEntry): Promise<void> {
    try {
      await this.api.delete('/wishlist/' + w.productId);
      this.items.update(l => l.filter(x => x.productId !== w.productId));
    } catch (e) {
      this.notice.set(errMsg(e));
    }
  }
}
