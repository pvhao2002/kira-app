import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Plain prev/next links (crawlable) driven by the ?trang= query param. */
@Component({
  selector: 'news-pager',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pages() > 1) {
      <nav aria-label="Phân trang" class="mt-10 flex items-center justify-between gap-4 text-sm">
        @if (page() > 1) {
          <a [routerLink]="[]" [queryParams]="{ trang: page() - 1 === 1 ? null : page() - 1 }" queryParamsHandling="merge" rel="prev"
             class="rounded-md border border-border px-4 py-2 hover:bg-muted">← Trang trước</a>
        } @else {
          <span></span>
        }
        <span class="text-muted-foreground">Trang {{ page() }} / {{ pages() }}</span>
        @if (page() < pages()) {
          <a [routerLink]="[]" [queryParams]="{ trang: page() + 1 }" queryParamsHandling="merge" rel="next"
             class="rounded-md border border-border px-4 py-2 hover:bg-muted">Trang sau →</a>
        } @else {
          <span></span>
        }
      </nav>
    }
  `,
})
export class NewsPager {
  readonly page = input.required<number>();
  readonly total = input.required<bigint>();
  readonly size = input.required<number>();
  protected readonly pages = computed(() => Math.max(1, Math.ceil(Number(this.total()) / this.size())));
}
