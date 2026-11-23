/** @OnlyCurrentDoc */
/**
 * MatchMind sheet sender.
 *
 * AI agents that cannot reach the MatchMind API from their sandbox append each request as one row of the "MatchMind"
 * tab. This script sends new rows to the API every minute (the shortest Apps Script trigger) and writes the outcome into the status column.
 *
 * Setup, once:
 * 1. Create a Google Sheet that only you can open. Extensions > Apps Script: replace the code with this file, save.
 * 2. Project Settings > Script Properties > Add script property: MATCHMIND_API_KEY = the server's EXTERNAL_API_KEY.
 * 3. Choose the function "setup" and click Run, then allow the access Google asks for. setup() adds the MatchMind tab
 *    with its header row and sends new rows every minute. Reload the sheet to get the MatchMind menu.
 * 4. Put the sheet's link in MATCHMIND_SHEET_URL in the server's .env: the admin copy of the prompts then names it.
 *
 * Status column: rows marked "sent ..." or "rejected ..." are never sent again (clear the cell to resend one, or write
 * "rejected" in it to skip one). Rows marked "retry ..." go out on the next run.
 *
 * SETTLE tab (match results):
 * 5. On the MatchMind Providers screen create a provider such as "sheet", issue it a key and grant it the RESULTS scope.
 *    Add the script property MATCHMIND_RESULTS_KEY = that key (mmk_...). Run setup again.
 * 6. Every hour pullUnsettled() adds each match that still has pending picks (kick-off over 2 hours ago) as a row of
 *    the SETTLE tab. An agent ("AI Sheet Settlement Prompt") fills in status and score; every minute the filled rows
 *    are sent to MatchMind, which settles the picks, and the outcome lands in the sync column (same rules as status).
 *
 * Keep the sheet private. Anyone who can edit it can read the key, change this script and add rows that are sent
 * with your key. Agents write to it through their Google account connection, signed in as you. Never share the sheet
 * by link: the link is in every prompt you paste into a chat.
 */
const API_BASE = 'https://match.kira.id.vn';
const SHEET_NAME = 'MatchMind';
// Agents fill the columns in this order; the MatchMind prompts list the same names.
const COLUMNS = ['label', 'path', 'provider', 'model', 'modelVersion', 'body', 'status'];
const TIME_BUDGET_MS = 4 * 60 * 1000; // Google stops a run after 6 minutes: end early so no status is lost
const TIMEOUT_SECONDS = 30; // Google waits 6 minutes by default: a host that hangs would use up the day's trigger time
const SETTLE_SHEET = 'SETTLE';
// The AI Sheet Settlement Prompt names the same columns. The agent fills status .. source; sync is the script's.
const SETTLE_COLUMNS = ['matchId', 'provider', 'league', 'homeTeam', 'awayTeam', 'kickoffGmt7', 'status', 'homeScore', 'awayScore',
  'homeCorners', 'awayCorners', 'htHomeScore', 'htAwayScore', 'source', 'sync'];
const RESULT_STATUSES = ['FINISHED', 'CANCELLED', 'POSTPONED'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('MatchMind')
    .addItem('Send now', 'sendPending')
    .addItem('Pull unsettled matches', 'pullUnsettled')
    .addItem('Test connection', 'testConnection')
    .addToUi();
}

function setup() {
  const book = SpreadsheetApp.getActive();
  const sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME, 0);
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  // Plain text: otherwise Sheets turns a model version such as 2024-08-06 or 4.10 into a date or a number.
  sheet.getRange('A:G').setNumberFormat('@');
  sheet.setFrozenRows(1);
  const settle = book.getSheetByName(SETTLE_SHEET) || book.insertSheet(SETTLE_SHEET);
  settle.getRange(1, 1, 1, SETTLE_COLUMNS.length).setValues([SETTLE_COLUMNS]);
  settle.getRange('A:O').setNumberFormat('@');
  settle.setFrozenRows(1);
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendPending' || t.getHandlerFunction() === 'pullUnsettled')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPending').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('pullUnsettled').timeBased().everyHours(1).create();
}

