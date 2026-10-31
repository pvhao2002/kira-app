import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { protoResource } from '../core/proto-api';
import { SITE } from '../core/site';
import { CategoryListSchema } from '../gen/kira/news/v1/news_pb';
import { formatDay } from '../shared/format';

@Component({
  selector: 'news-public-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="[]" fragment="noi-dung" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
      Bỏ qua đến nội dung
    </a>
    <header class="border-b border-border bg-card">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs text-muted-foreground">
        <span class="capitalize">{{ today }}</span>
        <a href="/rss.xml" class="hover:text-foreground">RSS</a>
      </div>
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 pb-4 pt-2">
        <a routerLink="/" class="group flex items-baseline gap-2" aria-label="{{ site.name }} – trang chủ">
          <span class="font-serif text-3xl font-bold tracking-tight md:text-4xl">Kira <span class="text-primary">News</span></span>
          <span class="rounded bg-primary px-1.5 py-0.5 text-sm font-bold text-primary-foreground">247</span>
        </a>
        <form role="search" class="flex w-full max-w-xs items-center gap-2 sm:w-auto" (ngSubmit)="search()">
          <label for="site-search" class="sr-only">Tìm kiếm tin tức</label>
          <input id="site-search" name="q" type="search" [(ngModel)]="query" placeholder="Tìm kiếm tin tức…" minlength="2"
                 class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
          <button type="submit" class="h-10 cursor-pointer rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/85">Tìm</button>
        </form>
      </div>
      <nav aria-label="Chuyên mục" class="border-t border-border">
        <ul class="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 text-sm font-medium [scrollbar-width:none]">
          <li><a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="!border-primary text-primary"
                 class="block whitespace-nowrap border-b-2 border-transparent px-3 py-3 hover:text-primary">Trang chủ</a></li>
          @for (category of categories.data()?.items ?? []; track category.id) {
            <li><a [routerLink]="['/chuyen-muc', category.slug]" routerLinkActive="!border-primary text-primary"
                   class="block whitespace-nowrap border-b-2 border-transparent px-3 py-3 hover:text-primary">{{ category.name }}</a></li>
          }
        </ul>
      </nav>
    </header>

    <main id="noi-dung" tabindex="-1" class="mx-auto min-h-[60vh] max-w-7xl px-4 py-6 md:py-8">
      <router-outlet />
    </main>

    <footer class="mt-12 border-t border-border bg-card">
      <div class="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm md:grid-cols-3">
        <div>
          <p class="font-serif text-xl font-bold">Kira <span class="text-primary">News</span> 247</p>
          <p class="mt-2 text-muted-foreground">Tin tức cập nhật 24/7. Bài viết được biên tập bởi AI và kiểm duyệt bởi ban biên tập.</p>
        </div>
        <nav aria-label="Chuyên mục chân trang" class="md:col-span-2">
          <ul class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (category of categories.data()?.items ?? []; track category.id) {
              <li><a [routerLink]="['/chuyen-muc', category.slug]" class="text-muted-foreground hover:text-foreground">{{ category.name }}</a></li>
            }
          </ul>
        </nav>
      </div>
      <p class="border-t border-border py-4 text-center text-xs text-muted-foreground">© {{ year }} {{ site.name }}</p>
    </footer>
  `,
})
export class PublicShell {
  private readonly router = inject(Router);
  protected readonly site = SITE;
  protected readonly categories = protoResource(CategoryListSchema, () => '/api/v1/public/categories');
  protected readonly today = formatDay(new Date());
  protected readonly year = new Date().getFullYear();
  protected query = '';

  protected search(): void {
    const q = this.query.trim();
    if (q.length >= 2) {
      void this.router.navigate(['/tim-kiem'], { queryParams: { q } });
    }
  }
}
