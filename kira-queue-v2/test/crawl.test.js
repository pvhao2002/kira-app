import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventCrawler } from '../src/crawl/event.js';
import { createDateCrawler } from '../src/crawl/date.js';
import { createCrawlDateService, parseEventDate } from '../src/service/crawl-date.js';
import { createCrawlEventService } from '../src/service/crawl-event.js';
import { BusinessException } from '../src/util.js';

// ---- EventCrawlServiceMapOddsTest port -------------------------------------------------------
const bytes = Buffer.from([1]);
const asia = Buffer.from([2]);
const bs = Buffer.from([3]);
const corner = Buffer.from([4]);

function harness({ bet365 = true, fetchBodies = {}, decodeDetail = (b) => ({ tab: [...b].join(',') }) } = {}) {
  const captured = { details: null, fetched: [], waits: [] };
  const node = {};
  const proto = {
    decodeMatchOdds: () => node,
    decodeMatchOddsDetail: decodeDetail,
  };
  const oddsMapper = {
    hasBet365Company: () => bet365,
    mapOddsTimelineForDatabase: (d) => { captured.details = d; return []; },
    mapOddsListForDatabase: () => [],
    groupOddsTimelineForResponse: () => ({ hdc: [], ou: [], corner: [] }),
  };
  const page = { waitForTimeout: async (ms) => { captured.waits.push(ms); } };
  const browser = { getLane: () => ({ withPage: (fn) => fn(page) }) };
  const fetchClient = {
    fetchOptional: async (_p, url) => {
      captured.fetched.push(url);
      const key = Object.keys(fetchBodies).find((k) => url.includes(k));
      return key ? fetchBodies[key] : null;
    },
  };
  return { crawler: createEventCrawler({ browser, fetchClient, proto, oddsMapper }), captured };
}
const ev = (hasOddsCorner) => ({ eventId: 1, link: 'link', hasOdds: true, hasOddsCorner, status: '-', isTerminal: 0, isInPlay: 0, matchId: 'm1' });

test('mapOdds: no bet365 returns empty', () => {
  const { crawler } = harness({ bet365: false });
  assert.equal(crawler.mapOdds('m1', bytes, {}).matchId, null);
});

test('mapOdds: missing required tab throws AISCORE_ODDS_DETAIL_FETCH_FAILED', () => {
  const { crawler } = harness();
  assert.throws(() => crawler.mapOdds('m1', bytes, { asia: bytes }), /AISCORE_ODDS_DETAIL_FETCH_FAILED/);
  assert.throws(() => crawler.mapOdds('m1', bytes, null), /AISCORE_ODDS_DETAIL_FETCH_FAILED/);
});

test('mapOdds: maps without corner when absent, decodes corner when present', () => {
  const a = harness();
  const r = a.crawler.mapOdds('m1', bytes, { asia, bs });
  assert.equal(r.matchId, 'm1');
  assert.deepEqual(a.captured.details, { asia: { tab: '2' }, eu: null, bs: { tab: '3' }, corner: null });
  const b = harness();
  b.crawler.mapOdds('m1', bytes, { asia, bs, corner });
  assert.deepEqual(b.captured.details.corner, { tab: '4' });
});

test('crawlEvent fetches all tabs when corner required, 100 ms wait after each detail', async () => {
  const h = harness({ fetchBodies: { odds_list: bytes, 'odds_type=asia': asia, 'odds_type=bs': bs, 'odds_type=corner': corner } });
  const r = await h.crawler.crawlEvent('m1', ev(true));
  assert.equal(r.matchId, 'm1');
  assert.deepEqual(h.captured.details, { asia: { tab: '2' }, eu: null, bs: { tab: '3' }, corner: { tab: '4' } });
  assert.deepEqual(h.captured.waits, [100, 100, 100]);
  assert.ok(h.captured.fetched[0].endsWith('odds_list?match_id=m1&code=195'));
  assert.ok(h.captured.fetched[1].endsWith('odds/detail?match_id=m1&cid=2&odds_type=asia'));
});

