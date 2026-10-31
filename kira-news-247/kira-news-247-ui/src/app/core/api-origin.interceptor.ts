import { isPlatformServer } from '@angular/common';
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';

/** During SSR, call the backend directly instead of looping through this server's own /api proxy. */
export const apiOriginInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID)) || !request.url.startsWith('/api/')) {
    return next(request);
  }
  const origin = process.env['NEWS_API_ORIGIN'] ?? 'http://localhost:8090';
  return next(request.clone({ url: origin + request.url }));
};
