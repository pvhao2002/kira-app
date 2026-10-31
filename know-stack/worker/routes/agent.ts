import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { nowSec, readMinutes, uniqueSlug } from '../content';
import { agentTasks, articles } from '../db/schema';
import type { AppEnv } from '../env';
import { safeEqual } from '../password';
import { parseArticle } from './admin';

const requireAgent = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.env.AGENT_TOKEN;
  if (!token) return c.json({ error: 'Agent API is disabled' }, 503);
  const given = c.req.header('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!safeEqual(new TextEncoder().encode(given), new TextEncoder().encode(token))) return c.json({ error: 'Invalid agent token' }, 401);
  await next();
});

/** API an external autonomous agent uses to pull goals and hand back drafts (never publishes). */
export const agentRoutes = new Hono<AppEnv>()
  .use(requireAgent)
  .post('/tasks/claim', async (c) => {
    // One statement, so two agents can't claim the same task.
    const task = await c.env.DB.prepare(
      `update agent_tasks set status = 'running', updated_at = ?1
       where id = (select id from agent_tasks where status = 'queued' order by id limit 1) returning *`,
    ).bind(nowSec()).first();
    return task ? c.json(task) : c.body(null, 204);
  })
  .post('/tasks/:id/log', async (c) => {
    const { line } = await c.req.json<{ line?: string }>().catch(() => ({}) as never);
    const entry = `[${new Date().toISOString().slice(11, 19)}] ${String(line ?? '').slice(0, 500).replace(/\n/g, ' ')}\n`;
    // Keep the last ~20k chars of log.
    const rows = await c.var.db
      .update(agentTasks)
      .set({ log: sql`substr(${agentTasks.log} || ${entry}, -20000)`, updatedAt: nowSec() })
      .where(and(eq(agentTasks.id, Number(c.req.param('id'))), eq(agentTasks.status, 'running')))
      .returning({ id: agentTasks.id });
    return rows.length ? c.json({ ok: true }) : c.json({ error: 'Task is not running' }, 409);
  })
  .post('/tasks/:id/fail', async (c) => {
    const rows = await c.var.db
      .update(agentTasks)
      .set({ status: 'failed', updatedAt: nowSec() })
      .where(and(eq(agentTasks.id, Number(c.req.param('id'))), eq(agentTasks.status, 'running')))
      .returning({ id: agentTasks.id });
    return rows.length ? c.json({ ok: true }) : c.json({ error: 'Task is not running' }, 409);
  })
  .post('/tasks/:id/complete', async (c) => {
    const id = Number(c.req.param('id'));
    const input = await parseArticle(c, await c.req.json().catch(() => ({})));
    if (typeof input === 'string') return c.json({ error: input }, 400);
    // Atomic running → done, so a retried or concurrent call can't create a second draft.
    const [claimed] = await c.var.db
      .update(agentTasks)
      .set({ status: 'done', updatedAt: nowSec() })
      .where(and(eq(agentTasks.id, id), eq(agentTasks.status, 'running')))
      .returning({ articleId: agentTasks.articleId });
    if (!claimed) {
      const [task] = await c.var.db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1);
      if (!task) return c.json({ error: 'Task not found' }, 404);
      if (task.status === 'done' && task.articleId) return c.json({ articleId: task.articleId }); // retry of a finished call
      return c.json({ error: `Task is ${task.status}, not running` }, 409);
    }
    if (claimed.articleId) return c.json({ articleId: claimed.articleId }); // requeued task that already has a draft
    try {
      const [a] = await c.var.db
        .insert(articles)
        .values({ ...input, source: 'ai', status: 'draft', slug: await uniqueSlug(c.var.db, input.title), readMinutes: readMinutes(input.bodyMd) })
        .returning({ id: articles.id });
      await c.var.db.update(agentTasks).set({ articleId: a.id }).where(eq(agentTasks.id, id));
      return c.json({ articleId: a.id }, 201);
    } catch (e) {
      await c.var.db.update(agentTasks).set({ status: 'running' }).where(eq(agentTasks.id, id)); // let the agent retry
      throw e;
    }
  });
