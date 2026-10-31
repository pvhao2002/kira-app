import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { protoResource } from '../core/proto-api';
import { Seo } from '../core/seo';
import { SITE } from '../core/site';
import { HomePageSchema } from '../gen/kira/news/v1/news_pb';
import { NewsArticleCard } from '../shared/article-card';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';

@Component({
  selector: 'news-home-page',
  imports: [NewsArticleCard, RouterLink, HlmSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="sr-only">{{ site.name }} – {{ site.tagline }}</h1>
    @if (home.data(); as page) {
      @if (page.lead) {
        <section aria-label="Tin chính" class="grid gap-8 lg:grid-cols-4">
          <div [class]="page.top.length ? 'lg:col-span-3' : 'lg:col-span-4'">
            <news-article-card [article]="page.lead" variant="lead" [priority]="true" />
          </div>
          @if (page.top.length) {
            <div class="grid content-start gap-5 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              @for (item of page.top; track item.id) {
                <news-article-card [article]="item" variant="compact" />
              }
            </div>
          }
        </section>
      } @else {
        <p class="py-16 text-center text-muted-foreground">Chưa có bài viết nào được xuất bản.</p>
      }

      <div class="mt-10 grid gap-10 lg:grid-cols-3">
        @if (page.latest.length) {
        <section aria-labelledby="moi-nhat" class="lg:col-span-2">
          <h2 id="moi-nhat" class="mb-4 border-b-2 border-foreground pb-2 text-xl font-bold">Tin mới nhất</h2>
          <div class="grid gap-6">
            @for (item of page.latest; track item.id) {
              <news-article-card [article]="item" variant="row" />
            }
          </div>
        </section>
        }
        <aside aria-labelledby="doc-nhieu" [class.lg:col-start-3]="!page.latest.length">
          <h2 id="doc-nhieu" class="mb-4 border-b-2 border-primary pb-2 text-xl font-bold">Đọc nhiều</h2>
          <ol class="grid gap-4">
            @for (item of page.mostRead; track item.id; let i = $index) {
              <li class="flex gap-3">
                <span class="font-serif text-3xl font-bold leading-none text-primary/80" aria-hidden="true">{{ i + 1 }}</span>
                <news-article-card [article]="item" variant="compact" [showCategory]="false" />
              </li>
            }
          </ol>
        </aside>
      </div>

      @for (section of page.sections; track section.category?.id) {
        <section class="mt-12" [attr.aria-labelledby]="'muc-' + section.category?.slug">
          <div class="mb-4 flex items-baseline justify-between border-b border-border pb-2">
            <h2 [id]="'muc-' + section.category?.slug" class="text-xl font-bold">
              <a [routerLink]="['/chuyen-muc', section.category?.slug]" class="hover:text-primary">{{ section.category?.name }}</a>
            </h2>
            <a [routerLink]="['/chuyen-muc', section.category?.slug]" class="text-sm text-link hover:underline">Xem tất cả</a>
          </div>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            @for (item of section.items; track item.id) {
              <news-article-card [article]="item" [showCategory]="false" />
            }
          </div>
        </section>
      }
    } @else if (home.error()) {
      <p role="alert" class="py-16 text-center text-muted-foreground">Không tải được tin tức. Vui lòng thử lại sau.</p>
    } @else {
      <div class="grid gap-8 lg:grid-cols-4" aria-busy="true">
        <div hlmSkeleton class="aspect-[16/9] lg:col-span-3"></div>
        <div class="grid gap-4"><div hlmSkeleton class="h-16"></div><div hlmSkeleton class="h-16"></div><div hlmSkeleton class="h-16"></div></div>
      </div>
    }
  `,
})
export class HomePage {
  protected readonly site = SITE;
  protected readonly home = protoResource(HomePageSchema, () => '/api/v1/public/home');

  constructor() {
    inject(Seo).set({
      title: SITE.name,
      description: 'Kira News 247 – tin tức thời sự, thế giới, kinh doanh, công nghệ, thể thao, giải trí cập nhật 24/7.',
      path: '/',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE.name,
          url: SITE.url + '/',
          inLanguage: 'vi-VN',
          potentialAction: {
            '@type': 'SearchAction',
            target: SITE.url + '/tim-kiem?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    });
  }
}
