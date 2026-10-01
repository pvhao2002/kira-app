import {Injectable, computed, effect, signal} from '@angular/core';
import {FREE_SHIP_THRESHOLD, Product, SHIP_OPTIONS} from './mock-data';

export interface CartLine {
  /** String form of the backend product id (or a synthetic id for legacy lines without one). */
  id: string;
  /** Backend product id; lines without it (legacy "buy again"/wishlist adds) cannot be ordered. */
  productId?: number;
  branchId?: number;
  name: string;
  unitPrice: number;
  qty: number;
  unitLabel: string;
  unit: string;
}

/** Result of POST /promotions/validate, remembered with the subtotal it was computed for. */
export interface AppliedPromo {
  code: string;
  discount: number;
  shippingDiscount: number;
  subtotal: number;
}

const STORAGE_KEY = 'doinang-cart-v1';

const isLine = (l: unknown): l is CartLine => {
  const x = l as Partial<CartLine> | null;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && Number.isInteger(x.unitPrice) && Number.isInteger(x.qty) && x.qty! > 0;
};

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter(isLine).slice(0, 50) : [];
  } catch {
    return []; // storage unavailable or corrupt
  }
}

/**
 * Cart state, client-side only (persisted to localStorage; lines hold no personal data). All amounts are integer VND.
 * Prices are display hints: the server re-prices everything at checkout. A cart holds one branch's products.
 */
@Injectable({providedIn: 'root'})
export class CartStore {
  readonly lines = signal<CartLine[]>(load());
  readonly shipIndex = signal(0);
  readonly payIndex = signal(0);
  readonly promo = signal<AppliedPromo | null>(null);

  readonly count = computed(() => this.lines().length);
  readonly branchId = computed(() => this.lines().find(l => l.branchId !== undefined)?.branchId);
  readonly subtotal = computed(() => this.lines().reduce((a, l) => a + l.unitPrice * l.qty, 0));
  /** Mirrors the backend ShippingMethod fees: standard is free from FREE_SHIP_THRESHOLD, pickup is free. */
  readonly baseShipFee = computed(() => {
    const i = this.shipIndex();
    return i === 0 && this.subtotal() >= FREE_SHIP_THRESHOLD ? 0 : SHIP_OPTIONS[i].fee;
  });
  private readonly activePromo = computed(() => {
    const p = this.promo();
    return p && p.subtotal === this.subtotal() ? p : null;
  });
  readonly discount = computed(() => this.activePromo()?.discount ?? 0);
  readonly shipFee = computed(() => Math.max(0, this.baseShipFee() - (this.activePromo()?.shippingDiscount ?? 0)));
  readonly total = computed(() => Math.max(0, this.subtotal() + this.shipFee() - this.discount()));
  readonly freeShipRemaining = computed(() => Math.max(0, FREE_SHIP_THRESHOLD - this.subtotal()));

  constructor() {
    effect(() => {
      const json = JSON.stringify(this.lines());
      try {
        localStorage.setItem(STORAGE_KEY, json);
      } catch { /* ignore quota/private mode */ }
    });
  }

  add(p: Product, qty = 1): void {
    const id = p.productId !== undefined ? String(p.productId) : p.id;
    this.lines.update(ls => {
      // One branch per cart: products (and prices) differ per branch, so switching branch starts a new cart.
      const base = p.branchId !== undefined && ls.some(l => l.branchId !== undefined && l.branchId !== p.branchId) ? [] : ls;
      const hit = base.find(l => l.id === id);
      if (hit) return base.map(l => (l === hit ? {...l, qty: Math.min(999, l.qty + qty), unitPrice: p.price} : l));
      return [...base, {id, productId: p.productId, branchId: p.branchId, name: p.name, unitPrice: p.price, qty, unitLabel: '', unit: p.unit}];
    });
  }

  setQty(id: string, qty: number): void {
    this.lines.update(ls => ls.map(l => (l.id === id ? {...l, qty: Math.min(999, Math.max(1, qty))} : l)));
  }

  remove(id: string): void {
    this.lines.update(ls => ls.filter(l => l.id !== id));
  }

  /** "Mua lại"/wishlist: re-add lines. Lines without a productId are kept for display only. */
  addAll(items: {name: string; qty: number; unitPrice: number; productId?: number; branchId?: number; unit?: string}[]): void {
    this.lines.update(ls => {
      const out = [...ls];
      items.forEach((i, k) => {
        const id = i.productId !== undefined ? String(i.productId) : `re-${Date.now()}-${k}`;
        const hit = out.findIndex(l => l.id === id);
        if (hit >= 0) out[hit] = {...out[hit], qty: Math.min(999, out[hit].qty + i.qty)};
        else out.push({id, productId: i.productId, branchId: i.branchId, name: i.name, unitPrice: i.unitPrice, qty: i.qty, unitLabel: '', unit: i.unit ?? ''});
      });
      return out;
    });
  }

  clear(): void {
    this.lines.set([]);
    this.promo.set(null);
  }
}
