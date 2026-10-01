import {Injectable, effect, inject, signal} from '@angular/core';
import {Router} from '@angular/router';
import {Api} from './api';
import {AuthStore} from './auth.store';

/** Wishlisted product ids for the signed-in customer; toggling sends anonymous visitors to login. */
@Injectable({providedIn: 'root'})
export class WishlistStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly ids = signal<ReadonlySet<number>>(new Set());

  constructor() {
    effect(() => {
      if (this.auth.user()?.role === 'customer') void this.reload();
      else this.ids.set(new Set());
    });
  }

  has(productId: number | undefined): boolean {
    return productId !== undefined && this.ids().has(productId);
  }

  async toggle(productId: number | undefined): Promise<void> {
    if (productId === undefined) return;
    if (this.auth.user()?.role !== 'customer') {
      await this.router.navigate(['/login'], {queryParams: {returnUrl: this.router.url}});
      return;
    }
    const was = this.has(productId);
    this.ids.update(s => {
      const n = new Set(s);
      if (was) n.delete(productId); else n.add(productId);
      return n;
    });
    try {
      if (was) await this.api.delete(`/wishlist/${productId}`);
      else await this.api.put(`/wishlist/${productId}`);
    } catch {
      await this.reload(); // roll back to the server state
    }
  }

  private async reload(): Promise<void> {
    try {
      const r = await this.api.get<{productId: number}[]>('/wishlist');
      this.ids.set(new Set(r.map(w => w.productId)));
    } catch {
      /* keep the previous state */
    }
  }
}
