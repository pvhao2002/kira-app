import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CartStore} from '../../core/cart.store';
import {vnd} from '../../core/format';
import {FREE_SHIP_THRESHOLD} from '../../core/mock-data';
import {ImageSlot} from '../../shared/image-slot';
import {QtyStepper} from '../../shared/qty-stepper';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, ImageSlot, QtyStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <div class="head">
        <h1 class="page-title">Giỏ hàng</h1>
        <span class="muted">{{ cart.count() }} sản phẩm</span>
      </div>

      @if (cart.lines().length === 0) {
        <div class="empty">
          <div class="egg-wrap"><div class="egg"></div></div>
          <div class="serif title">Giỏ hàng của bạn đang trống.</div>
          <div class="muted">Trứng mới thu hoạch mỗi sáng.</div>
          <a class="btn" routerLink="/products">Khám phá sản phẩm</a>
        </div>
      } @else {
        <div class="layout">
          <div>
            <div class="ship-note" role="status">
              @if (cart.freeShipRemaining() > 0) {
                Thêm <b>{{ vnd(cart.freeShipRemaining()) }}</b> để được miễn phí giao hàng
              } @else {
                Đơn của bạn đã được miễn phí giao hàng
              }
              <div class="bar"><div class="fill" [style.width.%]="progress()"></div></div>
            </div>

            <ul class="lines">
              @for (l of cart.lines(); track l.id) {
                <li class="line">
                  <div class="thumb"><app-image-slot caption="Ảnh" [radius]="12" ratio="1 / 1" /></div>
                  <div class="mid">
                    <div class="name-row">
                      <span class="name">{{ l.name }}</span>
                      <button type="button" class="x" [attr.aria-label]="'Xóa ' + l.name" (click)="cart.remove(l.id)">✕</button>
                    </div>
                    <span class="muted sm">{{ l.unitLabel ? l.unitLabel + ' · ' : '' }}{{ vnd(l.unitPrice) }}{{ l.unit ? ' / ' + l.unit : '' }}</span>
                    <div class="bottom">
                      <app-qty-stepper [value]="l.qty" (changed)="cart.setQty(l.id, $event)" />
                      <b class="sub">{{ vnd(l.unitPrice * l.qty) }}</b>
                    </div>
                  </div>
                </li>
              }
            </ul>
          </div>

          <aside class="summary">
            <div class="rows">
              <span class="muted">Tạm tính</span><span>{{ vnd(cart.subtotal()) }}</span>
              <span class="muted">Phí giao hàng</span><span>{{ vnd(cart.shipFee()) }}</span>
              @if (cart.discount() > 0) {
                <span class="muted">Giảm giá</span><span class="green">−{{ vnd(cart.discount()) }}</span>
              }
              <b class="tot-l">Tổng cộng</b><b class="tot">{{ vnd(cart.total()) }}</b>
            </div>
            <a class="btn block go" routerLink="/checkout">Tiến hành thanh toán</a>
            <a class="btn ghost block" routerLink="/products">Tiếp tục mua sắm</a>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .head { display: flex; align-items: baseline; gap: 16px; padding: 28px 0 20px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 40px; padding-bottom: 72px; align-items: start; }
    .ship-note { background: var(--tint); color: var(--primary); border-radius: 12px; padding: 12px 14px; font-size: 14px; margin-bottom: 16px; }
    .bar { height: 4px; border-radius: 4px; background: rgba(255, 255, 255, .7); margin-top: 8px; overflow: hidden; }
    .fill { height: 100%; background: var(--primary); }
    .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .line { display: flex; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 12px; }
    .thumb { width: 84px; flex: none; align-self: flex-start; }
    .mid { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .name-row { display: flex; justify-content: space-between; gap: 8px; }
    .name { font-weight: 600; font-size: 15px; line-height: 1.3; }
    .x { background: none; border: 0; color: rgba(31, 42, 28, .4); font-size: 18px; padding: 4px; }
    .x:hover { color: var(--danger); }
    .sm { font-size: 13px; }
    .bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .sub { color: var(--primary); }
    .summary { background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 24px; position: sticky; top: 90px; }
    .rows { display: grid; grid-template-columns: 1fr auto; gap: 10px; font-size: 14px; margin-bottom: 18px; }
    .green { color: var(--primary); }
    .tot-l { font-size: 16px; padding-top: 8px; }
    .tot { font-size: 22px; color: var(--primary); padding-top: 4px; }
    .go { height: 54px; font-size: 16px; margin-bottom: 8px; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: 56px 24px 96px; }
    .egg-wrap { width: 96px; height: 96px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; }
    .egg { width: 40px; height: 50px; border-radius: 50% 50% 46% 46% / 60% 60% 40% 40%; border: 2.5px dashed var(--brown); }
    .title { font-size: 24px; }
    @media (max-width: 767px) {
      .head { padding: 16px 0 8px; }
      .layout { grid-template-columns: 1fr; gap: 20px; padding-bottom: 32px; }
      .summary { position: static; border-radius: 24px 24px 0 0; }
    }
  `
})
export class CartPage {
  readonly cart = inject(CartStore);
  readonly vnd = vnd;
  readonly progress = computed(() => Math.min(100, Math.round((this.cart.subtotal() / FREE_SHIP_THRESHOLD) * 100)));
}
