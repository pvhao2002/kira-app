import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CartStore} from '../core/cart.store';
import {WishlistStore} from '../core/wishlist.store';
import {vnd} from '../core/format';
import {Product} from '../core/mock-data';
import {ImageSlot} from './image-slot';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="pc" [class.out]="product().outOfStock">
      <a [routerLink]="['/products', product().slug]" class="media">
        <app-image-slot [caption]="product().ph" [ratio]="'1 / 1'" [radius]="14" />
        @if (product().badge) {
          <span class="pill accent badge">{{ product().badge }}</span>
        }
      </a>
      @if (product().productId !== undefined) {
        <button type="button" class="heart" [class.on]="wish.has(product().productId)" [attr.aria-pressed]="wish.has(product().productId)"
                aria-label="Yêu thích" (click)="wish.toggle(product().productId)">{{ wish.has(product().productId) ? '♥' : '♡' }}</button>
      }
      <div class="body">
        <span class="eyebrow">{{ product().cat }}</span>
        <a [routerLink]="['/products', product().slug]" class="name">{{ product().name }}</a>
        <div class="meta">★ {{ product().rating }} · {{ product().reviews }} đánh giá</div>
        <div class="meta">{{ product().origin }}</div>
        <div class="price-row">
          <span class="price">{{ vnd(product().price) }}</span>
          <span class="unit">/ {{ product().unit }}</span>
          @if (product().old) {
            <s class="old">{{ vnd(product().old!) }}</s>
          }
        </div>
        @if (product().outOfStock) {
          <button class="btn secondary block" type="button">Báo khi có hàng</button>
        } @else {
          <button class="btn block" type="button" (click)="cart.add(product())">Thêm vào giỏ</button>
        }
      </div>
    </article>
  `,
  styles: `
    .pc { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 12px; height: 100%; }
    .pc.out { opacity: .7; }
    .media { position: relative; display: block; }
    .heart { position: absolute; top: 18px; right: 18px; width: 34px; height: 34px; border-radius: 50%; border: 0; background: var(--surface); color: var(--ink); font-size: 18px; line-height: 1; box-shadow: 0 2px 8px rgba(31, 42, 28, .15); }
    .heart.on { color: var(--danger); }
    .badge { position: absolute; top: 10px; left: 10px; }
    .body { display: flex; flex-direction: column; gap: 4px; padding: 0 6px 6px; flex: 1; }
    .name { font-size: 18px; font-weight: 600; line-height: 1.25; }
    .meta { font-size: 12px; color: var(--muted); }
    .price-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; margin: 6px 0 10px; flex: 1; }
    .pc { min-width: 0; }
    .price { font-size: 20px; font-weight: 700; color: var(--primary); }
    .unit { font-size: 13px; color: var(--muted); }
    .old { font-size: 13px; color: var(--muted); }
  `
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly cart = inject(CartStore);
  readonly wish = inject(WishlistStore);
  readonly vnd = vnd;
}