test('crawlEvent skips corner when not required', async () => {
  const h = harness({ fetchBodies: { odds_list: bytes, 'odds_type=asia': asia, 'odds_type=bs': bs } });
  assert.equal((await h.crawler.crawlEvent('m1', ev(false))).matchId, 'm1');
  assert.ok(!h.captured.fetched.some((u) => u.includes('odds_type=corner')));
});

test('crawlEvent throws and never maps the timeline when a required corner fetch fails', async () => {
  const h = harness({ fetchBodies: { odds_list: bytes, 'odds_type=asia': asia, 'odds_type=bs': bs } });
  await assert.rejects(h.crawler.crawlEvent('m1', ev(true)), /AISCORE_ODDS_DETAIL_FETCH_FAILED.*type=corner/);
  assert.equal(h.captured.details, null);
});

test('crawlEvent: failed odds_list fetch returns empty', async () => {
  const h = harness();
  assert.equal((await h.crawler.crawlEvent('m1', ev(false))).matchId, null);
});

test('crawlEvent: odds_list without Bet365 returns empty and fetches no detail tab', async () => {
  const h = harness({ bet365: false, fetchBodies: { odds_list: bytes } });
  assert.equal((await h.crawler.crawlEvent('m1', ev(true))).matchId, null);
  assert.equal(h.captured.fetched.length, 1);
});

test('crawlEvent: missing required bs tab rejects', async () => {
  const h = harness({ fetchBodies: { odds_list: bytes, 'odds_type=asia': asia } });
  await assert.rejects(h.crawler.crawlEvent('m1', ev(false)), /AISCORE_ODDS_DETAIL_FETCH_FAILED.*type=bs/);
});

test('crawlEvent: hasOddsCorner null is treated as false (corner skipped, persisted without corner)', async () => {
  const h = harness({ fetchBodies: { odds_list: bytes, 'odds_type=asia': asia, 'odds_type=bs': bs } });
  assert.equal((await h.crawler.crawlEvent('m1', ev(null))).matchId, 'm1');
  assert.ok(!h.captured.fetched.some((u) => u.includes('odds_type=corner')));
  assert.equal(h.captured.details.corner, null);
});

test('crawlEvent: matchId with $ patterns is inserted literally into URLs', async () => {
  const h = harness();
  await h.crawler.crawlEvent('a$&b$$', ev(false));
  assert.ok(h.captured.fetched[0].endsWith("odds_list?match_id=a$&b$$&code=195"));
});

test('mapOdds: empty decoded detail maps to null', () => {
  const h = harness({ decodeDetail: () => ({}) });
  h.crawler.mapOdds('m1', bytes, { asia, bs });
  assert.equal(h.captured.details.asia, null);
  assert.equal(h.captured.details.bs, null);
});

test('DateCrawler with no matches gives total 0', async () => {
  const dc = createDateCrawler({
    browser: { getLane: () => ({ withPage: (fn) => fn({}) }) },
    fetchClient: { fetchOptional: async () => Buffer.from([1]) },
    proto: { decodeMatches: () => ({}) },
    mapEvent: () => { throw new Error('unused'); },
  });
  const r = await dc.crawlDate('2026$&01');
  assert.deepEqual([r.total, r.events], [0, []]);
});

test('DateCrawler uses the date URL template and maps matches', async () => {
  let url;
  const dc = createDateCrawler({
    browser: { getLane: () => ({ withPage: (fn) => fn({}) }) },
    fetchClient: { fetchOptional: async (_p, u) => { url = u; return Buffer.from([1]); } },
    proto: { decodeMatches: () => ({ matches: [{ id: 'a' }, { id: 'b' }] }) },
    mapEvent: (m) => ({ event: { externalId: m.id } }),
  });
  const r = await dc.crawlDate('20260101');
  assert.equal(url, 'https://api.aiscore.com/v1/web/api/matches?lang=2&sport_id=1&date=20260101&tz=07:00');
  assert.deepEqual([r.date, r.sportId, r.lang, r.tz, r.total, r.events.length], ['20260101', 1, 2, '07:00', 2, 2]);
});

