import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // The admin needs the user's session cookie, which SSR does not forward: render it in the browser.
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  // Public pages are rendered per request so crawlers always get fresh HTML.
  { path: '**', renderMode: RenderMode.Server },
];
