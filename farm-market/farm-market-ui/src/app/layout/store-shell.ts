import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthStore} from '../core/auth.store';
import {BranchStore} from '../core/branch.store';
import {CartStore} from '../core/cart.store';

@Component({
  selector: 'app-store-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './store-shell.html',
  styleUrl: './store-shell.scss'
})
export class StoreShell {
  readonly branch = inject(BranchStore);
  readonly cart = inject(CartStore);
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);

  constructor() {
    void this.branch.loadFromApi();
  }
  readonly nav = [
    {label: 'Gà', q: 'ga'}, {label: 'Trứng', q: 'trung'}, {label: 'Gia cầm', q: 'giacam'},
    {label: 'Gia súc', q: 'giasuc'}, {label: 'Thức ăn chăn nuôi', q: 'thucan'}, {label: 'Con giống', q: 'giong'}
  ];

  pickBranch(ev: Event): void {
    this.branch.select(Number((ev.target as HTMLSelectElement).value));
  }

  search(q: string): void {
    void this.router.navigate(['/products'], {queryParams: q ? {q} : {}});
  }
}
