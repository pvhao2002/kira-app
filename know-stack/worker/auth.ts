import { and, eq, gt } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { sessions, users } from './db/schema';
import type { AppEnv } from './env';
import { toB64 } from './password';

export { hashPassword, verifyPassword } from './password';

export const SESSION_COOKIE = 'ks_session';
export const SESSION_TTL_SEC = 30 * 24 * 3600;

export const newToken = () => toB64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, '');

export const isAdminEmail = (email: string, adminEmails: string) =>
  adminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

export const sessionUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  c.set('user', null);
  if (token) {
    const [row] = await c.var.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, Math.floor(Date.now() / 1000))))
      .limit(1);
    if (row) c.set('user', { ...row, isAdmin: isAdminEmail(row.email, c.env.ADMIN_EMAILS) });
  }
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ error: 'Sign in required' }, 401);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ error: 'Sign in required' }, 401);
  if (!c.var.user.isAdmin) return c.json({ error: 'Admin access required' }, 403);
  await next();
});