// ---- CrawServiceV2ExtensionPathTest port ------------------------------------------------------
function fakeDb(queryImpl = () => []) {
  const calls = [];
  const db = {
    calls,
    txCount: 0,
    async query(sql, params) { calls.push({ op: 'query', sql, params }); return queryImpl(sql, params); },
    async update(sql, params) { calls.push({ op: 'update', sql, params }); return 1; },
    async batchInsertSafe(sql, rows) { calls.push({ op: 'batch', sql, rows }); },
    async withTx(fn) { db.txCount += 1; return fn(db); },
  };
  return db;
}
const labels = { resolveStatus: (id, s) => s ?? '-' };
const event = (exid) => ({ externalId: exid, eventName: 'n', eventDate: '2026-01-01T20:00:00+07:00', status: 'NS', statusId: 1, link: 'l', matchStatus: 1, hasOdds: true, hasOddsCorner: false });
const bundle = (exid) => ({ league: null, homeTeam: null, awayTeam: null, event: event(exid), result: null });
const dateService = (db) => createCrawlDateService({ db, dateCrawler: {}, statusLabels: labels });

test('persistDate with null events upserts the row then marks done with zero events, in one tx', async () => {
  const db = fakeDb();
  await dateService(db).persistDate('20260101', null);
  assert.equal(db.txCount, 1);
  const updates = db.calls.filter((c) => c.op === 'update');
  assert.match(updates[0].sql, /insert into crawl_date/);
  assert.deepEqual(updates[0].params, { date: '20260101' });
  assert.match(updates[1].sql, /update crawl_date/);
  assert.deepEqual(updates[1].params, { date: '20260101', status: 'done', total_events: 0, error_message: null });
});

test('persistDate upserts events sorted by external id (stable lock order)', async () => {
  const db = fakeDb();
  await dateService(db).persistDate('20260101', [bundle('e2'), bundle('e1'), bundle('e3')]);
  const batch = db.calls.find((c) => c.op === 'batch' && c.sql.includes('insert into events'));
  assert.deepEqual(batch.rows.map((r) => r.exid), ['e1', 'e2', 'e3']);
  assert.equal(batch.rows[0].event_date, '2026-01-01 20:00:00');
  assert.equal(batch.rows[0].has_odds, true);
});

test('persistDate upserts teams sorted by name and resolves ids from lookups', async () => {
  const db = fakeDb((sql) => {
    if (sql.includes('from teams')) return [{ team_id: 7, team_name: 'Zeta', external_id: 'tz' }, { team_id: 8, team_name: 'Alpha', external_id: 'ta' }];
    if (sql.includes('from events')) return [{ event_id: 99, external_id: 'e1' }];
    return [];
  });
  const home = { teamName: 'Zeta', externalId: 'tz', sportId: 1 };
  const away = { teamName: 'Alpha', externalId: 'ta', sportId: 1 };
  await dateService(db).persistDate('20260101', [{ league: null, homeTeam: home, awayTeam: away, event: event('e1'), result: { ftHomeGoal: -1, ftAwayGoal: 2 } }]);
  const teams = db.calls.find((c) => c.op === 'batch' && c.sql.includes('into teams'));
  assert.deepEqual(teams.rows.map((r) => r.team_name), ['Alpha', 'Zeta']);
  const ev = db.calls.find((c) => c.op === 'batch' && c.sql.includes('insert into events')).rows[0];
  assert.deepEqual([ev.home_id, ev.away_id, ev.league_id], [7, 8, null]);
  const res = db.calls.find((c) => c.op === 'batch' && c.sql.includes('event_result')).rows[0];
  assert.deepEqual([res.eventId, res.ftHomeGoal, res.ftAwayGoal], [99, 0, 2]); // negative clamped to 0
});

test('parseEventDate keeps the wall clock of the offset and rejects junk', () => {
  assert.equal(parseEventDate('2026-01-01T20:00:00+07:00'), '2026-01-01 20:00:00');
  assert.equal(parseEventDate(null), null);
  assert.throws(() => parseEventDate('nope'));
});

test('crawlDate marks the date failed when the crawl throws, done otherwise', async () => {
  const db = fakeDb();
  const svc = createCrawlDateService({
    db, statusLabels: labels,
    dateCrawler: { crawlDate: async (d) => { if (d === '20260102') throw new Error('boom'); return { events: [bundle('e1')] }; } },
  });
  await svc.crawlDate(['20260101', '20260102']);
  const statuses = db.calls.filter((c) => c.op === 'update' && c.sql.includes('update crawl_date')).map((c) => [c.params.date, c.params.status, c.params.error_message]);
  assert.deepEqual(statuses, [['20260101', 'done', null], ['20260102', 'failed', 'boom']]);
});

