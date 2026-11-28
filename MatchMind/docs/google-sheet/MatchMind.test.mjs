// Runs MatchMind.gs against fake Google services: node --test MatchMind/docs/google-sheet/MatchMind.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('./MatchMind.gs', import.meta.url), 'utf8');
const BASE = 'https://match.kira.id.vn';
const HEADER = ['label', 'path', 'provider', 'model', 'modelVersion', 'body', 'status', 'processedAt'];
const SETTLE_HEADER = ['matchId', 'provider', 'league', 'homeTeam', 'awayTeam', 'kickoffGmt7', 'status', 'homeScore',
  'awayScore', 'homeCorners', 'awayCorners', 'htHomeScore', 'htAwayScore', 'source', 'sync', 'syncedAt'];
const GOALS_HEADER = ['league', 'homeTeam', 'awayTeam', 'kickoffGmt7', 'provider', 'model', 'promptVersion',
  'ngHomeOdds', 'ngNoGoalOdds', 'ngAwayOdds', 'bttsYesOdds', 'bttsNoOdds', 'lambdaHome', 'lambdaAway', 'simulations',
  'pNgHome', 'pNgNoGoal', 'pNgAway', 'pBttsYes', 'ngPick', 'bttsPick', 'notes', 'firstGoal', 'homeScore', 'awayScore',
  'resultSource', 'ngResult', 'bttsResult', 'settledAt'];

/**
 * Loads the script over a MatchMind tab holding `rows` below the header. The server gives `answers` in order: {code,
 * body} for JSON, {code, text} for anything else, or an Error for no connection. `after(grid)` edits the sheet while the
 * request is out, as the user could during a run.
 */
/** `key`: the MATCHMIND_API_KEY value, or an object holding every script property. */
function load(rows, answers, key = 'agent-key') {
  const grid = [HEADER, ...rows.map(r => Array.from({ length: HEADER.length }, (_, i) => r[i] ?? ''))];
  const calls = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => grid.map(r => [...r]) }),
    deleteRows: (row, count) => grid.splice(row - 1, count),
    getRange: (row, col, height = 1, width = 1) => ({
      getValues: () => [Array.from({ length: width }, (_, i) => grid[row - 1]?.[col - 1 + i] ?? '')],
      setValues: values => values[0].forEach((v, i) => { grid[row - 1][col - 1 + i] = v; }),
      getValue: () => grid[row - 1]?.[col - 1] ?? '',
      setValue: v => { (grid[row - 1] ??= Array(HEADER.length).fill(''))[col - 1] = v; },
    }),
  };
  const google = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: n => (n === 'MatchMind' ? sheet : null) }), flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: n => (key && typeof key === 'object' ? key[n] ?? null : n === 'MATCHMIND_API_KEY' ? key : null) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: {
      fetch(url, options) {
        calls.push({ url, ...JSON.parse(JSON.stringify(options)) }); // plain objects of this realm
        const answer = answers.shift();
        if (answer instanceof Error) throw answer;
        answer.after?.(grid);
        return { getResponseCode: () => answer.code, getContentText: () => answer.text ?? JSON.stringify(answer.body ?? {}) };
      },
    },
  };
  vm.runInNewContext(SOURCE, google);
  return { cleanupOldRows: () => google.cleanupOldRows(), sendPending: () => google.sendPending(), status: row => grid[row][6], grid, calls };
}

const prediction = ["Arsenal vs Chelsea - LIVE 63'", '/api/v1/external/predictions', 'meta', 'llama-4', '4.1', '{"a":1}', ''];
const settle = ['Arsenal vs Chelsea - settle', '/api/v1/external/predictions/settle', 'meta', '', '', '{"b":2}', ''];
const marked = status => [...prediction.slice(0, 6), status];

