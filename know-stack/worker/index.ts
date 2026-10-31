import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { sessionUser } from './auth';
import * as schema from './db/schema';
import type { AppEnv } from './env';
import { adminRoutes } from './routes/admin';
import { agentRoutes } from './routes/agent';
import { articleRoutes } from './routes/articles';
import { authRoutes } from './routes/auth';
import { questionRoutes } from './routes/questions';
import { trackRoutes } from './routes/track';

const app = new Hono<AppEnv>().basePath('/api');

app.use(async (c, next) => {
  c.set('db', drizzle(c.env.DB, { schema }));
  await next();
});
// Cookie-authenticated routes only; the agent API uses a bearer token.
app.use(async (c, next) => (c.req.path.startsWith('/api/agent/') ? next() : csrf()(c, next)));
app.use(sessionUser);

app.route('/auth', authRoutes);
app.route('/track', trackRoutes);
app.route('/questions', questionRoutes);
app.route('/admin', adminRoutes);
app.route('/agent', agentRoutes);
app.route('/', articleRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message || 'Request rejected' }, err.status);
  console.error('unhandled', err.message);
  return c.json({ error: 'Something went wrong' }, 500);
});

export default app;