test('persistCrawlResult locks the event row before touching odds', async () => {
  const db = fakeDb();
  const svc = createCrawlEventService({ db, eventCrawler: {} });
  await svc.persistCrawlResult(5, { matchId: 'e1', odds: [], oddsTimeline: null });
  assert.equal(db.txCount, 1);
  assert.match(db.calls[0].sql, /for update/);
  assert.equal(db.calls[0].params.event_id, 5);
  assert.match(db.calls[1].sql, /has_odds = false/); // empty odds clears flags
  assert.match(db.calls[2].sql, /delete from event_odds_timeline/);
  assert.match(db.calls[3].sql, /delete from event_odds /);
});

test('persistCrawlResult writes supported markets only, ht -> half-time, timeline flattened', async () => {
  const db = fakeDb();
  const svc = createCrawlEventService({ db, eventCrawler: {} });
  await svc.persistCrawlResult(5, {
    matchId: 'e1',
    odds: [
      { type: 'ht', market: 'hdc', line: '0#0', priceA: '1.9', priceB: '1.9' },
      { type: 'open', market: 'eu', line: '1', priceA: '1', priceB: '1' },
      { type: '', market: 'ou', line: '1', priceA: '1', priceB: '1' },
    ],
    oddsTimeline: { hdc: [{ market: 'hdc', line: '0#0', priceA: '1.9', priceB: '1.9', score: '0-0', matchMinute: "1'", crawledAt: '2026-01-01T20:00:00+07:00' }], ou: [{ market: 'bad' }], corner: null },
  });
  const odds = db.calls.find((c) => c.op === 'batch' && c.sql.includes('into event_odds ('));
  assert.deepEqual(odds.rows.map((r) => [r.type, r.market]), [['half-time', 'hdc']]);
  const tl = db.calls.find((c) => c.op === 'batch' && c.sql.includes('event_odds_timeline'));
  assert.equal(tl.rows.length, 1);
  assert.equal(tl.rows[0].crawled_at, '2026-01-01 20:00:00');
  assert.equal(tl.rows[0].goal, '0-0');
});

test('loadEventRowByExternalId filters on external_id only', async () => {
  const db = fakeDb();
  const svc = createCrawlEventService({ db, eventCrawler: {} });
  assert.equal(await svc.loadEventRowByExternalId('e1'), null);
  assert.match(db.calls[0].sql, /where e\.external_id = :externalId/);
  assert.doesNotMatch(db.calls[0].sql, /:eventId/);
  assert.deepEqual(db.calls[0].params, { externalId: 'e1' });
});

// ---- CrawEventServiceV2 flow --------------------------------------------------------------------
const row = (over = {}) => ({ event_id: 1, match_id: 'm1', link: 'https://x/match-a-b/m1', has_odds: 1, has_odds_corner: 0, status: 'NS', is_terminal: 0, is_in_play: 0, ...over });
const claimUpdates = (db) => db.calls.filter((c) => c.op === 'update' && /event_claim/.test(c.sql)).map((c) => [c.params.status, c.params.description]);

test('processEvent: skips unknown / linkless / no-odds events', async () => {
  for (const [rows, desc] of [[[], 'event not found'], [[row({ link: null })], 'event has no link'], [[row({ has_odds: 0 })], 'event has no odds']]) {
    const db = fakeDb(() => rows);
    await createCrawlEventService({ db, eventCrawler: {} }).processEvent(1);
    assert.deepEqual(claimUpdates(db), [['skipped', desc]]);
  }
});

test('processEvent: success completes claim (or releases for in-play)', async () => {
  const crawl = { crawlEvent: async () => ({ matchId: 'm1', odds: [], oddsTimeline: null }) };
  let db = fakeDb(() => [row()]);
  await createCrawlEventService({ db, eventCrawler: crawl }).processEvent(1);
  assert.deepEqual(claimUpdates(db), [['completed', 'odds updated']]);
  db = fakeDb(() => [row({ is_in_play: 1 })]);
  await createCrawlEventService({ db, eventCrawler: crawl }).processEvent(1);
  assert.ok(db.calls.some((c) => c.sql === 'delete from event_claim where event_id = :event_id'));
});