test('sends new and retry rows with the agent headers, and skips the rest', () => {
  const s = load([prediction, marked('sent 201'), marked('rejected 400 VALIDATION_ERROR: Invalid request'),
    ['no body yet', '/api/v1/external/predictions', 'meta', 'llama-4', '', '', ''], marked('retry 503'), settle],
  [{ code: 201 }, { code: 200, body: { duplicate: true } }, { code: 201 }]);
  s.sendPending();
  assert.deepEqual(s.grid.slice(1).map(r => r[6]),
    ['sent 201', 'sent 201', 'rejected 400 VALIDATION_ERROR: Invalid request', '', 'sent 200 (already received)', 'sent 201']);
  assert.equal(s.calls.length, 3);
  const [first, , last] = s.calls;
  assert.equal(first.url, BASE + '/api/v1/external/predictions');
  assert.deepEqual(first.headers,
    { 'X-Api-Key': 'agent-key', 'X-Provider': 'meta', 'X-Model-Name': 'llama-4', 'X-Model-Version': '4.1' });
  assert.equal(first.payload, '{"a":1}');
  // A 4xx must come back as an answer, not as "cannot reach"; a redirect must not carry the key to another host; a host
  // that hangs must not use up the day's trigger time.
  assert.deepEqual([first.method, first.contentType, first.muteHttpExceptions, first.followRedirects, first.timeoutSeconds],
    ['post', 'application/json; charset=utf-8', true, false, 30]); // team names such as Atlético stay intact
  assert.equal(last.url, BASE + '/api/v1/external/predictions/settle');
  assert.deepEqual(last.headers, { 'X-Api-Key': 'agent-key', 'X-Provider': 'meta' });
});

test('never sends a row whose path leaves the external API', () => {
  const s = load([['steal', '@evil.example/x', 'meta', '', '', '{}', '']], []);
  s.sendPending();
  assert.match(s.status(1), /^rejected/);
  assert.equal(s.calls.length, 0);
});

test('rejects client errors, then stops at a wrong key', () => {
  const s = load([prediction, settle, prediction], [
    { code: 400, body: { code: 'VALIDATION_ERROR', message: 'Invalid request', fieldErrors: { odds: 'must not be empty' } } },
    { code: 401, body: { code: 'INVALID_API_KEY', message: 'Invalid API key' } }]);
  s.sendPending();
  assert.equal(s.status(1), 'rejected 400 VALIDATION_ERROR: Invalid request {"odds":"must not be empty"}');
  assert.match(s.status(2), /^retry 401 INVALID_API_KEY: Invalid API key/);
  assert.equal(s.status(3), '');
  assert.equal(s.calls.length, 2);
});

test('waits for the next run when the server is busy or unreachable', () => {
  const busy = load([prediction, settle], [{ code: 503 }]);
  busy.sendPending();
  assert.equal(busy.status(1), 'retry 503');
  assert.equal(busy.status(2), '');
  const offline = load([prediction, settle], [new Error('DNS error')]);
  offline.sendPending();
  assert.equal(offline.status(1), 'retry: cannot reach ' + BASE);
  assert.equal(offline.calls.length, 1);
});

