import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPredictionSupport, hasRequiredHdcOuLines, hasRequiredOpenPrematchLines, hasCornerLines, hasRequiredOpenPrematchPrices,
  majorityPick, picksForScore, buildCompletedResult,
} from '../src/prediction/support.js';
import { buildNoPriceSql, buildWithPriceSql, createHistoricalScoreMatcher } from '../src/prediction/matcher.js';
import { createLinePatternEngine, createEngineRegistry, ENGINE_SPECS } from '../src/prediction/engines.js';
import { createActiveVersionCache } from '../src/prediction/active-versions.js';
import { settleHandicap, settleOverUnder, parsePick, createSettleService } from '../src/prediction/settle.js';
import { convertLine } from '../src/prediction/odd-converter.js';

const odds = (oh, ph, oo, po, oc = null, pc = null, extra = {}) => ({
  eventId: 1, leagueId: 10, openHdcLine: oh, prematchHdcLine: ph, openOuLine: oo, prematchOuLine: po, openCornerLine: oc, prematchCornerLine: pc,
  openHdcPriceA: null, openHdcPriceB: null, openOuPriceA: null, openOuPriceB: null, openCornerPriceA: null, openCornerPriceB: null,
  prematchHdcPriceA: null, prematchHdcPriceB: null, prematchOuPriceA: null, prematchOuPriceB: null, prematchCornerPriceA: null, prematchCornerPriceB: null,
  ...extra,
});

// ---- PredictionEngineSupportTest port ----
test('hasRequiredHdcOuLines requires all four lines', () => {
  assert.equal(hasRequiredHdcOuLines(odds('0#0', '0#0', '2.5', '2.5')), true);
  assert.equal(hasRequiredHdcOuLines(odds('0#0', '0#0', '2.5', null)), false);
});

test('corner lines: optional when both blank, required together when present', () => {
  const none = odds('0#0', '0#0', '2.5', '2.5');
  assert.equal(hasRequiredOpenPrematchLines(none), true);
  assert.equal(hasCornerLines(none), false);
  assert.equal(hasRequiredOpenPrematchLines(odds('0#0', '0#0', '2.5', '2.5', '9.5', '9.5')), true);
  assert.equal(hasCornerLines(odds('0#0', '0#0', '2.5', '2.5', '9.5', '9.5')), true);
  assert.equal(hasRequiredOpenPrematchLines(odds('0#0', '0#0', '2.5', '2.5', '9.5', null)), false);
});

test('prices: corner prices required only when corner lines present', () => {
  const p = '0.90';
  const base = { openHdcPriceA: p, openHdcPriceB: p, openOuPriceA: p, openOuPriceB: p, prematchHdcPriceA: p, prematchHdcPriceB: p, prematchOuPriceA: p, prematchOuPriceB: p };
  const corner = { openCornerPriceA: p, openCornerPriceB: p, prematchCornerPriceA: p, prematchCornerPriceB: p };
  assert.equal(hasRequiredOpenPrematchPrices(odds('0#0', '0#0', '2.5', '2.5', null, null, base)), true);
  assert.equal(hasRequiredOpenPrematchPrices(odds('0#0', '0#0', '2.5', '2.5', '9.5', '9.5', { ...base, ...corner })), true);
  assert.equal(hasRequiredOpenPrematchPrices(odds('0#0', '0#0', '2.5', '2.5', '9.5', '9.5', { ...base, openCornerPriceA: p, openCornerPriceB: p })), false);
  // corner prices without corner lines is inconsistent -> not usable
  assert.equal(hasRequiredOpenPrematchPrices(odds('0#0', '0#0', '2.5', '2.5', null, null, { ...base, ...corner })), false);
});

// ---- PredictionEngineSupportCleanupTest port ----
function fakeDb(handler) {
  const calls = [];
  const db = {
    calls,
    async query(sql, params) { calls.push({ op: 'query', sql, params }); return handler.query(sql, params, calls); },
    async update(sql, params) { calls.push({ op: 'update', sql, params }); return handler.update ? handler.update(sql, params) : 1; },
    async withTx(fn) { return fn(db); },
    async batchInsertSafe() {},
  };
  return db;
}

