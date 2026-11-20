// Runs MatchMind.gs against fake Google services: node --test MatchMind/docs/google-sheet/MatchMind.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('./MatchMind.gs', import.meta.url), 'utf8');
const BASE = 'https://match.kira.id.vn';
const HEADER = ['label', 'path', 'provider', 'model', 'modelVersion', 'body', 'status'];

/**
 * Loads the script over a MatchMind tab holding `rows` below the header. The server gives `answers` in order: {code,
 * body} for JSON, {code, text} for anything else, or an Error for no connection. `after(grid)` edits the sheet while the
 * request is out, as the user could during a run.
 */
function load(rows, answers, key = 'agent-key') {
  const grid = [HEADER, ...rows.map(r => [...r])];
  const calls = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => grid.map(r => [...r]) }),
    getRange: (row, col) => ({
      getValue: () => grid[row - 1]?.[col - 1] ?? '',
      setValue: v => { (grid[row - 1] ??= Array(HEADER.length).fill(''))[col - 1] = v; },
    }),
  };
  const google = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: n => (n === 'MatchMind' ? sheet : null) }), flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: n => (n === 'MATCHMIND_API_KEY' ? key : null) }) },
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
  return { sendPending: () => google.sendPending(), status: row => grid[row][6], grid, calls };
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

test('refuses to run without the key', () => {
  assert.throws(() => load([prediction], [], null).sendPending(), /MATCHMIND_API_KEY/);
});

test('setup makes a plain-text MatchMind tab and one 5-minute trigger, for this spreadsheet only', () => {
  assert.match(SOURCE, /^\/\*\* @OnlyCurrentDoc \*\//); // the owner's trigger may open no other spreadsheet
  const log = [];
  const range = at => ({ setValues: v => log.push(['values', at, v]), setNumberFormat: f => log.push(['format', at, f]) });
  const sheet = { getRange: (...at) => range(at.join(',')), setFrozenRows: n => log.push(['frozen', n]) };
  const google = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: () => null, insertSheet: (n, i) => (log.push(['insert', n, i]), sheet) }) },
    ScriptApp: {
      getProjectTriggers: () => [{ getHandlerFunction: () => 'sendPending' }, { getHandlerFunction: () => 'other' }],
      deleteTrigger: t => log.push(['delete', t.getHandlerFunction()]),
      newTrigger: f => ({ timeBased: () => ({ everyMinutes: m => ({ create: () => log.push(['trigger', f, m]) }) }) }),
    },
  };
  vm.runInNewContext(SOURCE, google);
  google.setup();
  assert.deepEqual(JSON.parse(JSON.stringify(log)), [
    ['insert', 'MatchMind', 0],
    ['values', '1,1,1,7', [HEADER]],
    ['format', 'A:G', '@'], // plain text: Sheets would turn a version such as 2024-08-06 or 4.10 into a date or a number
    ['frozen', 1],
    ['delete', 'sendPending'],
    ['trigger', 'sendPending', 5],
  ]);
});
