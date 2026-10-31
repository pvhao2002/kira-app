import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const apiOrigin = process.env['NEWS_API_ORIGIN'] ?? 'http://localhost:8090';

const app = express();
// Set TRUST_PROXY (e.g. "loopback" or a hop count) only when nginx/a load balancer sits in front of this server.
app.set('trust proxy', process.env['TRUST_PROXY'] ?? false);
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/**
 * Same-origin proxy to kira-news-247-service: the protobuf API (session + XSRF cookies stay first-party)
 * and the crawler files.
 */
app.use(
  createProxyMiddleware({
    target: apiOrigin,
    changeOrigin: true,
    on: {
      // Overwrite (not append to) client-supplied X-Forwarded-For: the service reads the leftmost value.
      proxyReq: (proxyReq, req) => proxyReq.setHeader('X-Forwarded-For', (req as express.Request).ip ?? ''),
    },
    pathFilter: ['/api/', '/sitemap.xml', '/news-sitemap.xml', '/rss.xml', '/robots.txt'],
  }),
);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4300;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Kira News 247 SSR listening on http://localhost:${port} (API ${apiOrigin})`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