test('deleteEventIfNoCurrentPredictionRows deletes children before the guarded event delete', async () => {
  let q = 0;
  const db = fakeDb({ query: () => [[{ event_id: 123 }], []][q++] });
  assert.equal(await createPredictionSupport(db).deleteEventIfNoCurrentPredictionRows(123), true);
  const sqls = db.calls.map((c) => c.sql);
  assert.match(sqls[0], /for update/);
  assert.match(sqls[1], /select 1/);
  assert.match(sqls[2], /delete from event_odds\n/);
  assert.match(sqls[3], /delete from event_odds_timeline/);
  assert.match(sqls[4], /delete from event_result/);
  assert.match(sqls[5], /delete from event_crawl_failed/);
  for (const s of ['delete from events', 'not exists', 'NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE']) assert.ok(sqls[6].includes(s), s);
});

test('deleteEventIfNoCurrentPredictionRows keeps the event when a current prediction exists', async () => {
  let q = 0;
  const db = fakeDb({ query: () => [[{ event_id: 123 }], [{ 1: 1 }]][q++] });
  assert.equal(await createPredictionSupport(db).deleteEventIfNoCurrentPredictionRows(123), false);
  assert.equal(db.calls.filter((c) => c.op === 'update').length, 0);
});

test('deleteEventIfNoCurrentPredictionRows returns false for an unknown event', async () => {
  const db = fakeDb({ query: () => [] });
  assert.equal(await createPredictionSupport(db).deleteEventIfNoCurrentPredictionRows(1), false);
});

// ---- HistoricalScoreMatcherTest port ----
test('buildNoPriceSql includes corner branches when corner lines present', () => {
  const sql = buildNoPriceSql(odds('0#0', '0#0', '2.5', '2.5', '9.5', '9.5'));
  for (const s of ['union all', "market = 'corner'", 'line = :open_corner_line', 'line = :prematch_corner_line', 'having count(distinct k) = 6']) assert.ok(sql.includes(s), s);
});

test('buildNoPriceSql omits corner branches when corner lines missing', () => {
  const sql = buildNoPriceSql(odds('0#0', '0#0', '2.5', '2.5'));
  assert.ok(sql.includes("market = 'hdc'") && sql.includes("market = 'ou'") && sql.includes('having count(distinct k) = 4'));
  assert.ok(!sql.includes("market = 'corner'"));
});

test('buildWithPriceSql adds price predicates and the extra where', () => {
  const sql = buildWithPriceSql(odds('0#0', '0#0', '2.5', '2.5'), 'and e.league_id = :league_id');
  for (const s of ['and e.league_id = :league_id', 'price_a = :open_hdc_price_a', 'price_b = :prematch_ou_price_b']) assert.ok(sql.includes(s), s);
  assert.ok(!sql.includes("market = 'corner'"));
});

test('matcher binds every named param it references (no undefined)', async () => {
  const db = fakeDb({ query: () => [{ ft_goal_str: '2-1', match_count: '3' }] });
  const m = createHistoricalScoreMatcher(db);
  const o = odds('0#0', '0#0', '2.5', '2.5', '9.5', '9.5', { openHdcPriceA: '1.9' });
  assert.deepEqual(await m.findTopScoresWithPrice(5, o), [{ ftGoalStr: '2-1', matchCount: 3 }]);
  await m.findTopScoresNoPrice(5, o);
  await m.findTopScoresWithLeagueNoPrice(5, o);
  for (const c of db.calls) {
    for (const name of new Set([...c.sql.matchAll(/:([a-z_]+)/g)].map((x) => x[1]))) {
      assert.ok(name in c.params && c.params[name] !== undefined, `${name} unbound`);
    }
  }
  assert.equal(db.calls[0].params.open_hdc_price_a, '1.9');
});

// ---- AbstractLinePatternPredictionEngineTest port ----
const supportStub = (calls) => ({
  loadTargetOdds: async (id) => { calls.push(['load', id]); return odds('0#0', '0#0', '2.5', '2.5', null, null, { eventId: id, leagueId: 200 }); },
  buildCompletedResult: (o, s) => ({ status: 'completed', o, s }),
  buildSkippedResult: (m) => ({ status: 'skipped', m }),
});
const stubSpec = { findTopScores: async () => [{ ftGoalStr: '2-1', matchCount: 3 }], hasRequiredData: () => true, missingMessage: () => 'missing' };