/** Adds every match that still waits for its result (and is not in the tab yet) to the SETTLE tab. */
function pullUnsettled() {
  const key = PropertiesService.getScriptProperties().getProperty('MATCHMIND_RESULTS_KEY');
  if (!key) throw new Error('Add the script property MATCHMIND_RESULTS_KEY first: a key with the RESULTS scope');
  const sheet = SpreadsheetApp.getActive().getSheetByName(SETTLE_SHEET);
  if (!sheet) throw new Error('Run setup first: there is no ' + SETTLE_SHEET + ' tab');
  const res = UrlFetchApp.fetch(API_BASE + '/api/v1/external/matches/unsettled', {
    method: 'get', headers: { 'X-Api-Key': key }, muteHttpExceptions: true, followRedirects: false,
    timeoutSeconds: TIMEOUT_SECONDS,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('MatchMind answered ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 0; // a send run is writing sync cells: the next hour adds the rows
  try {
    const known = new Set(sheet.getDataRange().getValues().slice(1).map(r => String(r[0])));
    const rows = JSON.parse(res.getContentText()).filter(m => !known.has(m.matchId)).map(m => [m.matchId, m.provider,
      m.league || '', m.homeTeam, m.awayTeam, Utilities.formatDate(new Date(m.startTime), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm'),
      '', '', '', '', '', '', '', '', '']);
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SETTLE_COLUMNS.length).setValues(rows);
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function sendPending() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // the previous run is still sending
  try {
    const key = PropertiesService.getScriptProperties().getProperty('MATCHMIND_API_KEY');
    if (!key) throw new Error('Add the script property MATCHMIND_API_KEY first (Project Settings > Script Properties)');
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Run setup first: there is no ' + SHEET_NAME + ' tab');
    const rows = sheet.getDataRange().getValues();
    const started = Date.now();
    for (let r = 1; r < rows.length && Date.now() - started < TIME_BUDGET_MS; r++) {
      if (!String(rows[r][5]).trim() || /^(sent|rejected)\b/.test(rows[r][6])) continue;
      const outcome = send(key, rows[r]);
      // Rows deleted, inserted or sorted during the run moved this one: stop, the next run reads the sheet again.
      if (String(sheet.getRange(r + 1, 6).getValue()) !== String(rows[r][5])) break;
      sheet.getRange(r + 1, COLUMNS.length).setValue(outcome.status);
      SpreadsheetApp.flush();
      if (outcome.stop) break;
    }
    pushResults(started);
  } finally {
    lock.releaseLock();
  }
}

/** Sends the SETTLE rows the agent filled in. Does nothing until the results key and the SETTLE tab exist. */
function pushResults(started) {
  const key = PropertiesService.getScriptProperties().getProperty('MATCHMIND_RESULTS_KEY');
  const sheet = SpreadsheetApp.getActive().getSheetByName(SETTLE_SHEET);
  if (!key || !sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let r = 1; r < rows.length && Date.now() - started < TIME_BUDGET_MS; r++) {
    if (!String(rows[r][6]).trim() || /^(sent|rejected)\b/.test(rows[r][14])) continue;
    let outcome;
    try {
      outcome = post(key, '/api/v1/external/matches/results', {}, JSON.stringify(resultBody(rows[r])));
    } catch (e) {
      outcome = { status: 'rejected: ' + e.message };
    }
    if (String(sheet.getRange(r + 1, 1).getValue()) !== String(rows[r][0])) break; // rows moved: next run
    sheet.getRange(r + 1, SETTLE_COLUMNS.length).setValue(outcome.status);
    SpreadsheetApp.flush();
    if (outcome.stop) break;
  }
}

/** The results request for one SETTLE row. Throws a message for the sync column when the agent's values are unusable. */
function resultBody(row) {
  const status = String(row[6]).trim().toUpperCase();
  if (RESULT_STATUSES.indexOf(status) < 0) throw new Error('status must be one of ' + RESULT_STATUSES.join(', '));
  const body = { matchId: String(row[0]).trim(), status: status };
  const pairs = { finalScore: [7, 8], finalCorners: [9, 10], halfTimeScore: [11, 12] };
  Object.keys(pairs).forEach(name => {
    const [home, away] = pairs[name].map(c => String(row[c]).trim());
    if (!home && !away) return;
    if (!/^\d{1,2}$/.test(home) || !/^\d{1,2}$/.test(away)) throw new Error(name + ' needs two whole numbers');
    body[name] = { home: Number(home), away: Number(away) };
  });
  if (status === 'FINISHED' && !body.finalScore) throw new Error('FINISHED needs homeScore and awayScore');
  body.resultAt = new Date().toISOString();
  return body;
}

/** Sends one row. stop: the next rows would fail the same way, so this run ends and the next one tries again. */
function send(key, row) {
  const path = String(row[1]).trim();
  // A fixed host and a strict path: no row can send the key anywhere else.
  if (!/^\/api\/v1\/external\/[a-z\/]+$/.test(path)) return { status: 'rejected: the path must start with /api/v1/external/' };
  const headers = { 'X-Provider': String(row[2]).trim() };
  if (String(row[3]).trim()) headers['X-Model-Name'] = String(row[3]).trim();
  if (String(row[4]).trim()) headers['X-Model-Version'] = String(row[4]).trim();
  return post(key, path, headers, String(row[5]));
}

/** POSTs a JSON body to MatchMind and turns the answer into a status cell; same rules for both tabs. */
function post(key, path, headers, payload) {
  let res;
  try {
    res = UrlFetchApp.fetch(API_BASE + path, {
      method: 'post', contentType: 'application/json; charset=utf-8', payload: payload,
      headers: Object.assign({ 'X-Api-Key': key }, headers),
      muteHttpExceptions: true, followRedirects: false, timeoutSeconds: TIMEOUT_SECONDS,
    });
  } catch (e) {
    return { status: 'retry: cannot reach ' + API_BASE, stop: true };
  }
  const code = res.getResponseCode();
  let data = {};
  try { data = JSON.parse(res.getContentText()) || {}; } catch (e) { /* an HTML error page from a proxy */ }
  if (code >= 200 && code < 300) {
    const s = data.settlement;
    return { status: 'sent ' + code + (data.duplicate ? ' (already received)' : '')
      + (s ? ': settled ' + s.settled + ', pending ' + s.pending : '') };
  }
  const fields = data.fieldErrors && Object.keys(data.fieldErrors).length ? ' ' + JSON.stringify(data.fieldErrors) : '';
  const detail = code + (data.code ? ' ' + data.code : '') + (data.message ? ': ' + data.message : '') + fields;
  // MatchMind answers every error with a code. Without one, a redirect, a proxy or a firewall answered: try again later.
  if (!data.code) return { status: 'retry ' + detail, stop: true };
  if (code === 401) return { status: 'retry ' + detail + ' - check the MATCHMIND_API_KEY script property', stop: true };
  // A server error or a lock conflict on this row: try it again next run, and go on with the others.
  if (code >= 500 || data.code === 'CONCURRENT_UPDATE') return { status: 'retry ' + detail };
  return { status: 'rejected ' + detail };
}

function testConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const res = UrlFetchApp.fetch(API_BASE + '/api/v1/external/ping',
      { muteHttpExceptions: true, timeoutSeconds: TIMEOUT_SECONDS });
    ui.alert(res.getResponseCode() === 200 ? 'Connected to ' + API_BASE : API_BASE + ' answered ' + res.getResponseCode());
  } catch (e) {
    ui.alert('Cannot reach ' + API_BASE);
  }
}
