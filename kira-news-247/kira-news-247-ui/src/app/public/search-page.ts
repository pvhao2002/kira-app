import { ChangeDetectionStrategy, Component, computed, inject, input, numberAttribute } from '@angular/core';
import { protoResource } from '../core/proto-api';
import { Seo } from '../core/seo';
import { ArticlePageSchema } from '../gen/kira/news/v1/news_pb';
import { NewsArticleCard } from '../shared/article-card';
import { NewsPager } from './pager';

const PAGE_SIZE = 12;

@Component({
  selector: 'news-search-page',
  imports: [NewsArticleCard, NewsPager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-3xl font-bold">
      @if (term()) { Kết quả cho “{{ term() }}” } @else { Tìm kiếm }
    </h1>
    @if (term().length < 2) {
      <p class="text-muted-foreground">Nhập ít nhất 2 ký tự vào ô tìm kiếm.</p>
    } @else if (results.data(); as result) {
      <p class="mb-6 text-sm text-muted-foreground" role="status">{{ result.total }} bài viết</p>
      <div class="grid max-w-3xl gap-8">
        @for (item of result.items; track item.id) {
          <news-article-card [article]="item" variant="row" />
        }
      </div>
      <news-pager [page]="trang()" [total]="result.total" [size]="pageSize" />
    }
  `,
})
export class SearchPage {
  readonly q = input('');
  readonly trang = input(1, { transform: (value: unknown) => Math.max(1, numberAttribute(value, 1)) });
  protected readonly pageSize = PAGE_SIZE;
  protected readonly term = computed(() => this.q().trim().slice(0, 100));
  protected readonly results = protoResource(ArticlePageSchema, () =>
    this.term().length >= 2
      ? `/api/v1/public/search?q=${encodeURIComponent(this.term())}&page=${this.trang() - 1}&size=${PAGE_SIZE}`
      : undefined,
  );

  constructor() {
    // Search result pages are thin/duplicate content: keep them out of the index.
    inject(Seo).set({ title: 'Tìm kiếm', description: 'Tìm kiếm tin tức trên Kira News 247.', path: '/tim-kiem', noindex: true });
  }
}
