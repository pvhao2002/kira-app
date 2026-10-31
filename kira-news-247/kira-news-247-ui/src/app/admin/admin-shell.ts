import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthStore } from '../core/auth-store';
import { Seo } from '../core/seo';

@Component({
  selector: 'news-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-muted/40 lg:grid lg:grid-cols-[15rem_1fr]">
      <aside class="border-b border-border bg-card lg:min-h-screen lg:border-b-0 lg:border-r">
        <div class="flex items-center justify-between px-4 py-4">
          <a routerLink="/admin" class="font-serif text-xl font-bold">Kira <span class="text-primary">News</span> <span class="ml-1 font-sans text-sm font-medium text-muted-foreground">Admin</span></a>
        </div>
        <nav aria-label="Quản trị" class="flex gap-1 overflow-x-auto px-2 pb-3 text-sm lg:flex-col lg:overflow-visible">
          @for (item of nav; track item.path) {
            @if (!item.adminOnly || auth.isAdmin()) {
              <a [routerLink]="item.path" routerLinkActive="!bg-primary/10 !text-primary font-semibold" [routerLinkActiveOptions]="{ exact: item.exact }"
                 [attr.data-testid]="'nav-' + item.id"
                 class="whitespace-nowrap rounded-md px-3 py-2.5 text-foreground hover:bg-muted">{{ item.label }}</a>
            }
          }
          <a routerLink="/" class="whitespace-nowrap rounded-md px-3 py-2.5 text-muted-foreground hover:bg-muted">↗ Xem trang báo</a>
        </nav>
      </aside>
      <div class="min-w-0">
        <header class="flex items-center justify-end gap-3 border-b border-border bg-card px-4 py-3 text-sm">
          <span data-testid="current-user">{{ auth.me()?.displayName }} <span class="text-muted-foreground">({{ auth.isAdmin() ? 'Quản trị' : 'AI biên tập' }})</span></span>
          <button hlmBtn variant="outline" size="sm" data-testid="logout" (click)="logout()">Đăng xuất</button>
        </header>
        <main class="mx-auto max-w-7xl p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminShell {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly nav = [
    { id: 'dashboard', path: '/admin', label: 'Tổng quan', adminOnly: true, exact: true },
    { id: 'review', path: '/admin/bai-viet', label: 'Duyệt bài', adminOnly: false, exact: false },
    { id: 'ai-tasks', path: '/admin/viec-cho-ai', label: 'Việc cho AI', adminOnly: false, exact: false },
    { id: 'new-article', path: '/admin/viet-bai', label: 'Viết bài mới', adminOnly: false, exact: false },
    { id: 'categories', path: '/admin/chuyen-muc', label: 'Chuyên mục', adminOnly: true, exact: false },
    { id: 'reads', path: '/admin/luot-doc', label: 'Lượt đọc', adminOnly: true, exact: false },
    { id: 'ai-guide', path: '/admin/huong-dan-ai', label: 'Hướng dẫn AI', adminOnly: false, exact: false },
  ];

  constructor() {
    inject(Seo).set({ title: 'Quản trị', description: '', path: '/admin', noindex: true });
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/admin/dang-nhap');
  }
}