test('compute(eventId) loads odds from the database', async () => {
  const calls = [];
  const engine = createLinePatternEngine({ db: {}, code: 'T', spec: stubSpec, makeSupport: () => supportStub(calls), makeMatcher: () => ({}) });
  const r = await engine.compute(100);
  assert.equal(r.status, 'completed');
  assert.deepEqual(calls, [['load', 100]]);
});

test('compute: a non-number id (BIGINT string) still loads odds by id', async () => {
  const calls = [];
  const engine = createLinePatternEngine({ db: {}, code: 'T', spec: stubSpec, makeSupport: () => supportStub(calls), makeMatcher: () => ({}) });
  assert.equal((await engine.compute('9007199254740993')).status, 'completed');
  assert.deepEqual(calls, [['load', '9007199254740993']]);
});

test('compute(targetOdds) does not load odds from the database', async () => {
  const calls = [];
  const engine = createLinePatternEngine({ db: {}, code: 'T', spec: stubSpec, makeSupport: () => supportStub(calls), makeMatcher: () => ({}) });
  const r = await engine.compute(odds('0#0', '0#0', '2.5', '2.5', null, null, { eventId: null, leagueId: null }));
  assert.equal(r.status, 'completed');
  assert.deepEqual(calls, []);
});

test('compute: missing data and no history are skipped with messages', async () => {
  const mk = (spec) => createLinePatternEngine({ db: {}, code: 'T', spec: { ...stubSpec, ...spec }, makeSupport: () => supportStub([]), makeMatcher: () => ({}) });
  assert.deepEqual(await mk({ hasRequiredData: () => false }).compute(odds()), { status: 'skipped', m: 'missing' });
  assert.deepEqual(await mk({ findTopScores: async () => [] }).compute(odds()), { status: 'skipped', m: 'No historical matches for odds pattern' });
});

test('predict persists completed / skipped inside one transaction', async () => {
  const log = [];
  let tx = 0;
  const db = { async withTx(fn) { tx += 1; return fn({}); } };
  const support = (o) => ({
    loadTargetOdds: async () => o,
    updateSkipped: async (e, v, m) => log.push(['skipped', e, v, m]),
    updateCompleted: async (e, v, od, s) => log.push(['completed', e, v, s.length]),
  });
  const run = (o, spec) => createLinePatternEngine({ db, code: 'T', spec: { ...stubSpec, ...spec }, makeSupport: () => support(o), makeMatcher: () => ({}) }).predict(7, 9);
  await run(null);
  await run(odds('0#0', '0#0', '2.5', '2.5'), { hasRequiredData: () => false });
  await run(odds('0#0', '0#0', '2.5', '2.5'), { findTopScores: async () => [] });
  await run(odds('0#0', '0#0', '2.5', '2.5'));
  assert.deepEqual(log, [
    ['skipped', 7, 9, 'Event not found'], ['skipped', 7, 9, 'missing'],
    ['skipped', 7, 9, 'No historical matches for odds pattern'], ['completed', 7, 9, 1],
  ]);
  assert.equal(tx, 4);
});

test('engine specs: missing-requirement messages', () => {
  const np = ENGINE_SPECS.NO_PRICE;
  assert.equal(np.missingMessage(odds(null, '0#0', '2.5', '2.5')), 'Missing required open or pre-match hdc/ou lines');
  assert.equal(np.missingMessage(odds('0#0', '0#0', '2.5', '2.5', '9.5', null)), 'Missing required open or pre-match corner lines');
  const wp = ENGINE_SPECS.WITH_PRICE;
  assert.equal(wp.missingMessage(odds('0#0', '0#0', '2.5', '2.5')), 'Missing required open or pre-match hdc/ou prices');
  assert.equal(wp.missingMessage(odds('0#0', '0#0', '2.5', '2.5', '9.5', '9.5')), 'Missing required open or pre-match corner prices');
  assert.equal(wp.missingMessage(odds('0#0', '0#0', '2.5', '2.5', '9.5', null)), 'Missing required open or pre-match corner lines');
  const wl = ENGINE_SPECS.WITH_LEAGUE_NO_PRICE;
  assert.equal(wl.missingMessage(odds('0#0', '0#0', '2.5', '2.5', null, null, { leagueId: null })), 'Missing league_id on event');
  assert.equal(wl.hasRequiredData(odds('0#0', '0#0', '2.5', '2.5', null, null, { leagueId: null })), false);
});

