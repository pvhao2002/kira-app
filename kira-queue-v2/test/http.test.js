import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { createHttpServer, createTokenGuard, MAX_BODY_BYTES } from '../src/http.js';
import { createOnDemandPredictService } from '../src/service/on-demand-predict.js';
import { createOnDemandUrlPredictService, extractMatchId } from '../src/service/on-demand-url-predict.js';
import { createPredictService, parseJob, parseSettleEventId } from '../src/service/predict.js';
import { createEngineRegistry } from '../src/prediction/engines.js';
import { BusinessException } from '../src/util.js';

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const TOKEN = 't0k';
const b64 = Buffer.from([1, 2]).toString('base64');
const lockErr = (code = 'ER_LOCK_DEADLOCK') => Object.assign(new Error('x'), { code });

// ---- ExtensionTokenFilterTest port ----
test('token guard: missing / wrong / empty env are rejected, correct passes', () => {
  assert.equal(createTokenGuard(sha('t'))(undefined), false);
  assert.equal(createTokenGuard(sha('t'))('Bearer other'), false);
  assert.equal(createTokenGuard(sha('t'))('Basic t'), false);
  assert.equal(createTokenGuard('')('Bearer t'), false);
  assert.equal(createTokenGuard(undefined)('Bearer t'), false);
  assert.equal(createTokenGuard('zz')('Bearer t'), false); // invalid hex fails closed
  assert.equal(createTokenGuard(sha('t'))('Bearer t'), true);
  assert.equal(createTokenGuard(sha('t').toUpperCase())('Bearer  t '), true);
});

// ---- harness ----
async function harness(over = {}) {
  const calls = { persistDate: [], persistCrawl: [], query: [] };
  const deps = {
    config: { server: { contextPath: '/queue' }, extension: { tokenSha256: sha(TOKEN) } },
    db: { query: async (sql, p) => { calls.query.push({ sql, p }); return [{ external_id: 'e1' }]; } },
    dateCrawler: { mapMatches: () => ({ events: [{ event: { externalId: 'e1', eventName: 'n', eventDate: '2026-01-01T20:00:00+07:00', statusId: 1, hasOdds: true, hasOddsCorner: false } }] }) },
    eventCrawler: { mapOdds: () => ({ matchId: 'e1', odds: [] }) },
    crawlDateService: { persistDate: async (d, e) => { calls.persistDate.push([d, e]); } },
    crawlEventService: {
      loadEventRowByExternalId: async () => ({ eventId: 5, hasOddsCorner: false }),
      persistCrawlResult: async (id, r) => { calls.persistCrawl.push([id, r]); },
    },
    onDemandPredict: { predict: async (id, re) => ({ eventId: id, recrawled: re, predictions: {} }) },
    onDemandUrlPredict: { predict: async (r) => ({ url: r.url }) },
    sleep: async () => {},
    random: () => 0,
    ...over,
  };
  const server = createHttpServer(deps);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const call = (method, path, { body, headers = {}, auth = true, raw } = {}) => new Promise((resolve, reject) => {
    const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { ...(auth ? { authorization: `Bearer ${TOKEN}` } : {}), ...(payload !== undefined ? { 'content-type': 'application/json' } : {}), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const text = Buffer.concat(chunks).toString(); resolve({ status: res.statusCode, text, json: text ? JSON.parse(text) : null }); });
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
  return { call, calls, deps, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) };
}

const oddsBody = (details = { asia: b64, bs: b64 }) => ({ oddsList: b64, details });
const MATCHES = '/queue/ext/dates/20260101/matches';

// ---- ExtensionCrawlControllerTest port ----
test('auth: /ext needs the token, /predict does not', async (t) => {
  const h = await harness(); t.after(h.close);
  assert.equal((await h.call('POST', MATCHES, { body: { body: b64 }, auth: false })).status, 401);
  assert.equal((await h.call('POST', MATCHES, { body: { body: b64 }, headers: { authorization: 'Bearer nope' } })).status, 401);
  assert.equal((await h.call('POST', '/queue/predict/events/1', { auth: false })).status, 200);
  const empty = await harness({ config: { server: { contextPath: '/queue' }, extension: { tokenSha256: '' } } });
  t.after(empty.close);
  assert.equal((await empty.call('POST', MATCHES, { body: { body: b64 } })).status, 401);
});

