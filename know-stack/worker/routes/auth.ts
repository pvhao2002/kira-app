import { eq, lt, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { hashPassword, isAdminEmail, newToken, SESSION_COOKIE, SESSION_TTL_SEC, verifyPassword } from '../auth';
import { nowSec } from '../content';
import { loginFailures, sessions, users } from '../db/schema';
import type { AppEnv } from '../env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILURES_PER_MINUTE = 5; // per IP + email
let dummyHash: Promise<string> | undefined; // created on first use: Workers forbid crypto at module load

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
    // One statement, so two simultaneous sign-ups can't both pass an "email free?" check.
    const [user] = await c.var.db.insert(users).values({ email, name, passwordHash: await hashPassword(password) }).onConflictDoNothing().returning();
    if (!user) return c.json({ error: 'An account with this email already exists' }, 409);
    return startSession(c, user);
  })
  .post('/login', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as never);
    const email = String(body.email ?? '').trim().toLowerCase();
    const key = `${c.req.header('CF-Connecting-IP') ?? 'unknown'}:${email}`;
    const window = Math.floor(nowSec() / 60) * 60;
    const [failures] = await c.var.db.select().from(loginFailures).where(eq(loginFailures.key, key)).limit(1);
    if (failures && failures.windowStart === window && failures.count >= MAX_FAILURES_PER_MINUTE) {
      return c.json({ error: 'Too many sign-in attempts. Try again in a minute.' }, 429);
    }
    const [user] = await c.var.db.select().from(users).where(eq(users.email, email)).limit(1);
    // Hash even for unknown emails, so response time doesn't reveal which accounts exist.
    const stored = user?.passwordHash ?? (await (dummyHash ??= hashPassword('dummy-password')));
    const ok = await verifyPassword(String(body.password ?? ''), stored);
    if (!user || !ok) {
      await c.var.db.batch([
        c.var.db
          .insert(loginFailures)
          .values({ key, windowStart: window, count: 1 })
          .onConflictDoUpdate({
            target: loginFailures.key,
            set: { count: sql`case when ${loginFailures.windowStart} = ${window} then ${loginFailures.count} + 1 else 1 end`, windowStart: window },
          }),
        c.var.db.delete(loginFailures).where(lt(loginFailures.windowStart, window - 86400)), // drop day-old rows
      ]);
      return c.json({ error: 'Invalid email or password' }, 401);
    }
    await c.var.db.delete(loginFailures).where(eq(loginFailures.key, key));
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
