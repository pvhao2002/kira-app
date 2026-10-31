import { eq, or, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './db/schema';
import { slugify } from './text';

export { nowSec, readMinutes, slugify } from './text';

export async function uniqueSlug(db: DrizzleD1Database<typeof schema>, title: string, exceptId?: number): Promise<string> {
  const base = slugify(title);
  const taken = await db
    .select({ id: schema.articles.id, slug: schema.articles.slug })
    .from(schema.articles)
    // instr, not LIKE: D1 rejects LIKE patterns over 50 bytes.
    .where(or(eq(schema.articles.slug, base), sql`instr(${schema.articles.slug}, ${`${base}-`}) = 1`));
  const used = new Set(taken.filter((r) => r.id !== exceptId).map((r) => r.slug));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

export const parseTags = (v: unknown): string[] =>
  (Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 12);
