import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { articles, visits } from '../db/schema';
import type { AppEnv } from '../env';
import { ensureGeo } from '../geo';

const clamp = (n: unknown, max: number) => Math.min(max, Math.max(0, Math.round(Number(n) || 0)));

export const trackRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    const body = await c.req.json<{ path?: string; articleSlug?: string; referrer?: string }>().catch(() => ({}) as never);
    // Only Cloudflare's header: X-Forwarded-For is client-controlled.
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    let articleId: number | null = null;
    if (body.articleSlug) {
      const [a] = await c.var.db
        .update(articles)
        .set({ views: sql`${articles.views} + 1` })
        .where(and(eq(articles.slug, String(body.articleSlug)), eq(articles.status, 'published')))
        .returning({ id: articles.id });
      articleId = a?.id ?? null;
    }
    let referrer = '';
    try {
      const host = new URL(String(body.referrer ?? '')).hostname;
      if (host && host !== new URL(c.req.url).hostname) referrer = host;
    } catch {}
    const id = crypto.randomUUID();
    await c.var.db.insert(visits).values({
      id, ip, articleId, referrer, userId: c.var.user?.id ?? null, path: String(body.path ?? '/').slice(0, 300),
    });
    c.executionCtx.waitUntil(ensureGeo(c.var.db, ip));
    return c.json({ id });
  })
  .post('/:id/end', async (c) => {
    const body = await c.req.json<{ seconds?: number; scrollPct?: number }>().catch(() => ({}) as never);
    await c.var.db
      .update(visits)
      .set({ seconds: clamp(body.seconds, 4 * 3600) /* idle open tabs would skew averages */, scrollPct: clamp(body.scrollPct, 100) })
      .where(eq(visits.id, c.req.param('id')));
    return c.body(null, 204);
  });
