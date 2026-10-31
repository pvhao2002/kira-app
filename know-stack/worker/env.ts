import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './db/schema';

export type Bindings = {
  DB: D1Database;
  AI?: Ai;
  ADMIN_EMAILS: string;
  AGENT_TOKEN?: string;
};

export type SessionUser = { id: number; email: string; name: string; isAdmin: boolean };

export type AppEnv = {
  Bindings: Bindings;
  Variables: { db: DrizzleD1Database<typeof schema>; user: SessionUser | null };
};