test('retries answers that did not come from MatchMind, and goes on past a server error on one row', () => {
  for (const answer of [{ code: 302, text: '' }, { code: 403, text: '<html>Access denied</html>' }]) {
    const s = load([prediction, settle], [answer]);
    s.sendPending();
    assert.equal(s.status(1), 'retry ' + answer.code); // a redirect, a proxy or a firewall: no verdict on the row
    assert.equal(s.status(2), '');
  }
  const s = load([prediction, settle, prediction], [
    { code: 500, body: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { code: 409, body: { code: 'CONCURRENT_UPDATE', message: 'The record was changed by someone else; reload it' } },
    { code: 201 }]);
  s.sendPending();
  assert.equal(s.status(1), 'retry 500 INTERNAL_ERROR: Unexpected server error');
  assert.equal(s.status(2), 'retry 409 CONCURRENT_UPDATE: The record was changed by someone else; reload it');
  assert.equal(s.status(3), 'sent 201');
});

test('stops without writing when rows move during the run', () => {
  // The user deletes an old row while the settle row is out: every row below it moves up by one.
  const s = load([marked('sent 201'), settle, prediction],
    [{ code: 201, after: grid => grid.splice(1, 1) }, { code: 503 }]);
  s.sendPending();
  assert.deepEqual(s.grid.slice(1).map(r => r[6]), ['', '']); // no status lands on the wrong row
  assert.equal(s.calls.length, 1);
});

test('leaves a row for the next run when its provider has no key', () => {
  const s = load([prediction], [], null);
  s.sendPending();
  assert.match(s.status(1), /^retry: add the script property MATCHMIND_KEY_META or MATCHMIND_API_KEY/);
  assert.equal(s.calls.length, 0);
});

const gpt = ['Arsenal vs Chelsea - GPT', '/api/v1/external/predictions', 'openai-gpt', 'gpt-5', '', '{"c":3}', ''];

test('sends each row with the key of its provider, falling back to MATCHMIND_API_KEY', () => {
  const s = load([prediction, gpt], [{ code: 201 }, { code: 201 }],
    { MATCHMIND_API_KEY: 'shared', MATCHMIND_KEY_OPENAI_GPT: 'mmk_gpt' });
  s.sendPending();
  assert.deepEqual(s.calls.map(c => [c.headers['X-Api-Key'], c.headers['X-Provider']]),
    [['shared', 'meta'], ['mmk_gpt', 'openai-gpt']]);
  assert.deepEqual([s.status(1), s.status(2)], ['sent 201', 'sent 201']);
});

test('a wrong key holds back only the rows of that key, the other providers still go out', () => {
  const s = load([gpt, prediction, gpt], [{ code: 401, body: { code: 'INVALID_API_KEY', message: 'Invalid API key' } }, { code: 201 }],
    { MATCHMIND_KEY_META: 'mmk_meta', MATCHMIND_KEY_OPENAI_GPT: 'mmk_old' });
  s.sendPending();
  assert.match(s.status(1), /^retry 401 INVALID_API_KEY: Invalid API key - check the MATCHMIND_KEY_OPENAI_GPT script property/);
  assert.equal(s.status(2), 'sent 201');
  assert.equal(s.status(3), '');
  assert.equal(s.calls.length, 2);
});

test('setup makes a plain-text MatchMind tab and one sender and one cleanup trigger, for this spreadsheet only', () => {
  assert.match(SOURCE, /^\/\*\* @OnlyCurrentDoc \*\//); // the owner's trigger may open no other spreadsheet
  const log = [];
  const range = at => ({ setValues: v => log.push(['values', at, v]), setNumberFormat: f => log.push(['format', at, f]) });
  const sheet = { getRange: (...at) => range(at.join(',')), setFrozenRows: n => log.push(['frozen', n]) };
  const google = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: () => null, insertSheet: (n, i) => (log.push(['insert', n, i]), sheet) }) },
    ScriptApp: {
      getProjectTriggers: () => [{ getHandlerFunction: () => 'sendPending' }, { getHandlerFunction: () => 'cleanupOldRows' },
        { getHandlerFunction: () => 'other' }, { getHandlerFunction: () => 'pullUnsettled' },
        { getHandlerFunction: () => 'goalsReport' }],
      deleteTrigger: t => log.push(['delete', t.getHandlerFunction()]),
      newTrigger: f => ({ timeBased: () => ({
        everyMinutes: m => ({ create: () => log.push(['trigger', f, m]) }),
        everyHours: h => ({ create: () => log.push(['hourly', f, h]) }),
      }) }),
    },
  };
  vm.runInNewContext(SOURCE, google);
  google.setup();
  assert.deepEqual(JSON.parse(JSON.stringify(log)), [
    ['insert', 'MatchMind', 0],
    ['values', '1,1,1,8', [HEADER]],
    ['format', 'A:H', '@'], // plain text: Sheets would turn a version such as 2024-08-06 or 4.10 into a date or a number
    ['frozen', 1],
    ['insert', 'SETTLE', null],
    ['values', '1,1,1,16', [SETTLE_HEADER]],
    ['format', 'A:P', '@'],
    ['frozen', 1],
    ['insert', 'ACCOUNT', null],
    ['values', '1,1,1,4', [['importId', 'transactions', 'sync', 'syncedAt']]],
    ['format', 'A:D', '@'],
    ['frozen', 1],
    ['insert', 'GOALS', null],
    ['values', '1,1,1,29', [GOALS_HEADER]],
    ['format', 'A:AC', '@'], // odds stay as typed: Sheets would read 1.90 as a number and a kick-off as a date
    ['frozen', 1],
    ['insert', 'GOALS_REPORT', null],
    ['format', 'A:J', '@'], // "+3.00" and "83%" stay as written instead of becoming numbers
    ['delete', 'sendPending'],
    ['delete', 'cleanupOldRows'],
    ['delete', 'pullUnsettled'],
    ['delete', 'goalsReport'],
    ['trigger', 'sendPending', 1],
    ['hourly', 'cleanupOldRows', 1],
    ['hourly', 'pullUnsettled', 1],
    ['hourly', 'goalsReport', 1],
  ]);
});


