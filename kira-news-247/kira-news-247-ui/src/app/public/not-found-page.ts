import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../core/seo';
import { injectResponseStatus } from './status';

@Component({
  selector: 'news-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-20 text-center">
      <p class="font-serif text-6xl font-bold text-primary">404</p>
      <h1 class="mt-4 text-2xl font-bold">Không tìm thấy trang</h1>
      <a routerLink="/" class="mt-6 inline-block text-link hover:underline">← Về trang chủ</a>
    </div>
  `,
})
export class NotFoundPage {
  constructor() {
    injectResponseStatus()(404);
    inject(Seo).set({ title: 'Không tìm thấy trang', description: '', path: '/404', noindex: true });
  }
}
