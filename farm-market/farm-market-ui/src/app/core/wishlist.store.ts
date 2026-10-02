import {Service, effect, inject, signal} from '@angular/core';
import {Router} from '@angular/router';
import {Api, apiResource} from './api';
import {AuthStore} from './auth.store';

/** Wishlisted product ids for the signed-in customer; toggling sends anonymous visitors to login. */
@Service()
export class WishlistStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** GET /wishlist, only for customers; idle (empty) otherwise. */
  private readonly remote = apiResource<{productId: number}[]>(
    () => (this.auth.user()?.role === 'customer' ? {path: '/wishlist'} : undefined),
    {defaultValue: []}
  );

  readonly ids = signal<ReadonlySet<number>>(new Set());

  constructor() {
    // value() throws in the error state, so fall back to an empty list then.
    effect(() => this.ids.set(new Set((this.remote.hasValue() ? this.remote.value() : []).map(w => w.productId))));
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
      this.remote.reload(); // roll back to the server state
    }
  }
}
