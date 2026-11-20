import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDatabaseEvent, mapResultForDatabase, toGmt7DateTime, MatchStatusLabelCache } from '../src/mapper/match.js';
import {
  hasBet365Company, mapOddsListForDatabase, mapOddsTimelineForDatabase, groupOddsTimelineForResponse,
} from '../src/mapper/odds.js';

const decoded = {
  competitions: [{ id: 'c1', name: 'Premier League', logo: 'pl.png', country: { name: 'England', iso: 'ENG' }, hasStats: 1, sportId: 1 }],
  teams: [{ id: 't1', name: 'Home FC', slug: 'home-fc' }, { id: 't2', name: 'Café Ünited & Co' }],
};
const match = {
  id: 'm1', competition: { id: 'c1' }, homeTeam: { id: 't1' }, awayTeam: { id: 't2' }, matchTime: 1767000000,
  statusId: 8, homeScores: [2, 1, 0, 3, 5], awayScores: [1, 0, 0, 2, 4],
  ext: { odds: { oddItems: [{ odd: ['1', '2'] }, { odd: ['3'] }, { odd: ['4'] }, { odd: ['', ' '] }] } },
};

test('mapDatabaseEvent maps league, teams, event, result', () => {
  const b = mapDatabaseEvent(match, decoded);
  assert.equal(b.league.leagueName, 'Premier League');
  assert.equal(b.league.logoUrl, 'https://img0.aiscore.com/football/competition/pl.png');
  assert.equal(b.league.countryCodeShort, 'ENG');
  assert.equal(b.event.externalId, 'm1');
  assert.equal(b.event.eventName, 'Home FC - Café Ünited & Co');
  assert.equal(b.event.status, 'FT');
  assert.equal(b.event.eventDate, '2025-12-29T16:20:00+07:00');
  assert.equal(b.event.link, 'https://www.aiscore.com/match-home-fc-cafe-united-and-co/m1');
  assert.equal(b.event.hasOdds, true); // 3 valid items
  assert.equal(b.event.hasOddsCorner, false);
  assert.equal(b.result.ftGoalStr, '2-1');
  assert.equal(b.result.htGoalStr, '1-0');
  assert.equal(b.result.htResult, 'H');
  assert.equal(b.result.ftHomeCorner, 5);
  assert.equal(b.result.ftAwayYellowCard, 2);
});

test('toGmt7DateTime', () => {
  assert.equal(toGmt7DateTime(0), '1970-01-01T07:00:00+07:00');
  assert.equal(toGmt7DateTime('3600'), '1970-01-01T08:00:00+07:00');
  assert.equal(toGmt7DateTime(null), null);
});

test('missing teams -> short link, status fallback, result None', () => {
  const b = mapDatabaseEvent({ id: 'x', matchStatus: 3 }, {});
  assert.equal(b.event.link, 'https://www.aiscore.com/match/x');
  assert.equal(b.event.status, '3');
  assert.equal(b.event.eventName, null);
  assert.equal(b.result.ftResult, 'None');
  assert.equal(b.event.hasOdds, false);
  assert.equal(mapDatabaseEvent({ id: 'y' }, {}).event.status, '-');
});

test('four valid odd items -> corner odds', () => {
  const m = { id: 'z', ext: { odds: { oddItems: [1, 2, 3, 4].map((n) => ({ odd: [String(n)] })) } } };
  assert.equal(mapDatabaseEvent(m, {}).event.hasOddsCorner, true);
});

test('mapResultForDatabase', () => {
  const r = mapResultForDatabase([1], []);
  assert.equal(r.ftHomeGoal, 1);
  assert.equal(r.ftAwayGoal, null);
  assert.equal(r.ftGoalStr, null);
  assert.equal(r.ftResult, 'None');
});

test('status label cache resolves and falls back', async () => {
  const cache = new MatchStatusLabelCache();
  await cache.load({ query: async () => [{ code: 8, label: 'FT' }, { code: 99, label: '' }] });
  assert.equal(cache.resolveStatus(8, 'x'), 'FT');
  assert.equal(cache.resolveStatus(99, 'x'), '-');
  assert.equal(cache.resolveStatus(5, 'abc'), 'abc');
  assert.equal(cache.resolveStatus(null, ''), '-');
});

