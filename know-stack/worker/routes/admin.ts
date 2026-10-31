import { desc, eq, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { analytics } from '../analytics';
import { requireAdmin } from '../auth';
import { parseTags, readMinutes, uniqueSlug } from '../content';
import { agentTasks, articles, categories, DIFFICULTIES, questions, users, type Difficulty } from '../db/schema';
import type { AppEnv } from '../env';

const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const nowSec = () => Math.floor(Date.now() / 1000);
const idParam = (c: Context) => Number(c.req.param('id')) || 0;

type ArticleInput = { title: string; summary: string; bodyMd: string; categorySlug: string; difficulty: Difficulty; tags: string[] };

/** Validates admin/agent article input; returns an error message or the clean fields. */
export async function parseArticle(c: Context<AppEnv>, b: Record<string, unknown>): Promise<ArticleInput | string> {
  const title = String(b.title ?? '').trim();
  const summary = String(b.summary ?? '').trim();
  const bodyMd = String(b.bodyMd ?? '');
  const categorySlug = String(b.categorySlug ?? '');
  const difficulty = String(b.difficulty ?? 'mid') as Difficulty;
  if (title.length < 5 || title.length > 200) return 'Title must be 5–200 characters';
  if (summary.length > 500) return 'Summary is limited to 500 characters';
  if (bodyMd.length > 200_000) return 'Article body is too long';
  if (!DIFFICULTIES.includes(difficulty)) return 'Unknown difficulty';
  const [cat] = await c.var.db.select({ slug: categories.slug }).from(categories).where(eq(categories.slug, categorySlug)).limit(1);
  if (!cat) return 'Pick a category';
  return { title, summary, bodyMd, categorySlug, difficulty, tags: parseTags(b.tags) };
}

export const adminRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  // Question queue
  .get('/questions', async (c) => {
    const status = c.req.query('status');
    const rows = await c.var.db
      .select({
        id: questions.id, title: questions.title, domain: questions.domain, difficulty: questions.difficulty,
        context: questions.context, code: questions.code, codeLang: questions.codeLang, companies: questions.companies,
        urgency: questions.urgency, status: questions.status, articleId: questions.articleId, createdAt: questions.createdAt,
        author: users.name, authorEmail: users.email,
      })
      .from(questions)
      .innerJoin(users, eq(users.id, questions.userId))
      .where(status ? eq(questions.status, status as 'pending') : undefined)
      .orderBy(sql`case ${questions.urgency} when 'interview' then 0 else 1 end`, desc(questions.createdAt));
    return c.json(rows);
  })
  .patch('/questions/:id', async (c) => {
    const { status } = await c.req.json<{ status?: string }>().catch(() => ({}) as never);
    if (status !== 'pending' && status !== 'rejected') return c.json({ error: 'Status must be pending or rejected' }, 400);
    await c.var.db.update(questions).set({ status }).where(eq(questions.id, idParam(c)));
    return c.json({ ok: true });
  })
  .post('/questions/:id/draft', async (c) => {
    const [qn] = await c.var.db.select().from(questions).where(eq(questions.id, idParam(c))).limit(1);
    if (!qn) return c.json({ error: 'Question not found' }, 404);
    if (qn.articleId) return c.json({ articleId: qn.articleId });
    const bodyMd = `> [!NOTE]\n> Submitted question: ${qn.context.replace(/\n/g, '\n> ')}\n` + (qn.code ? `\n\`\`\`${qn.codeLang.toLowerCase()}\n${qn.code}\n\`\`\`\n` : '');
    const [a] = await c.var.db
      .insert(articles)
      .values({ slug: await uniqueSlug(c.var.db, qn.title), title: qn.title, bodyMd, categorySlug: qn.domain, difficulty: qn.difficulty, readMinutes: readMinutes(bodyMd) })
      .returning({ id: articles.id });
    await c.var.db.update(questions).set({ status: 'drafted', articleId: a.id }).where(eq(questions.id, qn.id));
    return c.json({ articleId: a.id }, 201);
  })
  // Articles
  .get('/articles', async (c) =>
    c.json(
      await c.var.db
        .select({ id: articles.id, slug: articles.slug, title: articles.title, status: articles.status, source: articles.source, difficulty: articles.difficulty, categorySlug: articles.categorySlug, views: articles.views, updatedAt: articles.updatedAt })
        .from(articles)
        .orderBy(desc(articles.updatedAt)),
    ),
  )
  .get('/articles/:id', async (c) => {
    const [a] = await c.var.db.select().from(articles).where(eq(articles.id, idParam(c))).limit(1);
    if (!a) return c.json({ error: 'Article not found' }, 404);
    const [qn] = await c.var.db.select({ title: questions.title, context: questions.context, author: users.name }).from(questions).innerJoin(users, eq(users.id, questions.userId)).where(eq(questions.articleId, a.id)).limit(1);
    return c.json({ ...a, question: qn ?? null });
  })
  .post('/articles', async (c) => {
    const input = await parseArticle(c, await c.req.json().catch(() => ({})));
    if (typeof input === 'string') return c.json({ error: input }, 400);
    const [a] = await c.var.db
      .insert(articles)
      .values({ ...input, slug: await uniqueSlug(c.var.db, input.title), readMinutes: readMinutes(input.bodyMd) })
      .returning({ id: articles.id, slug: articles.slug });
    return c.json(a, 201);
  })
  .put('/articles/:id', async (c) => {
    const b = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
    const input = await parseArticle(c, b);
    if (typeof input === 'string') return c.json({ error: input }, 400);
    const status = b.status === 'published' ? 'published' : 'draft';
    const [prev] = await c.var.db.select({ status: articles.status, publishedAt: articles.publishedAt, slug: articles.slug }).from(articles).where(eq(articles.id, idParam(c))).limit(1);
    if (!prev) return c.json({ error: 'Article not found' }, 404);
    // Keep published URLs stable; drafts follow their title.
    const slug = prev.status === 'published' ? prev.slug : await uniqueSlug(c.var.db, input.title, idParam(c));
    const [a] = await c.var.db
      .update(articles)
      .set({ ...input, slug, status, readMinutes: readMinutes(input.bodyMd), updatedAt: nowSec(), publishedAt: status === 'published' ? (prev.publishedAt ?? nowSec()) : prev.publishedAt })
      .where(eq(articles.id, idParam(c)))
      .returning({ id: articles.id, slug: articles.slug, status: articles.status });
    return c.json(a);
  })
  .delete('/articles/:id', async (c) => {
    await c.var.db.delete(articles).where(eq(articles.id, idParam(c)));
    return c.json({ ok: true });
  })
  .post('/ai/draft', async (c) => {
    const b = await c.req.json<{ prompt?: string; difficulty?: string; instruction?: string; current?: string }>().catch(() => ({}) as never);
    const prompt = String(b.prompt ?? '').trim().slice(0, 4000);
    if (!prompt) return c.json({ error: 'Enter a prompt question' }, 400);
    if (!c.env.AI) return c.json({ error: 'Workers AI is not configured for this deployment' }, 503);
    const system = [
      'You are a staff software engineer writing for KnowStack, an interview-prep knowledge library.',
      `Target reader level: ${b.difficulty ?? 'senior'}. Write GitHub-flavored Markdown only, no front matter, no H1.`,
      'Use numbered H2 sections, concrete code blocks with language tags, and at least one ```mermaid diagram.',
      'Use callouts as "> [!NOTE]", "> [!TIP]", "> [!CAUTION]" or "> [!ANTIPATTERN]" blockquotes.',
      'End with a "## Interview Q&A" section of 3 questions with concise answers.',
    ].join('\n');
    const user = b.instruction && b.current
      ? `Question: ${prompt}\n\nCurrent draft:\n${String(b.current).slice(0, 60_000)}\n\nRevise the draft: ${String(b.instruction).slice(0, 500)}. Return the full revised article.`
      : `Write the article answering: ${prompt}`;
    try {
      const out = (await c.env.AI.run(AI_MODEL as never, { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 4096 } as never)) as { response?: string };
      return c.json({ markdown: out.response ?? '', model: AI_MODEL });
    } catch (e) {
      console.error('ai draft failed', (e as Error).message);
      return c.json({ error: 'AI generation failed, try again' }, 502);
    }
  })
  .get('/analytics', async (c) => {
    const days = [1, 7, 30, 90].includes(Number(c.req.query('days'))) ? Number(c.req.query('days')) : 30;
    return c.json(await analytics(c.env.DB, days));
  })
  // Agent tasks
  .get('/agent-tasks', async (c) => c.json(await c.var.db.select().from(agentTasks).orderBy(desc(agentTasks.updatedAt)).limit(50)))
  .post('/agent-tasks', async (c) => {
    const { goal } = await c.req.json<{ goal?: string }>().catch(() => ({}) as never);
    const g = String(goal ?? '').trim();
    if (g.length < 10 || g.length > 1000) return c.json({ error: 'Goal must be 10–1000 characters' }, 400);
    const [t] = await c.var.db.insert(agentTasks).values({ goal: g }).returning();
    return c.json(t, 201);
  })
  .patch('/agent-tasks/:id', async (c) => {
    const { status } = await c.req.json<{ status?: string }>().catch(() => ({}) as never);
    if (status !== 'queued' && status !== 'paused' && status !== 'failed') return c.json({ error: 'Status must be one of queued, paused, failed' }, 400);
    await c.var.db.update(agentTasks).set({ status, updatedAt: nowSec() }).where(eq(agentTasks.id, idParam(c)));
    return c.json({ ok: true });
  });

