import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { errorMessage, protoResource } from '../core/proto-api';
import { ArticleStatus, DashboardSchema } from '../gen/kira/news/v1/news_pb';
import { VnTimePipe } from '../shared/format';
import { STATUS_LABEL } from './labels';

@Component({
  selector: 'news-dashboard-page',
  imports: [RouterLink, HlmCardImports, VnTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="font-serif text-2xl font-bold">Tổng quan</h1>
    @if (dashboard.error()) {
      <p role="alert" class="mt-4 text-destructive">{{ error() }}</p>
    }
    @if (dashboard.data(); as d) {
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (kpi of kpis(); track kpi.label) {
          <div hlmCard [attr.data-testid]="'kpi-' + kpi.id">
            <div hlmCardHeader>
              <p hlmCardDescription>{{ kpi.label }}</p>
              <p class="font-serif text-3xl font-bold tabular-nums">{{ kpi.value }}</p>
            </div>
          </div>
        }
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <section hlmCard class="lg:col-span-2" aria-labelledby="reads-chart">
          <div hlmCardHeader><h2 hlmCardTitle id="reads-chart">Lượt đọc 7 ngày</h2></div>
          <div hlmCardContent>
            <ul class="flex h-48 items-end gap-2" role="list">
              @for (day of d.readsByDay; track day.day) {
                <li class="flex h-full flex-1 flex-col items-center justify-end gap-1 text-xs">
                  <span class="tabular-nums">{{ day.count }}</span>
                  <span class="w-full rounded-t bg-primary/80" [style.height.%]="(Number(day.count) / maxDay()) * 85"
                        [attr.aria-label]="day.day + ': ' + day.count + ' lượt đọc'"></span>
                  <span class="text-muted-foreground">{{ day.day.slice(5) }}</span>
                </li>
              } @empty {
                <li class="m-auto text-sm text-muted-foreground">Chưa có lượt đọc.</li>
              }
            </ul>
          </div>
        </section>
        <section hlmCard aria-labelledby="countries">
          <div hlmCardHeader><h2 hlmCardTitle id="countries">Quốc gia (7 ngày)</h2></div>
          <div hlmCardContent>
            <ul class="grid gap-2 text-sm">
              @for (c of d.topCountries; track c.country) {
                <li class="flex justify-between"><span>{{ c.country }}</span><span class="tabular-nums">{{ c.count }}</span></li>
              } @empty { <li class="text-muted-foreground">Chưa có dữ liệu.</li> }
            </ul>
            <a routerLink="/admin/luot-doc" class="mt-4 inline-block text-sm text-link hover:underline">Xem chi tiết lượt đọc →</a>
          </div>
        </section>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section hlmCard aria-labelledby="waiting">
          <div hlmCardHeader><h2 hlmCardTitle id="waiting">Chờ duyệt</h2></div>
          <div hlmCardContent>
            <ul class="grid gap-3 text-sm">
              @for (row of d.waitingReview; track row.id) {
                <li><a [routerLink]="['/admin/bai-viet', row.id.toString()]" class="font-medium hover:text-primary hover:underline">{{ row.title }}</a>
                  <div class="text-xs text-muted-foreground">{{ row.categoryName }} · {{ row.createdBy }} · {{ row.updatedAt | vnTime }}</div></li>
              } @empty { <li class="text-muted-foreground">Không có bài chờ duyệt.</li> }
            </ul>
          </div>
        </section>
        <section hlmCard aria-labelledby="top">
          <div hlmCardHeader><h2 hlmCardTitle id="top">Đọc nhiều nhất</h2></div>
          <div hlmCardContent>
            <ol class="grid gap-3 text-sm">
              @for (row of d.topArticles; track row.id) {
                <li class="flex justify-between gap-4">
                  <a [routerLink]="['/tin', row.slug]" target="_blank" class="hover:text-primary hover:underline">{{ row.title }}</a>
                  <span class="shrink-0 tabular-nums text-muted-foreground">{{ row.viewCount }}</span>
                </li>
              } @empty { <li class="text-muted-foreground">Chưa có bài xuất bản.</li> }
            </ol>
          </div>
        </section>
      </div>
    }
  `,
})
export class DashboardPage {
  protected readonly Number = Number;
  protected readonly dashboard = protoResource(DashboardSchema, () => '/api/v1/admin/dashboard');
  protected readonly error = computed(() => (this.dashboard.error() ? errorMessage(this.dashboard.error()) : ''));
  protected readonly maxDay = computed(() => Math.max(1, ...(this.dashboard.data()?.readsByDay ?? []).map((d) => Number(d.count))));
  protected readonly kpis = computed(() => {
    const d = this.dashboard.data();
    if (!d) {
      return [];
    }
    const count = (status: ArticleStatus) => (d.statusCounts.find((c) => c.status === status)?.count ?? 0n).toString();
    return [
      { id: 'in-review', label: STATUS_LABEL[ArticleStatus.IN_REVIEW], value: count(ArticleStatus.IN_REVIEW) },
      { id: 'reads-today', label: 'Lượt đọc hôm nay', value: d.readsToday.toString() },
      { id: 'reads-7d', label: 'Lượt đọc 7 ngày', value: d.reads7d.toString() },
      { id: 'visitors-7d', label: 'Người đọc 7 ngày', value: d.visitors7d.toString() },
    ];
  });
}