test('records a timestamp only for successful requests', () => {
  const s = load([prediction, settle], [{ code: 201 }, { code: 400, body: { code: 'VALIDATION_ERROR' } }]);
  s.sendPending();
  assert.ok(Number.isFinite(Date.parse(s.grid[1][7])));
  assert.equal(s.grid[2][7], '');
});

test('cleanup deletes only sent rows older than 48 hours and timestamps legacy rows', () => {
  const old = new Date(Date.now() - 49 * 3600000).toISOString();
  const recent = new Date(Date.now() - 47 * 3600000).toISOString();
  const s = load([
    [...marked('sent 201'), old],
    [...marked('sent 200 (already received)'), old],
    [...marked('sent 200'), recent],
    [...marked('retry 500'), old],
    [...marked('rejected 400'), old],
    prediction,
    marked('sent 201'),
  ], []);
  s.cleanupOldRows();
  assert.deepEqual(s.grid.slice(1).map(r => r[6]), ['sent 200', 'retry 500', 'rejected 400', '', 'sent 201']);
  assert.ok(Date.parse(s.grid[5][7]) > Date.parse(recent));
  s.cleanupOldRows();
  assert.equal(s.grid.length, 6);
  assert.equal(s.calls.length, 0);
});

/** The SETTLE tab with `rows` below its header, a results key, and the MatchMind tab empty. */
function loadSettle(rows, answers, resultsKey = 'mmk_sheet_secret') {
  const tabs = { MatchMind: [HEADER], SETTLE: [SETTLE_HEADER, ...rows.map(r => [...r])] };
  const calls = [];
  const sheetOf = grid => ({
    getDataRange: () => ({ getValues: () => grid.map(r => [...r]) }),
    getLastRow: () => grid.length,
    clearContents: () => { grid.length = 0; },
    deleteRows: (row, count) => grid.splice(row - 1, count),
    getRange: (row, col, height = 1, width = 1) => ({
      getValues: () => [Array.from({ length: width }, (_, i) => grid[row - 1]?.[col - 1 + i] ?? '')],
      getValue: () => grid[row - 1]?.[col - 1] ?? '',
      setValue: v => { (grid[row - 1] ??= Array(SETTLE_HEADER.length).fill(''))[col - 1] = v; },
      setValues: values => values.forEach((v, i) => v.forEach((x, j) => {
        (grid[row - 1 + i] ??= Array(SETTLE_HEADER.length).fill(''))[col - 1 + j] = x;
      })),
    }),
  });
  const props = { MATCHMIND_API_KEY: 'agent-key', MATCHMIND_RESULTS_KEY: resultsKey };
  const google = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: n => (tabs[n] ? sheetOf(tabs[n]) : null) }), flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: n => props[n] ?? null }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: { formatDate: (d, tz, f) => tz + '|' + f + '|' + d.toISOString() },
    UrlFetchApp: {
      fetch(url, options) {
        calls.push({ url, ...JSON.parse(JSON.stringify(options)) });
        const answer = answers.shift();
        return { getResponseCode: () => answer.code, getContentText: () => answer.text ?? JSON.stringify(answer.body ?? {}) };
      },
    },
  };
  vm.runInNewContext(SOURCE, google);
  return { google, tabs, props, tab: tabs.SETTLE, calls, sync: row => tabs.SETTLE[row][14] };
}

