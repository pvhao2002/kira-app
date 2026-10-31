import { ChangeDetectionStrategy, Component, computed, input, numberAttribute, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { errorMessage, protoResource } from '../core/proto-api';
import { AdminArticlePageSchema, ArticleStatus } from '../gen/kira/news/v1/news_pb';
import { VnTimePipe } from '../shared/format';
import { ADMIN_STATUS_TABS, STATUS_CLASS, STATUS_LABEL } from './labels';

const PAGE_SIZE = 20;

/** Review queue for the owner ("Duyệt bài") and the work queue for the AI agent ("Việc cho AI"). */
@Component({
  selector: 'news-article-list-page',
  imports: [RouterLink, FormsModule, HlmButton, HlmInput, HlmTableImports, VnTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-serif text-2xl font-bold">{{ mode() === 'ai' ? 'Việc cho AI' : 'Duyệt bài' }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          @if (mode() === 'ai') {
            Bài <strong>Cần sửa</strong>: mở bài, đọc góp ý, sửa nội dung, bấm “Đã xử lý” cho từng góp ý rồi “Gửi duyệt”.
          } @else {
            Bài <strong>Chờ duyệt</strong> do AI gửi lên: đọc, góp ý hoặc duyệt & xuất bản.
          }
        </p>
      </div>
      <a hlmBtn routerLink="/admin/viet-bai" data-testid="new-article">+ Viết bài mới</a>
    </div>

    <div role="tablist" aria-label="Trạng thái" class="mt-6 flex gap-1 overflow-x-auto border-b border-border">
      @for (tab of tabs; track tab) {
        <a role="tab" [routerLink]="[]" [queryParams]="{ status: statusName(tab), trang: null }" queryParamsHandling="merge"
           [attr.aria-selected]="tab === activeStatus()" [attr.data-testid]="'tab-' + statusName(tab)"
           [class]="'-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ' + (tab === activeStatus() ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')">
          {{ statusLabel[tab] }}
          @if (count(tab) !== null) {
            <span class="ml-1 rounded-full bg-muted px-1.5 text-xs text-foreground">{{ count(tab) }}</span>
          }
        </a>
      }
    </div>

    <form class="mt-4 flex max-w-md gap-2" (ngSubmit)="query.set(search)">
      <label for="article-search" class="sr-only">Tìm theo tiêu đề</label>
      <input hlmInput id="article-search" name="search" type="search" placeholder="Tìm theo tiêu đề…" [(ngModel)]="search" data-testid="article-search" />
      <button hlmBtn variant="outline" type="submit">Tìm</button>
    </form>

    @if (list.error()) {
      <p role="alert" class="mt-6 text-destructive">{{ error() }}</p>
    }
    <div hlmTableContainer class="mt-4 rounded-lg border border-border bg-card">
      <table hlmTable data-testid="article-table">
        <thead hlmTHead>
          <tr hlmTr>
            <th hlmTh>Tiêu đề</th>
            <th hlmTh>Trạng thái</th>
            <th hlmTh class="hidden md:table-cell">Chuyên mục</th>
            <th hlmTh class="hidden text-right sm:table-cell">Góp ý mở</th>
            <th hlmTh class="hidden lg:table-cell">Cập nhật</th>
            <th hlmTh class="hidden text-right lg:table-cell">Lượt xem</th>
          </tr>
        </thead>
        <tbody hlmTBody>
          @for (row of list.data()?.items ?? []; track row.id) {
            <tr hlmTr [attr.data-testid]="'article-row-' + row.id" [attr.data-status]="statusName(row.status)">
              <td hlmTd>
                <div class="min-w-56 max-w-md whitespace-normal">
                <a [routerLink]="['/admin/bai-viet', row.id.toString()]" class="font-medium hover:text-primary hover:underline" [attr.data-testid]="'open-article-' + row.id">{{ row.title }}</a>
                <div class="text-xs text-muted-foreground">#{{ row.id }} · bản {{ row.revision }} · {{ row.createdBy }}</div>
                </div>
              </td>
              <td hlmTd><span [class]="'rounded-full px-2 py-0.5 text-xs font-medium ' + statusClass[row.status]">{{ statusLabel[row.status] }}</span></td>
              <td hlmTd class="hidden md:table-cell">{{ row.categoryName }}</td>
              <td hlmTd class="hidden text-right sm:table-cell">
                @if (row.openComments) { <span class="font-semibold text-orange-700">{{ row.openComments }}</span> } @else { 0 }
              </td>
              <td hlmTd class="hidden lg:table-cell">{{ row.updatedAt | vnTime }}</td>
              <td hlmTd class="hidden text-right lg:table-cell">{{ row.viewCount }}</td>
            </tr>
          } @empty {
            <tr hlmTr><td hlmTd colspan="6" class="py-10 text-center text-muted-foreground">
              {{ list.isLoading() ? 'Đang tải…' : 'Không có bài nào.' }}
            </td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (pages() > 1) {
      <nav class="mt-4 flex items-center gap-3 text-sm" aria-label="Phân trang">
        <a hlmBtn variant="outline" size="sm" [routerLink]="[]" [queryParams]="{ trang: trang() - 1 }" queryParamsHandling="merge"
           [class.pointer-events-none]="trang() <= 1" [attr.aria-disabled]="trang() <= 1">← Trước</a>
        <span>Trang {{ trang() }} / {{ pages() }}</span>
        <a hlmBtn variant="outline" size="sm" [routerLink]="[]" [queryParams]="{ trang: trang() + 1 }" queryParamsHandling="merge"
           [class.pointer-events-none]="trang() >= pages()" [attr.aria-disabled]="trang() >= pages()">Sau →</a>
      </nav>
    }
  `,
})
export class ArticleListPage {
  readonly mode = input<'review' | 'ai'>('review');
  readonly status = input<string>();
  readonly trang = input(1, { transform: (value: unknown) => Math.max(1, numberAttribute(value, 1)) });

  protected readonly tabs = ADMIN_STATUS_TABS;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;
  protected readonly query = signal('');
  protected search = '';

  protected readonly activeStatus = computed(() => {
    const named = ArticleStatus[this.status() as keyof typeof ArticleStatus];
    if (named !== undefined) {
      return named;
    }
    return this.mode() === 'ai' ? ArticleStatus.CHANGES_REQUESTED : ArticleStatus.IN_REVIEW;
  });
  protected readonly list = protoResource(
    AdminArticlePageSchema,
    () =>
      `/api/v1/admin/articles?status=${ArticleStatus[this.activeStatus()]}&q=${encodeURIComponent(this.query())}` +
      `&page=${this.trang() - 1}&size=${PAGE_SIZE}`,
  );
  protected readonly pages = computed(() => Math.max(1, Math.ceil(Number(this.list.data()?.total ?? 0n) / PAGE_SIZE)));
  protected readonly error = computed(() => (this.list.error() ? errorMessage(this.list.error()) : ''));

  protected statusName(status: ArticleStatus): string {
    return ArticleStatus[status];
  }

  protected count(status: ArticleStatus): string | null {
    const counts = this.list.data()?.counts;
    if (!counts) {
      return null;
    }
    const total =
      status === ArticleStatus.ARTICLE_STATUS_UNSPECIFIED
        ? counts.reduce((sum, c) => sum + c.count, 0n)
        : (counts.find((c) => c.status === status)?.count ?? 0n);
    return total.toString();
  }
}
