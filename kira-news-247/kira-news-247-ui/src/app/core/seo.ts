import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE } from './site';

export interface SeoPage {
  title: string;
  description: string;
  /** Path on the public site, e.g. "/tin/abc". */
  path: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: readonly string[];
  jsonLd?: readonly object[];
}

/** Title, description, canonical, Open Graph/Twitter and JSON-LD — rendered on the server for crawlers. */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  set(page: SeoPage): void {
    const url = SITE.url + page.path;
    const fullTitle = page.path === '/' ? `${SITE.name} – ${SITE.tagline}` : `${page.title} | ${SITE.name}`;
    const description = page.description.slice(0, 300);
    this.title.setTitle(fullTitle);
    this.tag('name', 'description', description);
    this.tag('name', 'robots', page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    this.tag('property', 'og:site_name', SITE.name);
    this.tag('property', 'og:locale', 'vi_VN');
    this.tag('property', 'og:type', page.type ?? 'website');
    this.tag('property', 'og:title', page.title);
    this.tag('property', 'og:description', description);
    this.tag('property', 'og:url', url);
    this.tag('property', 'og:image', page.image);
    this.tag('name', 'twitter:card', page.image ? 'summary_large_image' : 'summary');
    this.tag('name', 'twitter:title', page.title);
    this.tag('name', 'twitter:description', description);
    this.tag('name', 'twitter:image', page.image);
    this.tag('property', 'article:published_time', page.publishedTime);
    this.tag('property', 'article:modified_time', page.modifiedTime);
    this.tag('property', 'article:section', page.section);
    this.meta.removeTag("property='article:tag'");
    for (const tag of page.tags ?? []) {
      this.meta.addTag({ property: 'article:tag', content: tag });
    }
    this.canonical(page.noindex ? undefined : url);
    this.jsonLd(page.jsonLd ?? []);
  }

  private tag(attribute: 'name' | 'property', key: string, content: string | undefined): void {
    const selector = `${attribute}='${key}'`;
    if (content) {
      this.meta.updateTag({ [attribute]: key, content }, selector);
    } else {
      this.meta.removeTag(selector);
    }
  }

  private canonical(url: string | undefined): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private jsonLd(items: readonly object[]): void {
    this.document.head.querySelector('script#seo-jsonld')?.remove();
    if (!items.length) {
      return;
    }
    const script = this.document.createElement('script');
    script.id = 'seo-jsonld';
    script.type = 'application/ld+json';
    // "<" escaped so article text can never close the script element.
    script.textContent = JSON.stringify(items.length === 1 ? items[0] : items).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }
}