test('processEvent: empty response and exception fail the claim', async () => {
  let db = fakeDb(() => [row()]);
  await createCrawlEventService({ db, eventCrawler: { crawlEvent: async () => ({ matchId: null }) } }).processEvent(1);
  assert.deepEqual(claimUpdates(db), [['failed', 'empty odds crawl response (no Bet365?)']]);
  db = fakeDb(() => [row()]);
  await createCrawlEventService({ db, eventCrawler: { crawlEvent: async () => { throw new BusinessException('AISCORE_VERIFICATION_REQUIRED: x', 503); } } }).processEvent(1);
  assert.deepEqual(claimUpdates(db), [['failed', 'exception: AISCORE_VERIFICATION_REQUIRED: x']]);
});

test('processEvent: persist failure (lock error in tx) fails the claim, never completes it', async () => {
  const db = fakeDb(() => [row()]);
  db.withTx = async () => { throw Object.assign(new Error('Deadlock found'), { code: 'ER_LOCK_DEADLOCK' }); };
  await createCrawlEventService({ db, eventCrawler: { crawlEvent: async () => ({ matchId: 'm1', odds: [], oddsTimeline: null }) } }).processEvent(1);
  const claims = claimUpdates(db);
  assert.equal(claims.length, 1);
  assert.equal(claims[0][0], 'failed');
});

test('transient AiScore errors retry with backoff, up to 3 retries; no persist on failure (timeline kept)', async () => {
  const sleeps = [];
  let n = 0;
  const db = fakeDb(() => [row()]);
  const svc = createCrawlEventService({
    db, sleep: async (ms) => { sleeps.push(ms); },
    eventCrawler: { crawlEvent: async () => { n += 1; throw new BusinessException('AISCORE_ODDS_DETAIL_FETCH_FAILED: type=corner', 422); } },
  });
  await svc.processEvent(1);
  assert.equal(n, 4);
  assert.deepEqual(sleeps, [5000, 15000, 45000]);
  assert.ok(!db.calls.some((c) => /delete from event_odds_timeline/.test(c.sql)));
  assert.equal(claimUpdates(db)[0][0], 'failed');
});

test('verification challenge is never retried', async () => {
  let n = 0;
  const db = fakeDb(() => [row()]);
  await createCrawlEventService({
    db, sleep: async () => { throw new Error('must not sleep'); },
    eventCrawler: { crawlEvent: async () => { n += 1; throw new BusinessException('AISCORE_VERIFICATION_REQUIRED: x', 503); } },
  }).processEvent(1);
  assert.equal(n, 1);
});

test('recrawlOdds: domain errors and success result', async () => {
  const mk = (rows, crawl) => createCrawlEventService({ db: fakeDb(() => rows), eventCrawler: { crawlEvent: crawl } });
  await assert.rejects(mk([], null).recrawlOdds(1), (e) => e.status === 404 && /Event not found: 1/.test(e.message));
  await assert.rejects(mk([row({ link: '' })], null).recrawlOdds(1), /Event has no link: 1/);
  await assert.rejects(mk([row({ link: 'https://x/' })], null).recrawlOdds(1), /Cannot parse matchId/);
  await assert.rejects(mk([row()], async () => ({ matchId: null })).recrawlOdds(1), /Empty odds crawl response/);
  await assert.rejects(
    mk([row()], async () => { throw new Error('Duplicate entry x for key y'); }).recrawlOdds(1),
    (e) => e.status === 422 && e.message === 'AISCORE_RECRAWL_FAILED: eventId=1' && !/Duplicate entry/.test(e.message),
  );
  const ok = await mk([row()], async () => ({ matchId: 'm1', odds: [{ type: 'open', market: 'hdc', line: '0#0', priceA: '1', priceB: '1' }], oddsTimeline: null })).recrawlOdds(1);
  assert.deepEqual(ok, { success: true, message: null, oddsRowCount: 1 });
});
