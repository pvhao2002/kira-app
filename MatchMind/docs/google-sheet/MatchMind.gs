/** @OnlyCurrentDoc */
/**
 * MatchMind sheet sender.
 *
 * AI agents that cannot reach the MatchMind API from their sandbox append each request as one row of the "MatchMind"
 * tab. This script sends new rows to the API every 5 minutes and writes the outcome into the status column.
 *
 * Setup, once:
 * 1. Create a Google Sheet that only you can open. Extensions > Apps Script: replace the code with this file, save.
 * 2. Project Settings > Script Properties > Add script property: MATCHMIND_API_KEY = the server's EXTERNAL_API_KEY.
 * 3. Choose the function "setup" and click Run, then allow the access Google asks for. setup() adds the MatchMind tab
 *    with its header row and sends new rows every 5 minutes. Reload the sheet to get the MatchMind menu.
 * 4. Put the sheet's link in MATCHMIND_SHEET_URL in the server's .env: the admin copy of the prompts then names it.
 *
 * Status column: rows marked "sent ..." or "rejected ..." are never sent again (clear the cell to resend one, or write
 * "rejected" in it to skip one). Rows marked "retry ..." go out on the next run.
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

function onOpen() {
  SpreadsheetApp.getUi().createMenu('MatchMind')
    .addItem('Send now', 'sendPending')
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
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendPending')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPending').timeBased().everyMinutes(5).create();
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
  } finally {
    lock.releaseLock();
  }
}

/** Sends one row. stop: the next rows would fail the same way, so this run ends and the next one tries again. */
function send(key, row) {
  const path = String(row[1]).trim();
  // A fixed host and a strict path: no row can send the key anywhere else.
  if (!/^\/api\/v1\/external\/[a-z\/]+$/.test(path)) return { status: 'rejected: the path must start with /api/v1/external/' };
  const headers = { 'X-Api-Key': key, 'X-Provider': String(row[2]).trim() };
  if (String(row[3]).trim()) headers['X-Model-Name'] = String(row[3]).trim();
  if (String(row[4]).trim()) headers['X-Model-Version'] = String(row[4]).trim();
  let res;
  try {
    res = UrlFetchApp.fetch(API_BASE + path, {
      method: 'post', contentType: 'application/json; charset=utf-8', payload: String(row[5]), headers: headers,
      muteHttpExceptions: true, followRedirects: false, timeoutSeconds: TIMEOUT_SECONDS,
    });
  } catch (e) {
    return { status: 'retry: cannot reach ' + API_BASE, stop: true };
  }
  const code = res.getResponseCode();
  let data = {};
  try { data = JSON.parse(res.getContentText()) || {}; } catch (e) { /* an HTML error page from a proxy */ }
  if (code >= 200 && code < 300) return { status: 'sent ' + code + (data.duplicate ? ' (already received)' : '') };
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
