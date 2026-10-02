import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Api, apiResource} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {CartStore} from '../../core/cart.store';
import {ImageSlot} from '../../shared/image-slot';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {WishEntry, errMsg, isFirstLoad, resErr, valueOr} from './account.data';

const TABS = ['Tất cả', 'Còn hàng'];

@Component({
  selector: 'app-wishlist-page',
  imports: [ImageSlot, StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wishlist.page.html',
  styleUrl: './wishlist.page.css'
})
export class WishlistPage {
  private readonly api = inject(Api);
  private readonly branchStore = inject(BranchStore);
  private readonly cart = inject(CartStore);
  protected readonly tabs = TABS;
  protected readonly tab = signal(0);
  // availability depends on the selected branch, so the resource refetches when it changes
  private readonly res = apiResource<WishEntry[]>(() => ({path: '/wishlist', params: {branchId: this.branchStore.branchId()}}));
  protected readonly items = computed(() => valueOr(this.res, []));
  protected readonly loading = computed(() => isFirstLoad(this.res));
  protected readonly error = computed(() => resErr(this.res));
  protected readonly notice = signal('');
  protected readonly added = signal<number[]>([]);
  /** productIds whose remove request is in flight */
  protected readonly removing = signal<readonly number[]>([]);

  protected readonly shown = computed(() => this.items().filter(w => this.tab() === 0 || this.inStock(w)));
  protected readonly inStockCount = computed(() => this.items().filter(w => this.inStock(w)).length);

  protected readonly counts = computed(() => [this.items().length, this.inStockCount()]);
  protected readonly rows = computed(() => this.shown().map(w => ({
    w,
    inStock: this.inStock(w),
    price: this.price(w),
    avail: this.avail(w),
    added: this.added().includes(w.productId),
    removing: this.removing().includes(w.productId)
  })));

  protected reload(): void {
    this.res.reload();
  }

  protected inStock = (w: WishEntry): boolean => !!w.availability?.inStock;
  protected price = (w: WishEntry): number => w.availability?.price ?? w.price;
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
    if (this.removing().includes(w.productId)) return;
    this.removing.update(l => [...l, w.productId]);
    try {
      await this.api.delete('/wishlist/' + w.productId);
      // drop it right away so it cannot be removed twice, then confirm with the server
      this.res.update(l => l?.filter(x => x.productId !== w.productId));
      this.res.reload();
    } catch (e) {
      this.notice.set(errMsg(e));
    } finally {
      this.removing.update(l => l.filter(id => id !== w.productId));
    }
  }
}
