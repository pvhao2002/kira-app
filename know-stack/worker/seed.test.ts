import { afterEach, beforeEach, expect, it } from 'vitest';
import { seedStatements } from '../seed/build.mjs';
import { createTestApp } from './test-app';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeEach(async () => (t = await createTestApp()));
afterEach(async () => t.dispose());

it('re-running the seed keeps real content and adds nothing twice', async () => {
  const run = async () => { for (const stmt of seedStatements()) await t.env.DB.prepare(stmt).run(); };
  await run();
  await t.sql(`insert into articles (slug, title, category_slug, status) values ('real-post', 'Written by an admin', 'system-design', 'published')`);
  const before = (await t.sql('select count(*) n from articles'))[0].n;
  await run();
  expect((await t.sql(`select count(*) n from articles where slug = 'real-post'`))[0].n).toBe(1);
  expect((await t.sql('select count(*) n from articles'))[0].n).toBe(before);
});
