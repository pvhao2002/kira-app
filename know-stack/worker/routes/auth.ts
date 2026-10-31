import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { hashPassword, isAdminEmail, newToken, SESSION_COOKIE, SESSION_TTL_SEC, verifyPassword } from '../auth';
import { sessions, users } from '../db/schema';
import type { AppEnv } from '../env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRoutes = new Hono<AppEnv>()
  .get('/me', (c) => c.json({ user: c.var.user }))
  .post('/register', async (c) => {
    const body = await c.req.json<{ email?: string; name?: string; password?: string }>().catch(() => ({}) as never);
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');
    if (!EMAIL_RE.test(email) || email.length > 200) return c.json({ error: 'Enter a valid email' }, 400);
    if (!name || name.length > 60) return c.json({ error: 'Name is required (max 60 characters)' }, 400);
    if (password.length < 8 || password.length > 200) return c.json({ error: 'Password must be at least 8 characters' }, 400);
    // Admin rights follow the email, which isn't verified: admins are created with scripts/create-admin.ts.
    if (isAdminEmail(email, c.env.ADMIN_EMAILS)) return c.json({ error: 'This email cannot be registered here' }, 403);
    const [existing] = await c.var.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return c.json({ error: 'An account with this email already exists' }, 409);
    const [user] = await c.var.db.insert(users).values({ email, name, passwordHash: await hashPassword(password) }).returning();
    return startSession(c, user);
  })
  .post('/login', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as never);
    const email = String(body.email ?? '').trim().toLowerCase();
    const [user] = await c.var.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await verifyPassword(String(body.password ?? ''), user.passwordHash))) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }
    return startSession(c, user);
  })
  .post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await c.var.db.delete(sessions).where(eq(sessions.token, token));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

async function startSession(c: Context<AppEnv>, user: typeof users.$inferSelect) {
  const token = newToken();
  await c.var.db.insert(sessions).values({ token, userId: user.id, expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC });
  setCookie(c, SESSION_COOKIE, token, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: SESSION_TTL_SEC });
  return c.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: isAdminEmail(user.email, c.env.ADMIN_EMAILS) } });
}
