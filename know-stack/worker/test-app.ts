// Test harness: the real Hono app against Miniflare's local D1 and rate limiters.
import { readdirSync, readFileSync } from 'node:fs';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import app from './index';
import { hashPassword } from './password';

export const ADMIN = { email: 'admin@test.dev', password: 'admin-password-123' };
export const AGENT_TOKEN = 'agent-test-token';

export async function createTestApp() {
  // Miniflare 5 (beta) takes a new option shape; the converter accepts the documented v4 one.
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default {}',
    d1Databases: ['DB'],
    bindings: { ADMIN_EMAILS: ADMIN.email, AGENT_TOKEN },
  }));
  const env = (await mf.getBindings()) as Record<string, unknown> & { DB: D1Database };
  const dir = new URL('../migrations/', import.meta.url).pathname;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort())
    for (const stmt of readFileSync(dir + file, 'utf8').split('--> statement-breakpoint')) await env.DB.prepare(stmt).run();
  await env.DB.prepare(`insert into categories (slug, name, icon) values ('system-design', 'System Design', 'hub')`).run();
  await env.DB.prepare('insert into users (email, name, password_hash) values (?, ?, ?)').bind(ADMIN.email, 'Admin', await hashPassword(ADMIN.password)).run();

  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

  /** Same-origin JSON request; `ip` becomes CF-Connecting-IP (private by default, so no ip-api call). */
  async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string; ip?: string; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { Origin: 'http://localhost', 'CF-Connecting-IP': opts.ip ?? '10.0.0.1', ...opts.headers };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.cookie) headers.Cookie = opts.cookie;
    const res = await app.request(`http://localhost/api${path}`, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }, env, ctx);
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    return { status: res.status, json: (await res.json().catch(() => null)) as any, cookie };
  }

  const login = async (email: string, password: string, ip?: string) => (await call('/auth/login', { body: { email, password }, ip })).cookie!;
  const sql = (query: string, ...binds: unknown[]) => env.DB.prepare(query).bind(...binds).all().then((r) => r.results as any[]);

  return { call, login, sql, env, dispose: async () => (await Promise.allSettled(pending), mf.dispose()) };
}