test('ACCOUNT sends one batch per image and keeps sent rows idempotent', () => {
  const s = loadSettle([], [{ code: 200 }]);
  const tx = [{ reference: 'dep1', type: 'CREDIT', status: 'SUCCESS', amount: 120, occurredAt: '2026-11-24T10:00:00+07:00' }];
  s.tabs.ACCOUNT = [['importId', 'transactions', 'sync', 'syncedAt'],
    ['bad', '{', '', ''], ['image1', JSON.stringify(tx), '', '']];
  s.google.sendPending();
  s.google.sendPending();
  assert.match(s.tabs.ACCOUNT[1][2], /^rejected/);
  assert.equal(s.tabs.ACCOUNT[2][2], 'sent 200');
  assert.ok(Date.parse(s.tabs.ACCOUNT[2][3]));
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, BASE + '/api/v1/external/account/transactions');
  assert.deepEqual(s.calls[0].headers, { 'X-Api-Key': 'agent-key', 'X-Provider': 'sheet' });
  assert.deepEqual(JSON.parse(s.calls[0].payload), { importId: 'image1', transactions: tx });
});

test('ACCOUNT uses its scoped key without overriding the provider identity', () => {
  const s = loadSettle([], [{ code: 200 }]);
  s.props.MATCHMIND_ACCOUNT_KEY = 'mmk_trusted';
  s.tabs.ACCOUNT = [['importId', 'transactions', 'sync', 'syncedAt'], ['image2', '[{}]', '', '']];
  s.google.sendPending();
  assert.deepEqual(s.calls[0].headers, { 'X-Api-Key': 'mmk_trusted' });
});

const open = (id, status = '', home = '', away = '', extra = []) =>
  [id, 'meta-ai', 'Myanmar League', 'FC Chinland', 'Ayeyawady', '2026-11-23 16:30', status, home, away, ...extra];
const pad = r => [...r, ...Array(SETTLE_HEADER.length - r.length).fill('')];

test('pullUnsettled adds only the matches that are not in the SETTLE tab yet, with the kick-off in GMT+7', () => {
  const s = loadSettle([pad(open('m1'))], [{ code: 200, body: [
    { matchId: 'm1', provider: 'meta-ai', homeTeam: 'FC Chinland', awayTeam: 'Ayeyawady', startTime: '2026-11-23T09:30:00Z' },
    { matchId: 'm2', provider: 'codex', league: null, homeTeam: 'Arsenal', awayTeam: 'Chelsea', startTime: '2026-11-22T19:45:00Z' },
  ] }]);
  assert.equal(s.google.pullUnsettled(), 1);
  assert.deepEqual(s.tab.map(r => r[0]), ['matchId', 'm1', 'm2']);
  assert.deepEqual(s.tab[2].slice(0, 6),
    ['m2', 'codex', '', 'Arsenal', 'Chelsea', 'Asia/Ho_Chi_Minh|yyyy-MM-dd HH:mm|2026-11-22T19:45:00.000Z']);
  assert.equal(s.tab[2].length, SETTLE_HEADER.length);
  assert.equal(s.calls[0].url, BASE + '/api/v1/external/matches/unsettled');
  assert.deepEqual([s.calls[0].method, s.calls[0].headers, s.calls[0].followRedirects],
    ['get', { 'X-Api-Key': 'mmk_sheet_secret' }, false]);
});

test('pullUnsettled needs the results key and a 200 answer', () => {
  assert.throws(() => loadSettle([], [], null).google.pullUnsettled(), /MATCHMIND_RESULTS_KEY/);
  assert.throws(() => loadSettle([], [{ code: 403, body: { code: 'SCOPE_REQUIRED' } }]).google.pullUnsettled(), /403/);
});