test('oversized body is 413 by Content-Length and while streaming', async (t) => {
  const h = await harness(); t.after(h.close);
  // Declared length only, no bytes sent: only the Content-Length pre-check can answer (readBody would wait).
  const declared = await h.call('POST', MATCHES, { headers: { 'content-length': String(MAX_BODY_BYTES + 1) } });
  assert.equal(declared.status, 413);
  // Chunked (no Content-Length): capped while streaming.
  const big = JSON.stringify({ body: 'A'.repeat(MAX_BODY_BYTES + 10) });
  const r = await h.call('POST', MATCHES, { raw: big });
  assert.equal(r.status, 413);
  assert.equal(h.calls.persistDate.length, 0);
});

test('large valid base64 body (~4.5 MB) is decoded and persisted', async (t) => {
  let decoded = 0;
  const h = await harness({ dateCrawler: { mapMatches: (_d, bytes) => { decoded = bytes.length; return { events: [] }; } } });
  t.after(h.close);
  const body = Buffer.alloc(3_400_000, 7).toString('base64');
  const r = await h.call('POST', MATCHES, { body: { body } });
  assert.equal(r.status, 200);
  assert.equal(decoded, 3_400_000);
  assert.equal(h.calls.persistDate.length, 1);
});

test('bad base64 / bad date / malformed json are 400 without echoing payload', async (t) => {
  const h = await harness(); t.after(h.close);
  assert.equal((await h.call('POST', MATCHES, { body: { body: '***' } })).status, 400);
  assert.equal((await h.call('POST', MATCHES, { body: {} })).json.message, 'AISCORE_INVALID_BASE64');
  assert.equal((await h.call('POST', '/queue/ext/dates/2026-01-01/matches', { body: { body: b64 } })).json.message, 'AISCORE_INVALID_DATE');
  assert.equal((await h.call('POST', '/queue/ext/dates/20260230/matches', { body: { body: b64 } })).json.message, 'AISCORE_INVALID_DATE');
  assert.equal((await h.call('POST', '/queue/ext/dates/%E0%A4/matches', { body: { body: b64 } })).json.message, 'AISCORE_INVALID_DATE');
  const esc = await h.call('POST', '/queue/ext/events/%E0%A4/odds', { body: oddsBody() });
  assert.deepEqual([esc.status, esc.json.message], [400, 'AISCORE_INVALID_EXTERNAL_ID']);
  for (const v of ['A===', 'AA=A', 'AAAAA', '====']) assert.equal((await h.call('POST', MATCHES, { body: { body: v } })).json.message, 'AISCORE_INVALID_BASE64');
  const bad = await h.call('POST', '/queue/ext/events/e1/odds', { raw: '{"oddsList":SECRET' });
  assert.deepEqual(bad.json, { error: 'Bad Request', message: 'AISCORE_INVALID_BODY' });
  assert.ok(!bad.text.includes('SECRET'));
  assert.equal(h.calls.persistDate.length, 0);
});

