import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadTracker } from '../core/read-tracker';
import { Seo } from '../core/seo';
import { SITE } from '../core/site';
import type { ArticleDetail } from '../gen/kira/news/v1/news_pb';
import { NewsArticleCard } from '../shared/article-card';
import { isoTime, VnTimePipe } from '../shared/format';
import { breadcrumb } from './category-page';

@Component({
  selector: 'news-article-page',
  imports: [RouterLink, NgOptimizedImage, NewsArticleCard, VnTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (article(); as d) {
      @let card = d.card!;
      <article class="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" class="text-sm text-muted-foreground">
          <ol class="flex flex-wrap items-center gap-1.5">
            <li><a routerLink="/" class="hover:text-foreground">Trang chủ</a></li>
            <li aria-hidden="true">›</li>
            <li><a [routerLink]="['/chuyen-muc', card.category?.slug]" class="font-medium text-primary hover:underline">{{ card.category?.name }}</a></li>
          </ol>
        </nav>
        <h1 class="mt-3 text-3xl font-bold leading-tight md:text-[2.75rem]">{{ card.title }}</h1>
        <p class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <time [attr.datetime]="published()">{{ card.publishedAt | vnTime }}</time>
          <span aria-hidden="true">·</span><span>{{ card.readingMinutes }} phút đọc</span>
          <span aria-hidden="true">·</span><span>{{ d.authorName }}</span>
        </p>
        <p class="mt-5 font-serif text-xl font-semibold leading-relaxed">{{ card.summary }}</p>
        @if (card.coverImageUrl) {
          <figure class="relative mt-6 aspect-[16/9] overflow-hidden rounded-md bg-muted">
            <img [ngSrc]="card.coverImageUrl" fill priority sizes="(min-width: 768px) 768px, 100vw" [alt]="card.title" class="object-cover" />
          </figure>
        }
        <div class="news-prose mt-8" [innerHTML]="d.bodyHtml"></div>

        @if (d.tags.length) {
          <ul class="mt-8 flex flex-wrap gap-2" aria-label="Thẻ">
            @for (tag of d.tags; track tag) {
              <li class="rounded-full bg-muted px-3 py-1 text-sm">#{{ tag }}</li>
            }
          </ul>
        }
        @if (d.sourceUrls.length) {
          <section class="mt-6 rounded-md border border-border bg-card p-4 text-sm">
            <h2 class="font-sans text-sm font-bold uppercase tracking-wide text-muted-foreground">Nguồn tham khảo</h2>
            <ul class="mt-2 grid gap-1">
              @for (url of d.sourceUrls; track url) {
                <li class="truncate"><a [href]="url" rel="nofollow noopener" target="_blank" class="text-link hover:underline">{{ url }}</a></li>
              }
            </ul>
          </section>
        }
      </article>

      @if (d.related.length) {
        <section aria-labelledby="lien-quan" class="mx-auto mt-14 max-w-5xl">
          <h2 id="lien-quan" class="mb-4 border-b-2 border-foreground pb-2 text-xl font-bold">Tin liên quan</h2>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            @for (item of d.related; track item.id) {
              <news-article-card [article]="item" [showCategory]="false" />
            }
          </div>
        </section>
      }
    } @else {
      <div class="py-16 text-center">
        <h1 class="text-3xl font-bold">Không tìm thấy bài viết</h1>
        <p class="mt-3 text-muted-foreground">Bài viết có thể đã bị gỡ hoặc đường dẫn không đúng.</p>
        <a routerLink="/" class="mt-6 inline-block text-link hover:underline">← Về trang chủ</a>
      </div>
    }
  `,
})
export class ArticlePage {
  /** From articleResolver; null when the article does not exist (the resolver already set HTTP 404). */
  readonly article = input<ArticleDetail | null>(null);
  protected readonly published = computed(() => isoTime(this.article()?.card?.publishedAt ?? 0n));

  constructor() {
    const seo = inject(Seo);
    const tracker = inject(ReadTracker);
    effect(() => {
      const d = this.article();
      const card = d?.card;
      if (!d || !card) {
        seo.set({ title: 'Không tìm thấy bài viết', description: '', path: '/404', noindex: true });
        return;
      }
      const path = `/tin/${card.slug}`;
      const image = card.coverImageUrl || undefined;
      seo.set({
        title: card.title,
        description: card.summary,
        path,
        image,
        type: 'article',
        publishedTime: isoTime(card.publishedAt),
        modifiedTime: isoTime(d.updatedAt),
        section: card.category?.name,
        tags: d.tags,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: card.title.slice(0, 110),
            description: card.summary,
            image: image ? [image] : undefined,
            datePublished: isoTime(card.publishedAt),
            dateModified: isoTime(d.updatedAt),
            articleSection: card.category?.name,
            keywords: d.tags.join(', ') || undefined,
            inLanguage: 'vi-VN',
            mainEntityOfPage: SITE.url + path,
            author: { '@type': 'Organization', name: d.authorName, url: SITE.url },
            publisher: { '@type': 'Organization', name: SITE.name, logo: { '@type': 'ImageObject', url: SITE.url + '/favicon.ico' } },
          },
          breadcrumb([
            { name: card.category?.name ?? '', path: `/chuyen-muc/${card.category?.slug}` },
            { name: card.title, path },
          ]),
        ],
      });
      untracked(() => tracker.track(card.id)); // browser-only; no-op during SSR
    });
  }
}
