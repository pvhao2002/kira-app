import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import protobuf from 'protobufjs';
import { decodeMatches, decodeMatchOdds, decodeMatchOddsDetail } from '../src/protobuf.js';

// No captured AiScore fixture is available offline: bytes are built by encoding with protobufjs from the
// same protobuf.json. Gap: wire-format drift on the live API is only caught by runtime QA.
const root = protobuf.Root.fromJSON(JSON.parse(fs.readFileSync(new URL('../src/protobuf.json', import.meta.url), 'utf8')));
const enc = (name, obj) => {
  const t = root.lookupType(`onescore.app.v1.${name}`);
  return Buffer.from(t.encode(t.fromObject(obj)).finish());
};
const wrap = (inner) => enc('Response', { code: 200, data: inner });

const matches = {
  competitions: [{ id: 'c1', name: 'Premier League', logo: 'l.png', country: { name: 'England', iso: 'ENG' }, hasStats: 1 }],
  teams: [{ id: 't1', name: 'Home FC' }, { id: 't2', name: 'Away FC' }],
  matches: [{
    id: 'm1', competition: { id: 'c1' }, homeTeam: { id: 't1' }, awayTeam: { id: 't2' },
    matchTime: 1767000000, statusId: 8, homeScores: [2, 1, 0, 0, 5], awayScores: [1, 0],
    ext: { odds: { oddItems: [{ odd: ['1.9', '0.5', '1.95'] }] } },
  }],
};

test('decodeMatches: plain body, key fields used by mappers', () => {
  const d = decodeMatches(enc('Matches', matches));
  assert.equal(d.matches[0].id, 'm1');
  assert.equal(d.matches[0].statusId, 8);
  assert.deepEqual(d.matches[0].homeScores, [2, 1, 0, 0, 5]);
  assert.equal(d.competitions[0].country.iso, 'ENG');
  assert.equal(d.teams[1].name, 'Away FC');
  assert.deepEqual(d.matches[0].ext.odds.oddItems[0].odd, ['1.9', '0.5', '1.95']);
});

test('decodeMatches: unset fields absent (no defaults)', () => {
  const d = decodeMatches(enc('Matches', { matches: [{ id: 'x' }] }));
  assert.equal(d.matches[0].statusId, undefined);
  assert.equal(d.competitions, undefined);
});

test('decodeMatches: Response wrapper and gzip are unwrapped', () => {
  const inner = enc('Matches', matches);
  assert.equal(decodeMatches(wrap(inner)).matches[0].id, 'm1');
  assert.equal(decodeMatches(zlib.gzipSync(wrap(inner))).matches[0].id, 'm1');
  assert.equal(decodeMatches(zlib.gzipSync(inner)).matches[0].id, 'm1');
});

test('decodeMatchOdds / Detail: empty body is null, content decodes', () => {
  assert.equal(decodeMatchOdds(Buffer.alloc(0)), null);
  assert.equal(decodeMatchOdds(null), null);
  assert.equal(decodeMatchOddsDetail(Buffer.alloc(0)), null);
  const odds = decodeMatchOdds(wrap(enc('MatchOdds', { companies: [{ id: 2, name: 'Bet365' }] })));
  assert.equal(odds.companies[0].name, 'Bet365');
  const detail = decodeMatchOddsDetail(enc('MatchOddsDetail', { oddsDetail: [{ details: [{ d: '0.5', w: '1.9', l: '1.9' }] }] }));
  assert.equal(detail.oddsDetail[0].details[0].d, '0.5');
});

// Java JSON parity: bytes come out as base64 text. (No int64 field is reachable from the decoded types today,
// so longs: String has no observable effect yet; Message.time is top-level only.)
test('decodeMatches: bytes field is base64 text', () => {
  const d = decodeMatches(enc('Matches', { matches: [{ id: 'm1', extra: Buffer.from('hi') }] }));
  assert.equal(d.matches[0].extra, Buffer.from('hi').toString('base64'));
});

// protobuf.json is a copy of kira-queue's schema; fail on drift while v1 still exists.
test('protobuf.json matches kira-queue copy', (t) => {
  const v1 = new URL('../../kira-queue/src/main/resources/protobuf.json', import.meta.url);
  if (!fs.existsSync(v1)) return t.skip('kira-queue copy not present');
  assert.ok(fs.readFileSync(v1).equals(fs.readFileSync(new URL('../src/protobuf.json', import.meta.url))));
});

test('garbage bytes raise AiscoreBadGatewayException', () => {
  assert.throws(() => decodeMatches(Buffer.from([0xff, 0xff, 0xff])), { name: 'AiscoreBadGatewayException' });
});
