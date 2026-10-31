import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireUser } from '../auth';
import { articles, categories, DIFFICULTIES, questions, type Difficulty } from '../db/schema';
import type { AppEnv } from '../env';

const URGENCIES = ['interview', 'standard', 'research'] as const;

export const questionRoutes = new Hono<AppEnv>()
  .get('/similar', async (c) => {
    const words = (c.req.query('q') ?? '').toLowerCase().match(/[a-z0-9@.#+-]{4,}/g)?.slice(0, 8) ?? [];
    if (!words.length) return c.json([]);
    // shortcut: keyword overlap, not semantic search; switch to Vectorize if matches feel weak.
    const score = sql<number>`(${sql.join(words.map((w) => sql`(instr(lower(${articles.title} || ' ' || ${articles.summary}), ${w}) > 0)`), sql` + `)})`;
    const rows = await c.var.db
      .select({ slug: articles.slug, title: articles.title, summary: articles.summary, category: categories.name, score })
      .from(articles)
      .innerJoin(categories, eq(categories.slug, articles.categorySlug))
      .where(and(eq(articles.status, 'published'), sql`${score} > 0`))
      .orderBy(desc(score), desc(articles.views))
      .limit(3);
    return c.json(rows.map((r) => ({ ...r, match: Math.round((r.score / words.length) * 100) })));
  })
  .get('/mine', requireUser, async (c) =>
    c.json(
      await c.var.db
        .select({ id: questions.id, title: questions.title, status: questions.status, createdAt: questions.createdAt, articleSlug: articles.slug, articleStatus: articles.status })
        .from(questions)
        .leftJoin(articles, eq(articles.id, questions.articleId))
        .where(eq(questions.userId, c.var.user!.id))
        .orderBy(desc(questions.createdAt)),
    ),
  )
  .post('/', requireUser, async (c) => {
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({}) as never);
    const title = String(b.title ?? '').trim();
    const context = String(b.context ?? '').trim();
    const domain = String(b.domain ?? '').trim();
    const difficulty = String(b.difficulty ?? '') as Difficulty;
    const urgency = String(b.urgency ?? 'standard') as (typeof URGENCIES)[number];
    if (title.length < 10 || title.length > 120) return c.json({ error: 'Title must be 10–120 characters' }, 400);
    if (context.length < 20 || context.length > 20_000) return c.json({ error: 'Context must be 20–20,000 characters' }, 400);
    const [cat] = await c.var.db.select({ slug: categories.slug }).from(categories).where(eq(categories.slug, domain)).limit(1);
    if (!cat) return c.json({ error: 'Pick a primary domain' }, 400);
    if (!DIFFICULTIES.includes(difficulty)) return c.json({ error: 'Pick a target difficulty' }, 400);
    if (!URGENCIES.includes(urgency)) return c.json({ error: 'Pick a verification urgency' }, 400);
    const companies = (Array.isArray(b.companies) ? b.companies : []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8);
    const [row] = await c.var.db
      .insert(questions)
      .values({
        userId: c.var.user!.id, title, context, domain, difficulty, urgency, companies,
        code: String(b.code ?? '').slice(0, 20_000), codeLang: String(b.codeLang ?? '').slice(0, 30),
      })
      .returning({ id: questions.id });
    return c.json(row, 201);
  });

