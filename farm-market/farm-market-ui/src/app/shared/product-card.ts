import {VndPipe} from './vnd.pipe';
import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CartStore} from '../core/cart.store';
import {WishlistStore} from '../core/wishlist.store';
import {Product} from '../core/mock-data';
import {ImageSlot} from './image-slot';

@Component({
  selector: 'app-product-card',
  imports: [VndPipe, RouterLink, ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.html',
  styleUrl: './product-card.css'
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly cart = inject(CartStore);
  readonly wish = inject(WishlistStore);
}
