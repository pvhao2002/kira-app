import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, AGENT_TOKEN, createTestApp } from './test-app';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeEach(async () => (t = await createTestApp()));
afterEach(async () => t.dispose());

const agent = { Authorization: `Bearer ${AGENT_TOKEN}` };
// The losing request either sees the work in progress (409) or already finished (200).
const expectOneCreated = (statuses: number[]) => {
  expect(statuses.filter((s) => s === 201)).toHaveLength(1);
  expect(statuses.every((s) => [200, 201, 409].includes(s))).toBe(true);
};
const draftBody = { title: 'Agent draft about locks', bodyMd: 'body text', categorySlug: 'system-design' };

async function user(email = 'reader@test.dev') {
  await t.call('/auth/register', { body: { email, name: 'Reader', password: 'reader-password' } });
  return t.login(email, 'reader-password');
}

async function article(status: 'draft' | 'published', slug: string) {
  await t.sql(`insert into articles (slug, title, category_slug, status) values (?, ?, 'system-design', ?)`, slug, `Title ${slug}`, status);
  return (await t.sql('select id from articles where slug = ?', slug))[0].id as number;
}

describe('auth', () => {
  it('blocks the 6th wrong password for the same IP and email', async () => {
    const tries = [];
    for (let i = 0; i < 6; i++) tries.push((await t.call('/auth/login', { body: { email: ADMIN.email, password: 'wrong' } })).status);
    expect(tries).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('does not count failed tries from before a successful login', async () => {
    const wrong = () => t.call('/auth/login', { body: { email: ADMIN.email, password: 'wrong' } }).then((r) => r.status);
    for (let i = 0; i < 4; i++) await wrong();
    await t.login(ADMIN.email, ADMIN.password);
    const after = [];
    for (let i = 0; i < 5; i++) after.push(await wrong());
    expect(after).toEqual([401, 401, 401, 401, 401]);
  });

  it('answers two simultaneous sign-ups for one email with 200 and 409', async () => {
    const body = { email: 'twin@test.dev', name: 'Twin', password: 'twin-password' };
    const statuses = (await Promise.all([t.call('/auth/register', { body }), t.call('/auth/register', { body })])).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
  });
});

describe('admin access', () => {
  it('rejects anonymous callers with 401 and readers with 403', async () => {
    expect((await t.call('/admin/analytics')).status).toBe(401);
    expect((await t.call('/admin/analytics', { cookie: await user() })).status).toBe(403);
    expect((await t.call('/admin/analytics', { cookie: await t.login(ADMIN.email, ADMIN.password) })).status).toBe(200);
  });
});

describe('drafts stay private', () => {
  it('refuses to bookmark a draft', async () => {
    await article('draft', 'secret-draft');
    expect((await t.call('/articles/secret-draft/bookmark', { method: 'POST', cookie: await user() })).status).toBe(404);
  });

  it('hides the draft slug from the question author', async () => {
    const cookie = await user();
    await t.call('/questions', {
      cookie,
      body: { title: 'How do fencing tokens work?', domain: 'system-design', difficulty: 'senior', context: 'Need the full picture of fencing tokens.' },
    });
    const admin = await t.login(ADMIN.email, ADMIN.password);
    await t.call('/admin/questions/1/draft', { method: 'POST', cookie: admin });
    const [mine] = (await t.call('/questions/mine', { cookie })).json;
    expect(mine.status).toBe('drafted');
    expect(mine.articleSlug).toBeNull();
  });
});

describe('tracking', () => {
  it('counts one view per IP and article', async () => {
    await article('published', 'popular');
    const visit = { path: '/articles/popular', articleSlug: 'popular' };
    await t.call('/track', { body: visit });
    await t.call('/track', { body: visit });
    await t.call('/track', { body: visit, ip: '10.0.0.2' });
    expect((await t.sql(`select views from articles where slug = 'popular'`))[0].views).toBe(2);
    expect((await t.sql('select count(*) n from visits'))[0].n).toBe(3);
  });

  it('rate-limits one IP flooding the endpoint', async () => {
    const statuses = new Set<number>();
    for (let i = 0; i < 61; i++) statuses.add((await t.call('/track', { body: { path: '/' } })).status);
    expect([...statuses].sort()).toEqual([200, 429]);
  });
});

describe('agent tasks', () => {
  async function task(status: string) {
    await t.sql(`insert into agent_tasks (goal, status) values ('a goal for the agent', ?)`, status);
    return (await t.sql('select max(id) id from agent_tasks'))[0].id as number;
  }

  it('refuses to complete a paused task', async () => {
    const id = await task('paused');
    expect((await t.call(`/agent/tasks/${id}/complete`, { headers: agent, body: draftBody })).status).toBe(409);
    expect((await t.sql('select count(*) n from articles'))[0].n).toBe(0);
  });

  it('creates exactly one draft when completion arrives twice at once', async () => {
    const id = await task('running');
    const both = await Promise.all([1, 2].map(() => t.call(`/agent/tasks/${id}/complete`, { headers: agent, body: draftBody })));
    expectOneCreated(both.map((r) => r.status));
    expect((await t.sql('select count(*) n from articles'))[0].n).toBe(1);
  });
});

describe('question queue', () => {
  it('creates one article when Draft is clicked twice at once', async () => {
    const cookie = await user();
    await t.call('/questions', {
      cookie,
      body: { title: 'Why does Redlock need fencing?', domain: 'system-design', difficulty: 'senior', context: 'Clock drift and GC pauses explained.' },
    });
    const admin = await t.login(ADMIN.email, ADMIN.password);
    const both = await Promise.all([1, 2].map(() => t.call('/admin/questions/1/draft', { method: 'POST', cookie: admin })));
    expectOneCreated(both.map((r) => r.status));
    expect((await t.sql('select count(*) n from articles'))[0].n).toBe(1);
  });

  it('lets the admin draft again after deleting the draft article', async () => {
    const cookie = await user();
    await t.call('/questions', {
      cookie,
      body: { title: 'How does MVCC avoid read locks?', domain: 'system-design', difficulty: 'mid', context: 'Readers and writers in PostgreSQL MVCC.' },
    });
    const admin = await t.login(ADMIN.email, ADMIN.password);
    const first = await t.call('/admin/questions/1/draft', { method: 'POST', cookie: admin });
    await t.call(`/admin/articles/${first.json.articleId}`, { method: 'DELETE', cookie: admin });
    const [q] = (await t.call('/admin/questions', { cookie: admin })).json;
    expect(q.status).toBe('pending');
    expect((await t.call('/admin/questions/1/draft', { method: 'POST', cookie: admin })).status).toBe(201);
  });
});