test('registry resolves only the three current codes (deprecated codes stay unregistered, as in v1)', () => {
  const reg = createEngineRegistry({ db: {} });
  for (const c of ['NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE']) assert.equal(reg.findEngine(c).code, c);
  assert.equal(reg.findEngine('base_data'), null);
  assert.equal(reg.findEngine('odds_movement'), null);
  assert.equal(reg.findEngine('nope'), null);
});

// ---- picks / majority ----
test('picksForScore uses prematch lines with decimal-exact comparison', () => {
  const o = odds('0#0', '-0.5#+0.5', '2.5', '2.5');
  assert.deepEqual(picksForScore('1-0', o), { hdcPick: 'HOME', ouPick: 'UNDER' });
  assert.deepEqual(picksForScore('1-1', o), { hdcPick: 'AWAY', ouPick: 'UNDER' });
  assert.deepEqual(picksForScore('2-1', o), { hdcPick: 'HOME', ouPick: 'OVER' });
  assert.throws(() => picksForScore('x-1', o));
  // quarter line -1/1.5 = -1.25: 2-1 -> 2-1.25 = 0.75 < 1 -> AWAY
  assert.equal(picksForScore('2-1', odds('0#0', '-1/1.5#+1/1.5', '2.5', '2.5')).hdcPick, 'AWAY');
});

test('majorityPick: highest count wins, ties go to the larger name, NONE ignored, empty is NONE', () => {
  assert.equal(majorityPick(new Map([['HOME', 2], ['AWAY', 1]])), 'HOME');
  assert.equal(majorityPick(new Map([['HOME', 1], ['AWAY', 1]])), 'HOME');
  assert.equal(majorityPick(new Map([['OVER', 1], ['UNDER', 1]])), 'UNDER');
  assert.equal(majorityPick(new Map([['NONE', 5], ['OVER', 1]])), 'OVER');
  assert.equal(majorityPick(new Map()), 'NONE');
});

test('buildCompletedResult aggregates votes and sample size', () => {
  const o = odds('0#0', '0#0', '2.5', '2.5');
  const r = buildCompletedResult(o, [{ ftGoalStr: '2-1', matchCount: 5 }, { ftGoalStr: '0-0', matchCount: 3 }, { ftGoalStr: '1-0', matchCount: 2 }]);
  assert.equal(r.status, 'completed');
  assert.equal(r.matchSampleCount, 5);
  assert.deepEqual(r.goalStrPick, ['2-1', '0-0', '1-0']);
  assert.equal(r.hdcPick, 'HOME');
  assert.equal(r.hdcVoteCount, 3); // 0#0: 2-1, 0-0 and 1-0 all vote HOME
});

test('updateCompleted writes picks, drops corner snapshot without corner lines, deletes when no useful pick', async () => {
  const db = fakeDb({ query: () => [] });
  const s = createPredictionSupport(db);
  const o = odds('0#0', '0#0', '2.5', '2.5', '9.5', null, { prematchHdcPriceA: '1.90' });
  await s.updateCompleted(1, 2, o, [{ ftGoalStr: '2-1', matchCount: 4 }]);
  const p = db.calls[0].params;
  assert.equal(p.goal_str_pick, '["2-1"]');
  assert.equal(p.open_corner_line, null); // only one corner line -> snapshot dropped
  assert.equal(p.prematch_hdc_price_a, '1.90');
  assert.equal(p.match_sample_count, 4);
  await s.updateCompleted(1, 2, o, []); // no scores -> NONE picks -> delete
  assert.match(db.calls[1].sql, /delete from event_prediction/);
  await s.updateSkipped(1, 2, 'x'.repeat(600));
  assert.equal(db.calls[2].params.error_message.length, 512);
  assert.equal(db.calls[2].params.status, 'skipped');
});

