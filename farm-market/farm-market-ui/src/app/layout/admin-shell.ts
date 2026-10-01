import {ChangeDetectionStrategy, Component, computed, effect, inject} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthStore} from '../core/auth.store';
import {BranchStore} from '../core/branch.store';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <aside class="side">
        <a routerLink="/" class="logo"><i class="egg"></i><span class="serif">Đồi Nắng</span></a>
        <label class="br">
          <span>Chi nhánh</span>
          <select aria-label="Chi nhánh làm việc" (change)="pick($event)">
            @for (i of allowed(); track i) {
              <option [value]="i" [selected]="i === branch.index()">{{ branch.branches[i]?.name }}</option>
            }
          </select>
        </label>
        @for (n of nav(); track n.link) {
          <a class="item" [routerLink]="n.link" routerLinkActive="on" [routerLinkActiveOptions]="{exact: n.exact ?? false}">{{ n.label }}</a>
        }
        <span class="grow"></span>
        <button type="button" class="out" (click)="logout()">Đăng xuất ({{ auth.user()?.name }})</button>
      </aside>
      <main class="main"><router-outlet /></main>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; background: var(--surface-2); }
    .side { background: var(--ink); color: rgba(247, 242, 231, .7); padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .logo { display: flex; align-items: center; gap: 10px; font-size: 24px; color: #f7f2e7; padding: 4px 10px 16px; }
    .egg { width: 22px; height: 26px; background: var(--accent); border-radius: 50% 50% 46% 46% / 60% 60% 40% 40%; display: inline-block; }
    .br { display: flex; flex-direction: column; gap: 6px; background: rgba(247, 242, 231, .08); border-radius: 12px; padding: 10px; margin-bottom: 12px; font-size: 12px; }
    .br select { background: transparent; color: #f7f2e7; border: 0; font-weight: 600; }
    .br option { color: #1f2a1c; }
    .item { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 12px; }
    .item.on { background: rgba(247, 242, 231, .1); color: #f7f2e7; }
        .grow { flex: 1; }
    .out { background: transparent; border: 0; color: rgba(247, 242, 231, .7); text-align: left; padding: 10px 12px; }
    .main { padding: 32px 40px; min-width: 0; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .side { position: static; height: auto; flex-direction: row; flex-wrap: wrap; }
      .main { padding: 20px 16px; }
    }
  `
})
export class AdminShell {
  readonly auth = inject(AuthStore);
  readonly branch = inject(BranchStore);
  private readonly router = inject(Router);

  /** Staff/managers only see the branches they are assigned to; admin sees all. */
  readonly allowed = computed(() => this.auth.allowedBranches());
  readonly nav = computed(() => [
    {label: 'Tổng quan', link: '/admin', exact: true},
    {label: 'Đơn hàng', link: '/admin/orders'},
    {label: 'Sản phẩm', link: '/admin/products'},
    {label: 'Kho hàng', link: '/admin/inventory'},
    {label: 'Khách hàng', link: '/admin/customers'},
    {label: 'Khuyến mãi', link: '/admin/promotions'},
    {label: 'Chi nhánh', link: '/admin/branches'},
    ...(this.auth.user()?.role === 'admin' ? [{label: 'Người dùng', link: '/admin/users'}] : [])
  ]);

  constructor() {
    void this.branch.loadFromApi();
    // Keep the working branch inside the user's assignment (e.g. staff of Q3 must not start on Q7).
    effect(() => {
      const ok = this.allowed();
      if (ok.length && !ok.includes(this.branch.index())) this.branch.select(ok[0]);
    });
  }

  pick(ev: Event): void {
    this.branch.select(Number((ev.target as HTMLSelectElement).value));
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