test('sends filled SETTLE rows as match results with the results key, and checks the values first', () => {
  const s = loadSettle([
    pad(open('m1', 'finished', '2', '1', ['9', '4', '1', '0', 'https://example.org/live'])),
    pad(open('m2')),                                     // not filled in yet
    pad(open('m3', 'FINISHED')),                         // no score
    pad(open('m4', 'FINISHED', '2', 'x')),
    pad(open('m5', 'CANCELLED')),
    pad(open('m6', 'FINISHED', '1', '1', ['', '', '', '', '', 'sent 200'])),
    pad(open('m7', 'LIVE')),
  ], [{ code: 200, body: { settlement: { settled: 3, pending: 0 } } }, { code: 200, body: { settlement: { settled: 0, pending: 0 } } }]);
  s.google.sendPending();
  assert.deepEqual(s.tab.slice(1).map(r => r[14]), ['sent 200: settled 3, pending 0', '',
    'rejected: FINISHED needs homeScore and awayScore', 'rejected: finalScore needs two whole numbers',
    'sent 200: settled 0, pending 0', 'sent 200', 'rejected: status must be one of FINISHED, CANCELLED, POSTPONED']);
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[0].url, BASE + '/api/v1/external/matches/results');
  assert.deepEqual(s.calls[0].headers, { 'X-Api-Key': 'mmk_sheet_secret' });
  const body = JSON.parse(s.calls[0].payload);
  assert.deepEqual({ ...body, resultAt: undefined }, { matchId: 'm1', status: 'FINISHED', finalScore: { home: 2, away: 1 },
    finalCorners: { home: 9, away: 4 }, halfTimeScore: { home: 1, away: 0 }, resultAt: undefined });
  assert.ok(Date.parse(body.resultAt) <= Date.now());
  assert.equal(JSON.parse(s.calls[1].payload).status, 'CANCELLED');
});

test('SETTLE rows wait while the results key is missing', () => {
  const s = loadSettle([pad(open('m1', 'FINISHED', '2', '1'))], [], null);
  s.google.sendPending();
  assert.equal(s.sync(1), '');
  assert.equal(s.calls.length, 0);
});

test('SETTLE rows record syncedAt only when sent, and cleanup removes them 72 hours later', () => {
  const s = loadSettle([pad(open('m1', 'CANCELLED')), pad(open('m2', 'LIVE'))], [{ code: 200, body: {} }]);
  s.google.sendPending();
  assert.ok(Number.isFinite(Date.parse(s.tab[1][15])));
  assert.equal(s.tab[2][15], '');

  const hoursAgo = h => new Date(Date.now() - h * 3600000).toISOString();
  const synced = (id, sync, at) => [...open(id, 'FINISHED', '1', '0'), '', '', '', '', '', sync, at];
  const c = loadSettle([
    synced('old', 'sent 200', hoursAgo(73)),
    synced('recent', 'sent 200', hoursAgo(71)),
    synced('rejected', 'rejected: x', hoursAgo(100)),
    synced('legacy', 'sent 200', ''),
    pad(open('open')),
  ], []);
  c.google.cleanupOldRows();
  assert.deepEqual(c.tab.slice(1).map(r => r[0]), ['recent', 'rejected', 'legacy', 'open']);
  assert.ok(Number.isFinite(Date.parse(c.tab[3][15]))); // legacy row: kept for another 72 hours
});

// GOALS tab: Next Goal & BTTS predictions that stay in the sheet.
const goalRow = values => GOALS_HEADER.map(c => values[c] ?? '');
const goal = {
  league: 'V.League 1', homeTeam: 'Ha Noi', awayTeam: 'Hai Phong', kickoffGmt7: '2026-11-27 19:15', provider: 'chatgpt',
  model: 'gpt-5.1', promptVersion: '1', ngHomeOdds: '1.80', ngNoGoalOdds: '9.50', ngAwayOdds: '2.30', bttsYesOdds: '1.85',
  bttsNoOdds: '1.95', lambdaHome: '1.45', lambdaAway: '1.05', simulations: '1000', pNgHome: '0.540', pNgNoGoal: '0.082',
  pNgAway: '0.378', pBttsYes: '0.470', ngPick: 'HOME', bttsPick: 'NO',
};