test('loadTargetOdds maps every SQL alias to its camelCase field; empty result is null', async () => {
  const fields = {
    open_hdc_line: 'openHdcLine', prematch_hdc_line: 'prematchHdcLine', open_ou_line: 'openOuLine', prematch_ou_line: 'prematchOuLine',
    open_corner_line: 'openCornerLine', prematch_corner_line: 'prematchCornerLine',
    open_hdc_price_a: 'openHdcPriceA', open_hdc_price_b: 'openHdcPriceB', open_ou_price_a: 'openOuPriceA', open_ou_price_b: 'openOuPriceB',
    open_corner_price_a: 'openCornerPriceA', open_corner_price_b: 'openCornerPriceB',
    prematch_hdc_price_a: 'prematchHdcPriceA', prematch_hdc_price_b: 'prematchHdcPriceB',
    prematch_ou_price_a: 'prematchOuPriceA', prematch_ou_price_b: 'prematchOuPriceB',
    prematch_corner_price_a: 'prematchCornerPriceA', prematch_corner_price_b: 'prematchCornerPriceB',
  };
  // Row is built from the aliases the SQL actually selects, so a typo on either side fails here.
  const db = fakeDb({
    query: (sql) => {
      const row = { event_id: '42', league_id: '7' };
      for (const [, alias] of sql.matchAll(/\bas (\w+)/g)) row[alias] = `v_${alias}`;
      return [row];
    },
  });
  const o = await createPredictionSupport(db).loadTargetOdds(42);
  assert.deepEqual(db.calls[0].params, { event_id: 42 });
  assert.equal(o.eventId, 42);
  assert.equal(o.leagueId, 7);
  for (const [alias, field] of Object.entries(fields)) assert.equal(o[field], `v_${alias}`, field);
  assert.equal(Object.keys(o).length, 20);
  assert.equal(await createPredictionSupport(fakeDb({ query: () => [] })).loadTargetOdds(1), null);
});

test('loadVersionId returns a Number or null; updateFailed persists status failed', async () => {
  let rows = [{ prediction_version_id: '5' }];
  const db = fakeDb({ query: () => rows });
  const s = createPredictionSupport(db);
  assert.equal(await s.loadVersionId('NO_PRICE'), 5);
  assert.deepEqual(db.calls[0].params, { code: 'NO_PRICE' });
  rows = [];
  assert.equal(await s.loadVersionId('X'), null);
  await s.updateFailed(1, 2, 'boom');
  assert.deepEqual(db.calls[2].params, { event_id: 1, prediction_version_id: 2, status: 'failed', error_message: 'boom' });
});

