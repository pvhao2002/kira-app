import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ArticleCard } from '../gen/kira/news/v1/news_pb';
import { VnTimePipe } from './format';

/** One teaser in four sizes: lead (front page hero), grid, row (image left) and compact (text only). */
@Component({
  selector: 'news-article-card',
  imports: [RouterLink, NgOptimizedImage, VnTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let a = article();
    <article [class]="layout()">
      @if (variant() !== 'compact') {
        <a [routerLink]="['/tin', a.slug]" [class]="mediaClass()" tabindex="-1" aria-hidden="true">
          @if (a.coverImageUrl) {
            <img [ngSrc]="a.coverImageUrl" fill [priority]="priority()" [sizes]="sizes()" alt=""
                 class="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          } @else {
            <span class="flex h-full items-end bg-gradient-to-br from-primary/90 to-foreground p-3 font-serif text-lg font-semibold text-white">
              {{ a.category?.name }}
            </span>
          }
        </a>
      }
      <div [class]="variant() === 'lead' ? 'min-w-0 self-center md:col-span-2' : 'min-w-0'">
        @if (showCategory() && a.category) {
          <a [routerLink]="['/chuyen-muc', a.category.slug]"
             class="text-xs font-bold uppercase tracking-wide text-primary hover:underline">{{ a.category.name }}</a>
        }
        <h3 [class]="titleClass()">
          <a [routerLink]="['/tin', a.slug]" class="hover:text-primary focus-visible:text-primary">{{ a.title }}</a>
        </h3>
        @if (variant() === 'lead' || variant() === 'grid' || variant() === 'row') {
          <p [class]="variant() === 'lead' ? 'mt-3 text-base text-muted-foreground md:text-lg' : 'mt-2 line-clamp-3 text-sm text-muted-foreground'">
            {{ a.summary }}
          </p>
        }
        <p class="mt-2 text-xs text-muted-foreground">
          <time [attr.datetime]="iso()">{{ a.publishedAt | vnTime }}</time> · {{ a.readingMinutes }} phút đọc
        </p>
      </div>
    </article>
  `,
})
export class NewsArticleCard {
  readonly article = input.required<ArticleCard>();
  readonly variant = input<'lead' | 'grid' | 'row' | 'compact'>('grid');
  readonly showCategory = input(true);
  readonly priority = input(false);

  protected readonly iso = computed(() => new Date(Number(this.article().publishedAt)).toISOString());
  protected readonly layout = computed(() =>
    ({
      lead: 'group grid gap-5 md:grid-cols-5',
      grid: 'group flex flex-col gap-3',
      row: 'group grid grid-cols-[7.5rem_1fr] gap-4 sm:grid-cols-[12rem_1fr]',
      compact: 'group',
    })[this.variant()],
  );
  protected readonly mediaClass = computed(() =>
    'relative block overflow-hidden rounded-md bg-muted aspect-[16/9] ' + (this.variant() === 'lead' ? 'md:col-span-3' : ''),
  );
  protected readonly titleClass = computed(() =>
    ({
      lead: 'mt-1 font-serif text-3xl font-bold leading-tight md:text-4xl',
      grid: 'mt-1 font-serif text-lg font-semibold leading-snug',
      row: 'mt-1 font-serif text-base font-semibold leading-snug sm:text-lg',
      compact: 'font-serif text-base font-semibold leading-snug',
    })[this.variant()],
  );
  protected readonly sizes = computed(() =>
    this.variant() === 'lead' ? '(min-width: 768px) 60vw, 100vw' : this.variant() === 'row' ? '12rem' : '(min-width: 768px) 25vw, 100vw',
  );
}