test('dates response is compact and persists', async (t) => {
  const h = await harness(); t.after(h.close);
  const r = await h.call('POST', MATCHES, { body: { body: b64 } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, [{ externalId: 'e1', eventDate: '2026-01-01T20:00:00+07:00', statusId: 1, hasOdds: true, hasOddsCorner: false }]);
  assert.equal(h.calls.persistDate[0][0], '20260101');
});

test('no bet365 writes nothing', async (t) => {
  const h = await harness({ eventCrawler: { mapOdds: () => ({ matchId: null, odds: [] }) } }); t.after(h.close);
  const r = await h.call('POST', '/queue/ext/events/e1/odds', { body: oddsBody() });
  assert.deepEqual(r.json, { status: 'no_bet365' });
  assert.equal(h.calls.persistCrawl.length, 0);
});

test('odds ok persists with the DB event id and reports rows', async (t) => {
  const h = await harness({ eventCrawler: { mapOdds: () => ({ matchId: 'e1', odds: [{}, {}] }) } }); t.after(h.close);
  const r = await h.call('POST', '/queue/ext/events/e1/odds', { body: oddsBody() });
  assert.deepEqual(r.json, { status: 'ok', oddsRows: 2 });
  assert.equal(h.calls.persistCrawl[0][0], 5);
});

test('DB says corner but body has none: 422 and nothing persisted', async (t) => {
  const h = await harness({ crawlEventService: { loadEventRowByExternalId: async () => ({ eventId: 5, hasOddsCorner: true }), persistCrawlResult: async () => { throw new Error('no'); } } });
  t.after(h.close);
  const r = await h.call('POST', '/queue/ext/events/e1/odds', { body: oddsBody() });
  assert.equal(r.status, 422);
  assert.equal(r.json.message, 'AISCORE_ODDS_DETAIL_FETCH_FAILED: corner');
});

test('unknown event 404, missing details 400, bad external id 400', async (t) => {
  const h = await harness({ crawlEventService: { loadEventRowByExternalId: async () => null } }); t.after(h.close);
  const nf = await h.call('POST', '/queue/ext/events/e1/odds', { body: oddsBody() });
  assert.equal(nf.status, 404);
  assert.equal(nf.json.message, 'AISCORE_EVENT_NOT_FOUND');
  assert.equal((await h.call('POST', '/queue/ext/events/e1/odds', { body: { oddsList: b64 } })).status, 400);
  const id = await h.call('POST', '/queue/ext/events/e!1/odds', { body: oddsBody() });
  assert.equal(id.status, 400);
  assert.equal(id.json.message, 'AISCORE_INVALID_EXTERNAL_ID');
});

test('decode error and DB error hide internals behind domain codes', async (t) => {
  let h = await harness({ eventCrawler: { mapOdds: () => { throw new Error('secret detail'); } } });
  let r = await h.call('POST', '/queue/ext/events/e1/odds', { body: oddsBody() });
  assert.equal(r.status, 422);
  assert.equal(r.json.message, 'AISCORE_DECODE_FAILED');
  assert.ok(!r.text.includes('secret'));
  await h.close();
  h = await harness({ crawlEventService: { loadEventRowByExternalId: async () => ({ eventId: 5, hasOddsCorner: false }), persistCrawlResult: async () => { throw new Error('delete from event_odds_timeline'); } } });
  r = await h.call('POST', '/queue/ext/events/e1/odds', { body: oddsBody() });
  assert.equal(r.status, 500);
  assert.equal(r.json.message, 'AISCORE_PERSIST_FAILED');
  assert.ok(!r.text.includes('delete from'));
  await h.close();
});

test('odds deadlock is retried once more (new tx), then succeeds', async (t) => {
  let n = 0;
  const h = await harness({ crawlEventService: { loadEventRowByExternalId: async () => ({ eventId: 5, hasOddsCorner: false }), persistCrawlResult: async () => { n += 1; if (n === 1) throw lockErr(); } } });
  t.after(h.close);
  assert.equal((await h.call('POST', '/queue/ext/events/e1/odds', { body: oddsBody() })).status, 200);
  assert.equal(n, 2);
});

test('persistDate lock failure gives up after 3 attempts with backoff 50-150ms x attempt', async (t) => {
  let n = 0;
  const sleeps = [];
  const h = await harness({ sleep: async (ms) => { sleeps.push(ms); }, random: () => 0.5, crawlDateService: { persistDate: async () => { n += 1; throw lockErr('ER_LOCK_WAIT_TIMEOUT'); } } });
  t.after(h.close);
  const r = await h.call('POST', MATCHES, { body: { body: b64 } });
  assert.equal(r.status, 500);
  assert.equal(r.json.message, 'AISCORE_PERSIST_FAILED');
  assert.equal(n, 3);
  assert.deepEqual(sleeps, [100, 200]);
});

test('non-lock persist failures are not retried', async (t) => {
  let n = 0;
  const h = await harness({ crawlDateService: { persistDate: async () => { n += 1; throw new Error('boom'); } } }); t.after(h.close);
  await h.call('POST', MATCHES, { body: { body: b64 } });
  assert.equal(n, 1);
});

test('candidates validate date and query one local day', async (t) => {
  const h = await harness(); t.after(h.close);
  assert.equal((await h.call('GET', '/queue/ext/odds/candidates?date=bad')).status, 400);
  const missing = await h.call('GET', '/queue/ext/odds/candidates');
  assert.equal(missing.status, 400);
  assert.equal(missing.json.message, 'AISCORE_INVALID_BODY');
  const r = await h.call('GET', '/queue/ext/odds/candidates?date=20260131');
  assert.deepEqual(r.json, ['e1']);
  assert.deepEqual(h.calls.query[0].p, { from: '2026-01-31 00:00:00', to: '2026-02-01 00:00:00' });
});

test('routing: context path, unknown route, wrong method', async (t) => {
  const h = await harness(); t.after(h.close);
  assert.equal((await h.call('POST', '/ext/dates/20260101/matches', { body: {} })).status, 404);
  assert.equal((await h.call('GET', '/queue/nope')).status, 404);
  assert.equal((await h.call('GET', '/queue/predict/url')).status, 405);
});

test('predict endpoints: recrawlOdd param, domain errors', async (t) => {
  const h = await harness(); t.after(h.close);
  assert.deepEqual((await h.call('POST', '/queue/predict/events/9?recrawlOdd=true')).json, { eventId: 9, recrawled: true, predictions: {} });
  assert.equal((await h.call('POST', '/queue/predict/events/9')).json.recrawled, false);
  assert.equal((await h.call('POST', '/queue/predict/events/abc')).status, 400);
  assert.equal((await h.call('POST', '/queue/predict/events/9?recrawlOdd=maybe')).status, 400);
  assert.deepEqual((await h.call('POST', '/queue/predict/url', { body: { url: 'u' } })).json, { url: 'u' });
  const nf = await harness({ onDemandPredict: { predict: async () => { throw BusinessException.notFound('Event not found: 1'); } } });
  const r = await nf.call('POST', '/queue/predict/events/1');
  assert.deepEqual([r.status, r.json], [404, { error: 'Not Found', message: 'Event not found: 1' }]);
  await nf.close();
  const boom = await harness({ onDemandPredict: { predict: async () => { throw new Error('select * from secret'); } } });
  const b = await boom.call('POST', '/queue/predict/events/1');
  assert.deepEqual([b.status, b.json.message], [500, 'Unexpected error']);
  await boom.close();
});

// ---- OnDemandPredictServiceTest port ----
test('on-demand predict: no recrawl runs all three versions', async () => {
  const computed = [];
  const engine = { compute: async (id) => { computed.push(id); return { status: 'completed' }; } };
  let recrawled = false;
  const svc = createOnDemandPredictService({
    crawlEventService: { recrawlOdds: async () => { recrawled = true; } },
    registry: { findEngine: () => engine },
    support: { loadTargetOdds: async () => ({}), buildSkippedResult: (m) => ({ status: 'skipped', m }) },
  });
  const r = await svc.predict(100, false);
  assert.deepEqual([r.eventId, r.recrawled, Object.keys(r.predictions)], [100, false, ['NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE']]);
  assert.equal(computed.length, 3);
  assert.equal(recrawled, false);
});

test('on-demand predict: recrawl first and no odds load; not found otherwise; missing engine skipped', async () => {
  let loads = 0;
  const order = [];
  const support = { loadTargetOdds: async () => { loads += 1; return null; }, buildSkippedResult: (m) => ({ status: 'skipped', m }) };
  const svc = createOnDemandPredictService({
    crawlEventService: { recrawlOdds: async () => { order.push('recrawl'); } },
    registry: { findEngine: (c) => (c === 'NO_PRICE' ? null : { compute: async () => { order.push('compute'); return { status: 'ok' }; } }) },
    support,
  });
  const r = await svc.predict(200, true);
  assert.deepEqual(order, ['recrawl', 'compute', 'compute']);
  assert.equal(loads, 0);
  assert.equal(r.predictions.NO_PRICE.m, 'No prediction engine registered for version: NO_PRICE');
  await assert.rejects(svc.predict(999, false), (e) => e.status === 404 && /Event not found/.test(e.message));
});

// ---- OnDemandUrlPredictServiceTest port ----
const crawlResponse = () => ({
  matchId: 'match123',
  odds: [
    { type: 'open', market: 'hdc', line: '0#0', priceA: '1.90', priceB: '1.95' },
    { type: 'pre-match', market: 'hdc', line: '-0.5#+0.5', priceA: '1.88', priceB: '2.00' },
    { type: 'open', market: 'ou', line: '2.5', priceA: '1.87', priceB: '1.93' },
    { type: 'pre-match', market: 'ou', line: '2.75', priceA: '1.91', priceB: '1.89' },
    { type: 'open', market: 'corner', line: '9.5', priceA: '1.90', priceB: '1.90' },
    { type: 'pre-match', market: 'corner', line: '10.0', priceA: '1.92', priceB: '1.88' },
    { type: 'half-time', market: 'hdc', line: '0#0', priceA: '1.80', priceB: '2.10' },
  ],
});

test('url predict: unknown url returns odds, league version skipped with message', async () => {
  const targets = [];
  const engine = { compute: async (o) => { targets.push(o); return { status: 'completed' }; } };
  const reg = createEngineRegistry({ db: {} });
  const registry = { findEngine: (c) => (c === 'WITH_LEAGUE_NO_PRICE' ? reg.findEngine(c) : engine) };
  const svc = createOnDemandUrlPredictService({ eventCrawler: { crawlEvent: async (m, row) => { assert.equal(row.eventId, -1); assert.equal(row.hasOddsCorner, true); return crawlResponse(); } }, registry, db: { query: async () => [] } });
  const r = await svc.predict({ url: 'https://www.aiscore.com/match/foo/match123?x=1' });
  assert.equal(r.matchId, 'match123');
  assert.equal(r.eventId, null);
  assert.equal(r.odds.hdc.open.line, '0#0');
  assert.equal(r.odds.ou.preMatch.priceA, '1.91');
  assert.equal(r.odds.corner.open.line, '9.5');
  assert.equal(r.predictions.WITH_LEAGUE_NO_PRICE.status, 'skipped');
  assert.equal(r.predictions.WITH_LEAGUE_NO_PRICE.errorMessage, 'Missing league_id on event');
  assert.equal(targets.length, 2);
  assert.equal(targets[0].prematchOuPriceA, '1.91');
});

test('url predict: existing event enriches eventId and leagueId on all targets', async () => {
  const targets = [];
  const engine = { compute: async (o) => { targets.push(o); return { status: 'completed' }; } };
  const svc = createOnDemandUrlPredictService({ eventCrawler: { crawlEvent: async () => crawlResponse() }, registry: { findEngine: () => engine }, db: { query: async () => [{ event_id: 123, league_id: 456 }] } });
  const r = await svc.predict({ url: 'https://www.aiscore.com/match/foo/match123' });
  assert.equal(r.eventId, 123);
  assert.equal(targets.length, 3);
  for (const t of targets) assert.deepEqual([t.eventId, t.leagueId], [123, 456]);
});

test('url predict: lookup params, null league_id, invalid prices map to null', async () => {
  const targets = [];
  const calls = [];
  const engine = { compute: async (o) => { targets.push(o); return { status: 'completed' }; } };
  const reg = createEngineRegistry({ db: {} });
  const registry = { findEngine: (c) => (c === 'WITH_LEAGUE_NO_PRICE' ? reg.findEngine(c) : engine) };
  const crawl = crawlResponse();
  crawl.odds[0] = { ...crawl.odds[0], priceA: 'abc', priceB: ' 1.95' };
  crawl.odds[2] = { ...crawl.odds[2], priceA: 'NaN', priceB: '0x1F' };
  const db = { query: async (sql, params) => { calls.push(params); return [{ event_id: 7, league_id: null }]; } };
  const svc = createOnDemandUrlPredictService({ eventCrawler: { crawlEvent: async () => crawl }, registry, db });
  const r = await svc.predict({ url: '  https://www.aiscore.com/match/foo/match123  ' });
  assert.deepEqual(calls, [{ url: 'https://www.aiscore.com/match/foo/match123', match_id: 'match123' }]);
  assert.equal(r.eventId, 7);
  assert.equal(r.predictions.WITH_LEAGUE_NO_PRICE.status, 'skipped');
  assert.equal(targets.length, 2);
  for (const t of targets) {
    assert.deepEqual([t.eventId, t.leagueId], [7, null]);
    assert.deepEqual([t.openHdcPriceA, t.openHdcPriceB, t.openOuPriceA, t.openOuPriceB], [null, null, null, null]);
    assert.equal(t.prematchOuPriceA, '1.91');
  }
});

test('url predict: empty crawl, empty url, unparsable id', async () => {
  const mk = (crawl) => createOnDemandUrlPredictService({ eventCrawler: { crawlEvent: async () => crawl }, registry: { findEngine: () => { throw new Error('must not be called'); } }, db: { query: async () => [] } });
  await assert.rejects(mk({ matchId: null, odds: [] }).predict({ url: 'https://x/match/m1' }), /Empty odds crawl response/);
  await assert.rejects(mk(null).predict({ url: '  ' }), /url is required/);
  await assert.rejects(mk(null).predict(null), /url is required/);
  await assert.rejects(mk(null).predict({ url: 'nomatch' }), /Cannot parse matchId/);
  assert.equal(extractMatchId('https://a/b/c/?q=1#f'), 'c');
  assert.equal(extractMatchId('nomatch'), null);
});

// ---- PredictServiceTest port ----
const active = [{ predictionVersionId: 1, code: 'NO_PRICE' }, { predictionVersionId: 2, code: 'WITH_PRICE' }, { predictionVersionId: 3, code: 'WITH_LEAGUE_NO_PRICE' }];
function predictHarness(engines) {
  const log = [];
  const registry = { findEngine: (c) => (engines.includes(c) ? { predict: async (e, v) => { log.push([c, e, v]); } } : null) };
  const support = { deleteEventIfNoCurrentPredictionRows: async (e) => { log.push(['cleanup', e]); } };
  return { log, svc: createPredictService({ versionCache: { getActiveVersions: async () => active }, registry, support }) };
}

test('full job runs active versions in id order then cleans up', async () => {
  const h = predictHarness(['NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE']);
  await h.svc.predict('123');
  assert.deepEqual(h.log, [['NO_PRICE', 123, 1], ['WITH_PRICE', 123, 2], ['WITH_LEAGUE_NO_PRICE', 123, 3], ['cleanup', 123]]);
});

test('single-version job does not clean up', async () => {
  const h = predictHarness(['NO_PRICE']);
  await h.svc.predict('{"eventId":123,"versionCode":"NO_PRICE"}');
  assert.deepEqual(h.log, [['NO_PRICE', 123, 1]]);
});

test('full job with a missing engine still runs the rest and cleans up', async () => {
  const h = predictHarness(['WITH_PRICE', 'WITH_LEAGUE_NO_PRICE']);
  await h.svc.predict('123');
  assert.deepEqual(h.log, [['WITH_PRICE', 123, 2], ['WITH_LEAGUE_NO_PRICE', 123, 3], ['cleanup', 123]]);
});

test('unusable payloads do nothing; deprecated codes have no engine', async () => {
  const h = predictHarness(['NO_PRICE']);
  for (const p of [null, '', '  ', 'abc', '{"eventId":"x"}', '{bad', '{"versionCode":"NO_PRICE"}']) await h.svc.predict(p);
  await h.svc.predict('{"eventId":5,"versionCode":"base_data"}');
  assert.deepEqual(h.log, []);
});

test('parseJob / parseSettleEventId', () => {
  assert.deepEqual(parseJob(' 42 '), { eventId: 42, versionCode: null });
  assert.deepEqual(parseJob('{"eventId":"7","versionCode":"WITH_PRICE","extra":1}'), { eventId: 7, versionCode: 'WITH_PRICE' });
  assert.equal(parseJob('x').eventId, null);
  assert.equal(parseJob('99999999999999999999').eventId, null);
  assert.equal(parseJob('{"eventId":"12345678901234567890"}').eventId, null);
  assert.equal(parseSettleEventId('{"eventId":9}'), 9);
  assert.equal(parseSettleEventId('9'), 9);
  assert.equal(parseSettleEventId('{"eventId":"z"}'), null);
  assert.equal(parseSettleEventId(''), null);
  assert.equal(parseSettleEventId('nine'), null);
});
