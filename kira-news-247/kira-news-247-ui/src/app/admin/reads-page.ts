import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { errorMessage, protoResource } from '../core/proto-api';
import { ReadPageSchema } from '../gen/kira/news/v1/news_pb';
import { VnTimePipe } from '../shared/format';

const PAGE_SIZE = 50;

/** Raw read log: what ipinfo.io told us about each reader, plus the IP the server saw. */
@Component({
  selector: 'news-reads-page',
  imports: [RouterLink, HlmButton, HlmTableImports, VnTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="font-serif text-2xl font-bold">Lượt đọc</h1>
    <p class="mt-1 text-sm text-muted-foreground">{{ reads.data()?.total ?? 0 }} lượt · dữ liệu vị trí lấy từ ipinfo.io phía trình duyệt người đọc.</p>
    @if (reads.error()) { <p role="alert" class="mt-4 text-destructive">{{ error() }}</p> }
    <div hlmTableContainer class="mt-4 rounded-lg border border-border bg-card">
      <table hlmTable>
        <thead hlmTHead>
          <tr hlmTr><th hlmTh>Thời gian</th><th hlmTh>Bài viết</th><th hlmTh>IP (ipinfo / server)</th><th hlmTh>Vị trí</th><th hlmTh>Nhà mạng</th><th hlmTh>Thiết bị / nguồn</th></tr>
        </thead>
        <tbody hlmTBody>
          @for (r of reads.data()?.items ?? []; track r.id) {
            <tr hlmTr>
              <td hlmTd class="whitespace-nowrap">{{ r.readAt | vnTime }}</td>
              <td hlmTd class="max-w-64 whitespace-normal"><a [routerLink]="['/tin', r.articleSlug]" target="_blank" class="hover:underline">{{ r.articleTitle }}</a></td>
              <td hlmTd class="font-mono text-xs">{{ r.ipInfo?.ip || '–' }}<div class="text-muted-foreground">{{ r.remoteIp }}</div></td>
              <td hlmTd class="text-xs">{{ location(r.ipInfo?.city, r.ipInfo?.region, r.ipInfo?.country) }}<div class="text-muted-foreground">{{ r.ipInfo?.timezone }}</div></td>
              <td hlmTd class="max-w-48 truncate text-xs" [title]="r.ipInfo?.org ?? ''">{{ r.ipInfo?.org || '–' }}</td>
              <td hlmTd class="max-w-64 truncate text-xs" [title]="r.userAgent">{{ r.userAgent }}<div class="truncate text-muted-foreground">{{ r.referrer }}</div></td>
            </tr>
          } @empty {
            <tr hlmTr><td hlmTd colspan="6" class="py-10 text-center text-muted-foreground">Chưa có lượt đọc.</td></tr>
          }
        </tbody>
      </table>
    </div>
    <nav class="mt-4 flex items-center gap-3 text-sm" aria-label="Phân trang">
      <a hlmBtn variant="outline" size="sm" [routerLink]="[]" [queryParams]="{ trang: trang() - 1 }" [class.pointer-events-none]="trang() <= 1">← Trước</a>
      <span>Trang {{ trang() }} / {{ pages() }}</span>
      <a hlmBtn variant="outline" size="sm" [routerLink]="[]" [queryParams]="{ trang: trang() + 1 }" [class.pointer-events-none]="trang() >= pages()">Sau →</a>
    </nav>
  `,
})
export class ReadsPage {
  readonly trang = input(1, { transform: (value: unknown) => Math.max(1, numberAttribute(value, 1)) });
  protected readonly reads = protoResource(ReadPageSchema, () => `/api/v1/admin/reads?page=${this.trang() - 1}&size=${PAGE_SIZE}`);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(Number(this.reads.data()?.total ?? 0n) / PAGE_SIZE)));
  protected readonly error = computed(() => (this.reads.error() ? errorMessage(this.reads.error()) : ''));

  protected location(...parts: (string | undefined)[]): string {
    return parts.filter(Boolean).join(', ') || '–';
  }
}