// ---- active version cache ----
test('active versions: cached 15 min, empty never cached, concurrent reloads shared', async () => {
  let now = 1000;
  let calls = 0;
  let rows = [{ prediction_version_id: '2', code: 'B' }, { prediction_version_id: 1, code: 'A' }];
  const db = { async query() { calls += 1; return rows; } };
  const cache = createActiveVersionCache({ db, now: () => now });
  const [a, b] = await Promise.all([cache.getActiveVersions(), cache.getActiveVersions()]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.deepEqual(a[0], { predictionVersionId: 2, code: 'B' });
  now += 14 * 60 * 1000;
  await cache.getActiveVersions();
  assert.equal(calls, 1);
  now += 2 * 60 * 1000;
  await cache.getActiveVersions();
  assert.equal(calls, 2);
  rows = [];
  now += 20 * 60 * 1000;
  assert.deepEqual(await cache.getActiveVersions(), []);
  await cache.getActiveVersions();
  assert.equal(calls, 4); // empty result is re-queried
});

test('active versions: failed reload clears inflight so the next call re-queries', async () => {
  let calls = 0;
  const db = { async query() { calls += 1; if (calls === 1) throw new Error('db down'); return [{ prediction_version_id: 1, code: 'A' }]; } };
  const cache = createActiveVersionCache({ db });
  await assert.rejects(cache.getActiveVersions(), /db down/);
  assert.deepEqual(await cache.getActiveVersions(), [{ predictionVersionId: 1, code: 'A' }]);
  assert.equal(calls, 2);
});

test('active versions: synchronous query throw does not poison the cache', async () => {
  let calls = 0;
  const db = { query() { calls += 1; if (calls === 1) throw new Error('sync boom'); return Promise.resolve([{ prediction_version_id: 1, code: 'A' }]); } };
  const cache = createActiveVersionCache({ db });
  await assert.rejects(cache.getActiveVersions(), /sync boom/);
  assert.deepEqual(await cache.getActiveVersions(), [{ predictionVersionId: 1, code: 'A' }]);
  assert.equal(calls, 2);
});

// ---- settlement ----
test('convertLine', () => {
  assert.equal(convertLine('+0.5').toString(), '0.5');
  assert.equal(convertLine('-1/1.5').toString(), '-1.25');
  assert.equal(convertLine('2.5/3').toString(), '2.75');
  assert.throws(() => convertLine('1/2/3'));
  assert.throws(() => convertLine('abc'));
});

test('settleHandicap / settleOverUnder', () => {
  assert.equal(settleHandicap(1, 0, '-0.5#+0.5', 'HOME'), 'WIN');
  assert.equal(settleHandicap(1, 0, '-0.5#+0.5', 'AWAY'), 'LOSE');
  assert.equal(settleHandicap(1, 0, '-1#+1', 'HOME'), 'VOID');
  assert.equal(settleHandicap(1, 1, '0#0', 'HOME'), 'VOID');
  assert.equal(settleHandicap(0, 1, '0#0', 'AWAY'), 'WIN');
  assert.equal(settleHandicap(0, 1, '0#0', 'OVER'), 'NONE');
  assert.equal(settleHandicap(0, 1, '', 'HOME'), 'NONE');
  assert.equal(settleHandicap(0, 1, '0#0', null), 'NONE');
  assert.equal(settleOverUnder(2, 1, '2.5', 'OVER'), 'WIN');
  assert.equal(settleOverUnder(2, 1, '2.5', 'UNDER'), 'LOSE');
  assert.equal(settleOverUnder(2, 1, '3', 'OVER'), 'VOID');
  assert.equal(settleOverUnder(1, 0, '2.5/3', 'UNDER'), 'WIN');
  assert.equal(settleOverUnder(1, 0, '2.5', 'HOME'), 'NONE');
  assert.equal(parsePick('over'), 'NONE');
  assert.equal(parsePick('OVER'), 'OVER');
  assert.equal(parsePick(null), 'NONE');
});

test('settleEvent updates each unsettled row inside one transaction', async () => {
  const rows = [{ event_prediction_id: 5, hdc_pick: 'HOME', ou_pick: 'OVER', prematch_hdc_line: '-0.5#+0.5', prematch_ou_line: '2.5', ft_home_goal: 2, ft_away_goal: 1, ft_goal_str: '2-1' }];
  let tx = 0;
  const db = fakeDb({ query: () => rows });
  const wrapped = { ...db, withTx: async (fn) => { tx += 1; return fn(db); } };
  await createSettleService({ db: wrapped }).settleEvent(77);
  assert.equal(tx, 1);
  assert.deepEqual(db.calls[0].params, { event_id: 77 });
  assert.deepEqual(db.calls[1].params, { event_prediction_id: 5, actual_ft_goal_str: '2-1', result_hdc: 'WIN', result_ou: 'WIN' });
});

test('settleEvent propagates a malformed line so withTx rolls back the whole event', async () => {
  const rows = [
    { event_prediction_id: 5, hdc_pick: 'HOME', ou_pick: 'OVER', prematch_hdc_line: '-0.5#+0.5', prematch_ou_line: '2.5', ft_home_goal: 2, ft_away_goal: 1, ft_goal_str: '2-1' },
    { event_prediction_id: 6, hdc_pick: 'HOME', ou_pick: 'OVER', prematch_hdc_line: 'abc', prematch_ou_line: '2.5', ft_home_goal: 2, ft_away_goal: 1, ft_goal_str: '2-1' },
  ];
  const db = fakeDb({ query: () => rows });
  let txError = null;
  const wrapped = { ...db, withTx: async (fn) => { try { return await fn(db); } catch (e) { txError = e; throw e; } } };
  await assert.rejects(createSettleService({ db: wrapped }).settleEvent(77));
  assert.ok(txError, 'withTx must observe the throw to roll back');
});

test('settleHandicap quarter / split lines', () => {
  for (const line of ['-0.25#+0.25', '-0/0.5#+0/0.5']) {
    assert.equal(settleHandicap(1, 1, line, 'HOME'), 'LOSE');
    assert.equal(settleHandicap(1, 1, line, 'AWAY'), 'WIN');
    assert.equal(settleHandicap(1, 0, line, 'HOME'), 'WIN');
    assert.equal(settleHandicap(1, 0, line, 'AWAY'), 'LOSE');
  }
});
