import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireUser } from '../auth';
import { articles, bookmarks, categories, DIFFICULTIES, questions, type Difficulty } from '../db/schema';
import type { AppEnv } from '../env';

export const listColumns = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  summary: articles.summary,
  categorySlug: articles.categorySlug,
  difficulty: articles.difficulty,
  tags: articles.tags,
  readMinutes: articles.readMinutes,
  views: articles.views,
  source: articles.source,
  publishedAt: articles.publishedAt,
  saves: sql<number>`(select count(*) from bookmarks b where b.article_id = "articles"."id")`.as('saves'),
};

async function bookmarkedIds(c: { var: AppEnv['Variables'] }, ids: number[]): Promise<Set<number>> {
  if (!c.var.user || ids.length === 0) return new Set();
  const rows = await c.var.db
    .select({ id: bookmarks.articleId })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, c.var.user.id), inArray(bookmarks.articleId, ids)));
  return new Set(rows.map((r) => r.id));
}

export const articleRoutes = new Hono<AppEnv>()
  .get('/categories', async (c) => {
    const rows = await c.var.db
      .select({
        slug: categories.slug,
        name: categories.name,
        icon: categories.icon,
        count: sql<number>`(select count(*) from articles a where a.category_slug = "categories"."slug" and a.status = 'published')`,
      })
      .from(categories)
      .orderBy(asc(categories.sort));
    return c.json(rows);
  })
  .get('/stats', async (c) => {
    const published = await c.var.db.select({ tags: articles.tags, difficulty: articles.difficulty }).from(articles).where(eq(articles.status, 'published'));
    const tagCounts = new Map<string, number>();
    for (const a of published) for (const t of a.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const [[q], [newThisWeek]] = await Promise.all([
      c.var.db.select({ n: count() }).from(questions),
      c.var.db.select({ n: count() }).from(articles).where(and(eq(articles.status, 'published'), sql`${articles.publishedAt} >= ${weekAgo}`)),
    ]);
    return c.json({
      articles: published.length,
      newThisWeek: newThisWeek.n,
      questions: q.n,
      tags: [...tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, n]) => ({ tag, count: n })),
      difficulties: Object.fromEntries(DIFFICULTIES.map((d) => [d, published.filter((a) => a.difficulty === d).length])),
    });
  })
  .get('/articles', async (c) => {
    const { q, category, difficulty, tag, sort, bookmarked } = c.req.query();
    const where: SQL[] = [eq(articles.status, 'published')];
    if (q?.trim()) {
      // instr, not LIKE: D1 rejects LIKE patterns over 50 bytes.
      // shortcut: SQLite lower() only folds A-Z, so 'GIẢI' won't match 'giải'; add a lowercased search column (filled in JS) once articles are Vietnamese.
      const needle = q.trim().toLowerCase().slice(0, 200);
      where.push(or(sql`instr(lower(${articles.title}), ${needle}) > 0`, sql`instr(lower(${articles.summary}), ${needle}) > 0`)!);
    }
    if (category) where.push(eq(articles.categorySlug, category));
    if (difficulty && (DIFFICULTIES as readonly string[]).includes(difficulty)) where.push(eq(articles.difficulty, difficulty as Difficulty));
    if (tag) where.push(sql`instr(${articles.tags}, ${JSON.stringify(tag)}) > 0`);
    if (bookmarked === '1') {
      if (!c.var.user) return c.json({ error: 'Sign in required' }, 401);
      where.push(sql`${articles.id} in (select article_id from bookmarks where user_id = ${c.var.user.id})`);
    }
    const order = sort === 'recent' ? desc(articles.publishedAt) : desc(articles.views);
    const rows = await c.var.db.select(listColumns).from(articles).where(and(...where)).orderBy(order).limit(100);
    const marked = await bookmarkedIds(c, rows.map((r) => r.id));
    return c.json(rows.map((r) => ({ ...r, bookmarked: marked.has(r.id) })));
  })
  .get('/articles/:slug', async (c) => {
    const [row] = await c.var.db
      .select({ ...listColumns, bodyMd: articles.bodyMd, status: articles.status, categoryName: categories.name })
      .from(articles)
      .innerJoin(categories, eq(categories.slug, articles.categorySlug))
      .where(eq(articles.slug, c.req.param('slug')))
      .limit(1);
    if (!row || (row.status !== 'published' && !c.var.user?.isAdmin)) return c.json({ error: 'Article not found' }, 404);
    const marked = await bookmarkedIds(c, [row.id]);
    return c.json({ ...row, bookmarked: marked.has(row.id) });
  })
  .post('/articles/:slug/bookmark', requireUser, async (c) => {
    const [a] = await c.var.db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.slug, c.req.param('slug')), eq(articles.status, 'published')))
      .limit(1);
    if (!a) return c.json({ error: 'Article not found' }, 404);
    await c.var.db.insert(bookmarks).values({ userId: c.var.user!.id, articleId: a.id }).onConflictDoNothing();
    return c.json({ bookmarked: true });
  })
  .delete('/articles/:slug/bookmark', requireUser, async (c) => {
    const [a] = await c.var.db.select({ id: articles.id }).from(articles).where(eq(articles.slug, c.req.param('slug'))).limit(1);
    if (a) await c.var.db.delete(bookmarks).where(and(eq(bookmarks.userId, c.var.user!.id), eq(bookmarks.articleId, a.id)));
    return c.json({ bookmarked: false });
  });