const bet365 = { id: 2, name: 'Bet365' };
test('hasBet365Company by id or normalized name', () => {
  assert.equal(hasBet365Company({ companies: [{ id: 2 }] }), true);
  assert.equal(hasBet365Company({ companies: [{ id: 9, name: ' Bet 365 ' }] }), true);
  assert.equal(hasBet365Company({ companies: [{ id: 9, name: 'x' }] }), false);
  assert.equal(hasBet365Company({}), false);
});

test('mapOddsListForDatabase formats asian handicap and keeps strings', () => {
  const item = (f, s, l) => ({ company: bet365, f: { odd: f }, s: { odd: s }, l: l ? { odd: l } : undefined });
  const out = mapOddsListForDatabase({
    asia: [{ company: { id: 9 }, f: { odd: ['1', '9', '1'] } }, item(['1.90', '0.5', '1.95'], ['1.8', '0.25', '2.0'], ['1.7', '-1.75', '2.1'])],
    bs: [item(['1.9', '2.5', '1.9'], ['x', '2.5', '1.9'])],
    corner: [],
  });
  const hdc = out.filter((o) => o.market === 'hdc');
  assert.deepEqual(hdc.map((o) => [o.type, o.line, o.priceA, o.priceB]), [
    ['open', '-0.5#+0.5', '1.90', '1.95'],
    ['pre-match', '-0/0.5#+0/0.5', '1.8', '2.0'],
    ['half-time', '+1.5/2#-1.5/2', '1.7', '2.1'],
  ]);
  const ou = out.filter((o) => o.market === 'ou');
  assert.deepEqual(ou.map((o) => o.type), ['open']); // pre-match priceA 'x' dropped
  assert.equal(ou[0].line, '2.5');
  assert.equal(mapOddsListForDatabase({ asia: [{ company: { id: 9 } }] }).length, 0);
});

test('hdc zero line and integer line', () => {
  const r = mapOddsListForDatabase({ asia: [{ company: bet365, f: { odd: ['1', '0', '1'] }, s: { odd: ['1', '1', '1'] } }] });
  assert.equal(r[0].line, '0#0');
  assert.equal(r[1].line, '-1#+1');
});

test('timeline items map, skip invalid, group by market', () => {
  const d = (over) => ({ d: '0.5', w: '1.9', l: '1.9', time: "12'", updateTime: 1767000000, score: ' 1-0 ', statusId: 1, ...over });
  const tl = mapOddsTimelineForDatabase({
    asia: { oddsDetail: [{ details: [d({}), d({ w: 'bad' })] }] },
    eu: null,
    bs: { oddsDetail: [{ details: [d({ d: '2.5' })] }] },
    corner: null,
  });
  assert.equal(tl.length, 2);
  assert.equal(tl[0].market, 'hdc');
  assert.equal(tl[0].score, '1-0');
  assert.equal(tl[0].matchMinute, "12'");
  assert.match(tl[0].crawledAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+07:00$/);
  assert.equal(tl[1].line, '2.5');
  const g = groupOddsTimelineForResponse(tl);
  assert.deepEqual([g.hdc.length, g.ou.length, g.corner.length], [1, 1, 0]);
  assert.deepEqual(mapOddsTimelineForDatabase({ asia: null, eu: null, bs: {}, corner: null }), []);
});

test('timeline hdc sign, quarter split, invalid line, missing updateTime', () => {
  const row = (over) => ({ d: '0.5', w: '1.9', l: '1.9', updateTime: 1767000000, ...over });
  const hdc = (over) => mapOddsTimelineForDatabase({ asia: { oddsDetail: [{ details: [row(over)] }] } });
  for (const [over, line] of [[{ d: '-0.75' }, '+0.5/1#-0.5/1'], [{ d: '0' }, '0#0']]) {
    assert.equal(hdc(over)[0].line, line);
  }
  assert.deepEqual(hdc({ d: 'x' }), []);
  assert.equal(hdc({ updateTime: undefined })[0].crawledAt, null);
});
