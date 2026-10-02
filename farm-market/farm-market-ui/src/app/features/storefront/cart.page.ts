import {VndPipe} from '../../shared/vnd.pipe';
import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CartStore} from '../../core/cart.store';
import {FREE_SHIP_THRESHOLD} from '../../core/mock-data';
import {ImageSlot} from '../../shared/image-slot';
import {QtyStepper} from '../../shared/qty-stepper';

@Component({
  selector: 'app-cart-page',
  imports: [VndPipe, RouterLink, ImageSlot, QtyStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.css'
})
export class CartPage {
  readonly cart = inject(CartStore);
  readonly progress = computed(() => Math.min(100, Math.round((this.cart.subtotal() / FREE_SHIP_THRESHOLD) * 100)));
}
