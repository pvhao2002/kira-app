import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch())`;

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull().default(now),
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
});

export const categories = sqliteTable('categories', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  sort: integer('sort').notNull().default(0),
});

export const DIFFICULTIES = ['junior', 'mid', 'senior', 'staff'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    bodyMd: text('body_md').notNull().default(''),
    categorySlug: text('category_slug').notNull().references(() => categories.slug),
    difficulty: text('difficulty', { enum: DIFFICULTIES }).notNull().default('mid'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    readMinutes: integer('read_minutes').notNull().default(1),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    source: text('source', { enum: ['human', 'ai'] }).notNull().default('human'),
    views: integer('views').notNull().default(0),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
    publishedAt: integer('published_at'),
  },
  (t) => [index('articles_status_category').on(t.status, t.categorySlug)],
);

export const bookmarks = sqliteTable(
  'bookmarks',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.articleId] })],
);

export const questions = sqliteTable('questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  domain: text('domain').notNull(),
  difficulty: text('difficulty', { enum: DIFFICULTIES }).notNull(),
  context: text('context').notNull(),
  code: text('code').notNull().default(''),
  codeLang: text('code_lang').notNull().default(''),
  companies: text('companies', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  urgency: text('urgency', { enum: ['interview', 'standard', 'research'] }).notNull().default('standard'),
  status: text('status', { enum: ['pending', 'drafted', 'rejected'] }).notNull().default('pending'),
  articleId: integer('article_id').references(() => articles.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(now),
});

export const visits = sqliteTable(
  'visits',
  {
    id: text('id').primaryKey(),
    ip: text('ip').notNull(),
    path: text('path').notNull(),
    articleId: integer('article_id').references(() => articles.id, { onDelete: 'set null' }),
    userId: integer('user_id'),
    referrer: text('referrer').notNull().default(''),
    seconds: integer('seconds').notNull().default(0),
    scrollPct: integer('scroll_pct').notNull().default(0),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    index('visits_created').on(t.createdAt),
    index('visits_article').on(t.articleId),
    // Per-IP rate limit and once-per-reader view counting both look up recent visits by IP.
    index('visits_ip_created').on(t.ip, t.createdAt),
  ],
);

// One row per IP from ip-api.com; field names mirror its response.
export const ipGeo = sqliteTable('ip_geo', {
  ip: text('ip').primaryKey(),
  status: text('status').notNull(),
  country: text('country'),
  countryCode: text('country_code'),
  region: text('region'),
  regionName: text('region_name'),
  city: text('city'),
  zip: text('zip'),
  lat: real('lat'),
  lon: real('lon'),
  timezone: text('timezone'),
  isp: text('isp'),
  org: text('org'),
  asName: text('as_name'),
  fetchedAt: integer('fetched_at').notNull().default(now),
});

// Failed sign-ins per "ip:email" in the current one-minute window (exact and global, unlike Workers rate limiting).
export const loginFailures = sqliteTable('login_failures', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
});

export const agentTasks = sqliteTable('agent_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goal: text('goal').notNull(),
  status: text('status', { enum: ['queued', 'running', 'paused', 'done', 'failed'] }).notNull().default('queued'),
  log: text('log').notNull().default(''),
  articleId: integer('article_id').references(() => articles.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export type GeoRow = typeof ipGeo.$inferInsert;