test('goalOutcome scores the first scorer and BTTS, voids, and flags results that contradict each other', () => {
  const { google } = loadSettle([], []);
  // Spread into an array of this realm: the script's arrays come from the vm context.
  const out = (picks, result) => [...google.goalOutcome(goalRow({ ...goal, ...picks, ...result }))];
  assert.deepEqual(out({}, { firstGoal: 'HOME', homeScore: '2', awayScore: '0' }), ['WIN', 'WIN']);
  assert.deepEqual(out({ ngPick: 'AWAY', bttsPick: 'YES' }, { firstGoal: 'HOME', homeScore: '1', awayScore: '1' }), ['LOSS', 'WIN']);
  assert.deepEqual(out({ ngPick: 'NO_GOAL', bttsPick: 'YES' }, { firstGoal: 'NONE', homeScore: '0', awayScore: '0' }), ['WIN', 'LOSS']);
  assert.deepEqual(out({ ngPick: 'home', bttsPick: 'no' }, { firstGoal: 'away', homeScore: '1', awayScore: '2' }), ['LOSS', 'LOSS']);
  assert.deepEqual(out({ ngPick: 'NO_BET', bttsPick: 'NO_BET' }, { firstGoal: 'HOME', homeScore: '1', awayScore: '0' }), ['', '']);
  assert.deepEqual(out({}, { firstGoal: 'VOID' }), ['VOID', 'VOID']);
  assert.deepEqual(out({ ngPick: 'NO_BET' }, { firstGoal: 'VOID' }), ['', 'VOID']);
  assert.deepEqual(out({}, {}), ['', '']); // no result yet
  // NO_GOAL, the word the row uses for the pick, reads as NONE (0-0).
  assert.deepEqual(out({ ngPick: 'NO_GOAL', bttsPick: 'NO' }, { firstGoal: 'NO_GOAL', homeScore: '0', awayScore: '0' }), ['WIN', 'WIN']);
  assert.match(out({}, { firstGoal: 'HOME', homeScore: '0', awayScore: '2' })[0], /^check: firstGoal HOME does not fit the score 0-2/);
  assert.match(out({}, { firstGoal: 'NONE', homeScore: '1', awayScore: '0' })[1], /^check: /);
  assert.match(out({}, { firstGoal: 'HOME', homeScore: '2', awayScore: '' })[0], /^check: homeScore and awayScore/);
  assert.match(out({ ngPick: 'DRAW' }, { firstGoal: 'HOME', homeScore: '1', awayScore: '0' })[0], /^check: ngPick/);
});

test('goalsReport scores each finished row once and writes a report the prompt reads, without a single request', () => {
  const s = loadSettle([], []);
  const rows = [];
  // Six NEXT_GOAL HOME picks, five won; the odds written with a decimal comma, as some agents do.
  for (let i = 0; i < 6; i++) {
    rows.push(goalRow({ ...goal, homeTeam: 'Home ' + i, ngHomeOdds: '1,80', bttsPick: 'NO_BET',
      ...(i < 5 ? { firstGoal: 'HOME', homeScore: '1', awayScore: '0' } : { firstGoal: 'AWAY', homeScore: '0', awayScore: '1' }) }));
  }
  // Six BTTS YES picks, two won.
  for (let i = 6; i < 12; i++) {
    rows.push(goalRow({ ...goal, homeTeam: 'Home ' + i, ngPick: 'NO_BET', bttsPick: 'YES',
      ...(i < 8 ? { firstGoal: 'HOME', homeScore: '1', awayScore: '1' } : { firstGoal: 'HOME', homeScore: '2', awayScore: '0' }) }));
  }
  rows.push(goalRow({ ...goal, homeTeam: 'Waiting' })); // kick-off not played yet
  s.tabs.GOALS = [GOALS_HEADER, ...rows];
  s.tabs.GOALS_REPORT = [];

  s.google.goalsReport();

  const col = name => GOALS_HEADER.indexOf(name);
  const goals = s.tabs.GOALS;
  assert.deepEqual(goals.slice(1, 7).map(r => r[col('ngResult')]), ['WIN', 'WIN', 'WIN', 'WIN', 'WIN', 'LOSS']);
  assert.deepEqual(goals.slice(7, 13).map(r => r[col('bttsResult')]), ['WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS', 'LOSS']);
  assert.ok(Number.isFinite(Date.parse(goals[1][col('settledAt')])));
  assert.deepEqual(goals[13].slice(col('ngResult')), ['', '', '']);
  const report = s.tabs.GOALS_REPORT.map(r => r.slice(0, 10).join('|')); // the fake sheet pads rows to 16 cells
  const line = group => report.find(r => r.startsWith(group + '|'));
  // 5 x (1.80 - 1) - 1 = +3.00 units; stated 54%, bookmaker without margin 51%, 29 points too cautious.
  assert.equal(line('NEXT_GOAL HOME'), 'NEXT_GOAL HOME|6|5|1|83%|+3.00|+50%|54%|51%|-29');
  assert.match(line('BTTS YES'), /^BTTS YES\|6\|2\|4\|33%\|-2\.30\|-38%\|/);
  assert.ok(report.some(r => r.startsWith('FAVOUR') && r.includes('NEXT_GOAL HOME 83% (n 6)')), report.join('\n'));
  assert.ok(report.some(r => r.startsWith('AVOID') && r.includes('BTTS YES 33% (n 6)')), report.join('\n'));

  // Nothing new on a second run; neither the sender nor the cleanup touches the tab or calls out.
  const before = JSON.stringify(goals);
  s.google.goalsReport();
  s.google.sendPending();
  s.google.cleanupOldRows();
  assert.equal(JSON.stringify(s.tabs.GOALS), before);
  assert.equal(s.calls.length, 0);
});

