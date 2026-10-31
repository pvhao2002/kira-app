import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ProtoApi, toApiError } from '../core/proto-api';
import { ArticleDetailSchema, CategoryListSchema, type ArticleDetail, type Category } from '../gen/kira/news/v1/news_pb';
import { injectResponseStatus } from './status';

/*
 * Pages whose existence decides the HTTP status load through resolvers: @angular/ssr builds the Response
 * (and its status) once navigation ends, so a status set later from a component effect is ignored.
 * GETs go through HttpClient, so the SSR transfer cache still replays them on hydration.
 */

export const articleResolver: ResolveFn<ArticleDetail | null> = (route) => {
  const setStatus = injectResponseStatus();
  return inject(ProtoApi)
    .get(`/api/v1/public/articles/${encodeURIComponent(route.paramMap.get('slug') ?? '')}`, ArticleDetailSchema)
    .pipe(
      catchError((error) => {
        setStatus(toApiError(error).status === 404 ? 404 : 503);
        return of(null);
      }),
    );
};

export const categoryResolver: ResolveFn<Category | null> = (route) => {
  const setStatus = injectResponseStatus();
  const slug = route.paramMap.get('slug');
  return inject(ProtoApi)
    .get('/api/v1/public/categories', CategoryListSchema)
    .pipe(
      map((list) => list.items.find((category) => category.slug === slug) ?? null),
      catchError(() => {
        setStatus(503);
        return of(null);
      }),
      map((category) => {
        if (!category) {
          setStatus(404);
        }
        return category;
      }),
    );
};
