import { ChangeDetectionStrategy, Component, effect, inject, input, numberAttribute } from '@angular/core';
import { protoResource } from '../core/proto-api';
import { Seo } from '../core/seo';
import { SITE } from '../core/site';
import { ArticlePageSchema, type Category } from '../gen/kira/news/v1/news_pb';
import { NewsArticleCard } from '../shared/article-card';
import { NewsPager } from './pager';

const PAGE_SIZE = 12;

@Component({
  selector: 'news-category-page',
  imports: [NewsArticleCard, NewsPager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (category(); as c) {
      <header class="mb-8 border-b-2 border-foreground pb-3">
        <h1 class="text-3xl font-bold md:text-4xl">{{ c.name }}</h1>
        @if (c.description) {
          <p class="mt-2 text-muted-foreground">{{ c.description }}</p>
        }
      </header>
      @if (articles.data(); as result) {
        @if (result.items.length) {
          <div class="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            @for (item of result.items; track item.id; let first = $first) {
              <news-article-card [article]="item" [showCategory]="false" [priority]="first && trang() === 1" />
            }
          </div>
          <news-pager [page]="trang()" [total]="result.total" [size]="pageSize" />
        } @else {
          <p class="py-12 text-center text-muted-foreground">Chuyên mục chưa có bài viết.</p>
        }
      }
    } @else {
      <div class="py-16 text-center">
        <h1 class="text-3xl font-bold">Không tìm thấy chuyên mục</h1>
      </div>
    }
  `,
})
export class CategoryPage {
  /** From categoryResolver; null = unknown slug (HTTP 404 already set). */
  readonly category = input<Category | null>(null);
  readonly trang = input(1, { transform: (value: unknown) => Math.max(1, numberAttribute(value, 1)) });
  protected readonly pageSize = PAGE_SIZE;

  protected readonly articles = protoResource(ArticlePageSchema, () =>
    this.category() ? `/api/v1/public/articles?category=${encodeURIComponent(this.category()!.slug)}&page=${this.trang() - 1}&size=${PAGE_SIZE}` : undefined,
  );

  constructor() {
    const seo = inject(Seo);
    effect(() => {
      const category = this.category();
      if (category) {
        const path = `/chuyen-muc/${category.slug}` + (this.trang() > 1 ? `?trang=${this.trang()}` : '');
        seo.set({
          title: category.name + (this.trang() > 1 ? ` – Trang ${this.trang()}` : ''),
          description: category.description || `Tin ${category.name} mới nhất trên ${SITE.name}.`,
          path,
          jsonLd: [breadcrumb([{ name: category.name, path: `/chuyen-muc/${category.slug}` }])],
        });
      } else {
        seo.set({ title: 'Không tìm thấy chuyên mục', description: '', path: '/404', noindex: true });
      }
    });
  }
}

export function breadcrumb(items: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Trang chủ', path: '/' }, ...items].map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: SITE.url + item.path,
    })),
  };
}