test('goalsReport leaves a probability typed as a whole percent out of the stated and edge figures', () => {
  const s = loadSettle([], []);
  // "54" instead of 0.540: counted as unknown, never as 5400%.
  s.tabs.GOALS = [GOALS_HEADER, goalRow({ ...goal, pNgHome: '54', bttsPick: 'NO_BET', firstGoal: 'HOME', homeScore: '1', awayScore: '0' })];
  s.tabs.GOALS_REPORT = [];
  s.google.goalsReport();
  const report = s.tabs.GOALS_REPORT.map(r => r.slice(0, 10).join('|'));
  assert.equal(report.find(r => r.startsWith('NEXT_GOAL HOME|')), 'NEXT_GOAL HOME|1|1|0|100%|+0.80|+80%||51%|');
  assert.ok(report.some(r => r.startsWith('edge unknown|')), report.join('\n'));
});

test('goalsReport writes nothing into a row that moved during the run', () => {
  const s = loadSettle([], []);
  const result = { firstGoal: 'HOME', homeScore: '1', awayScore: '0' };
  // Two agents' rows for the same match share league, teams and kick-off.
  s.tabs.GOALS = [GOALS_HEADER, goalRow({ ...goal, ...result }),
    goalRow({ ...goal, provider: 'gemini', ngPick: 'AWAY', bttsPick: 'NO_BET', ...result })];
  s.tabs.GOALS_REPORT = [];
  const active = s.google.SpreadsheetApp.getActive;
  // The user deletes the first row right after the script has read the tab.
  s.google.SpreadsheetApp.getActive = () => {
    const book = active();
    return { getSheetByName: name => {
      const sheet = book.getSheetByName(name);
      if (name !== 'GOALS') return sheet;
      return { ...sheet, getDataRange: () => {
        const values = sheet.getDataRange().getValues();
        s.tabs.GOALS.splice(1, 1);
        return { getValues: () => values };
      } };
    } };
  };
  s.google.goalsReport();
  const at = GOALS_HEADER.indexOf('ngResult');
  // gemini's row moved up into row 2: it must not take the first row's WIN, WIN.
  assert.deepEqual(s.tabs.GOALS[1].slice(at), ['', '', '']);
});

test('goalsReport orders prompt versions by number', () => {
  const s = loadSettle([], []);
  const scored = version => goalRow({ ...goal, promptVersion: version, bttsPick: 'NO_BET', firstGoal: 'HOME', homeScore: '1', awayScore: '0' });
  s.tabs.GOALS = [GOALS_HEADER, scored('10'), scored('2')];
  s.tabs.GOALS_REPORT = [];
  s.google.goalsReport();
  const groups = s.tabs.GOALS_REPORT.map(r => r[0]).filter(g => String(g).startsWith('prompt v'));
  assert.deepEqual(groups, ['prompt v2', 'prompt v10']);
});
