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
 *    Per-provider keys (mmk_..., from the Providers screen) only send their own provider's rows: add one script property
 *    per provider, MATCHMIND_KEY_<PROVIDER> (upper case, "-" becomes "_"; provider "openai-gpt" -> MATCHMIND_KEY_OPENAI_GPT),
 *    or use the menu MatchMind > Set provider key. A row whose provider has no key of its own uses MATCHMIND_API_KEY.
 * 3. Choose the function "setup" and click Run, then allow the access Google asks for. setup() adds the MatchMind tab
 *    with its header row and sends new rows every minute. Reload the sheet to get the MatchMind menu.
 * 4. Put the sheet's link in MATCHMIND_SHEET_URL in the server's .env: the admin copy of the prompts then names it.
 *
 * Status column: rows marked "sent ..." or "rejected ..." are never sent again (clear the cell to resend one, or write
 * "rejected" in it to skip one). Rows marked "retry ..." go out on the next run.
 *
 * Successful rows are removed by the hourly cleanup trigger: MatchMind tab rows 48 hours after processedAt, SETTLE tab
 * rows 72 hours after syncedAt. Existing sent rows without a timestamp receive one on the first cleanup run. Pending,
 * retry and rejected rows are retained. Run setup again after upgrading.
 *
 * SETTLE tab (match results):
 * 5. On the MatchMind Providers screen create a provider such as "sheet", issue it a key and grant it the RESULTS scope.
 *    Add the script property MATCHMIND_RESULTS_KEY = that key (mmk_...). Run setup again.
 * 6. Every hour pullUnsettled() adds each match that still has pending picks (kick-off over 2 hours ago) as a row of
 *    the SETTLE tab. An agent ("AI Sheet Settlement Prompt") fills in status and score; every minute the filled rows
 *    are sent to MatchMind, which settles the picks, and the outcome lands in the sync column (same rules as status).
 *
 * GOALS tab (Next Goal and BTTS before kick-off; these rows never leave the sheet):
 * 7. The "AI Next Goal & BTTS Prompt" has an agent read the Next Goal and BTTS odds off pre-match screenshots, run
 *    1000 simulations and append one row to the GOALS tab. After the match the AI Sheet Settlement Prompt fills in
 *    firstGoal, homeScore, awayScore and resultSource. Every hour (or MatchMind > Goals report) goalsReport() scores the
 *    filled rows into ngResult and bttsResult and rewrites the GOALS_REPORT tab, which the prompt reads before each
 *    prediction. sendPending and the cleanup never read these tabs and nothing in them is sent to MatchMind.
 *
 * Keep the sheet private. Anyone who can edit it can read the key, change this script and add rows that are sent
 * with your key. Agents write to it through their Google account connection, signed in as you. Never share the sheet
 * by link: the link is in every prompt you paste into a chat.
 */
const API_BASE = 'https://match.kira.id.vn';
const SHEET_NAME = 'MatchMind';
// Agents fill the columns in this order; the MatchMind prompts list the same names.
const COLUMNS = ['label', 'path', 'provider', 'model', 'modelVersion', 'body', 'status', 'processedAt'];
const RETENTION_MS = 48 * 60 * 60 * 1000;
const SETTLE_RETENTION_MS = 72 * 60 * 60 * 1000;
const TIME_BUDGET_MS = 4 * 60 * 1000; // Google stops a run after 6 minutes: end early so no status is lost
const TIMEOUT_SECONDS = 30; // Google waits 6 minutes by default: a host that hangs would use up the day's trigger time
const SETTLE_SHEET = 'SETTLE';
// The AI Sheet Settlement Prompt names the same columns. The agent fills status .. source; sync and syncedAt are the script's.
const SETTLE_COLUMNS = ['matchId', 'provider', 'league', 'homeTeam', 'awayTeam', 'kickoffGmt7', 'status', 'homeScore', 'awayScore',
  'homeCorners', 'awayCorners', 'htHomeScore', 'htAwayScore', 'source', 'sync', 'syncedAt'];
const RESULT_STATUSES = ['FINISHED', 'CANCELLED', 'POSTPONED'];
const GOALS_SHEET = 'GOALS';
// The AI Next Goal & BTTS Prompt names the same columns. The agent fills league .. notes, the AI Sheet Settlement
// Prompt fills firstGoal .. resultSource, and goalsReport() fills ngResult, bttsResult and settledAt.
const GOALS_COLUMNS = ['league', 'homeTeam', 'awayTeam', 'kickoffGmt7', 'provider', 'model', 'promptVersion',
  'ngHomeOdds', 'ngNoGoalOdds', 'ngAwayOdds', 'bttsYesOdds', 'bttsNoOdds', 'lambdaHome', 'lambdaAway', 'simulations',
  'pNgHome', 'pNgNoGoal', 'pNgAway', 'pBttsYes', 'ngPick', 'bttsPick', 'notes', 'firstGoal', 'homeScore', 'awayScore',
  'resultSource', 'ngResult', 'bttsResult', 'settledAt'];
const GOALS_REPORT_SHEET = 'GOALS_REPORT';
const GOALS_REPORT_COLUMNS = ['group', 'picks', 'wins', 'losses', 'winRate', 'units', 'roi', 'stated', 'market', 'tooSure'];
// [upper bound (inclusive), label]; the prompt's price window is above 1.50 and at most 2.30.
const GOAL_PRICE_BANDS = [[1.50, '1.50 or lower'], [1.70, '1.51-1.70'], [1.90, '1.71-1.90'], [2.10, '1.91-2.10'],
  [2.30, '2.11-2.30'], [Infinity, 'above 2.30']];
const GOAL_EDGE_BANDS = [[0, '0 or below'], [0.03, '0 to 0.03'], [0.06, '0.03 to 0.06'], [0.10, '0.06 to 0.10'],
  [Infinity, 'above 0.10']];
const GOAL_MIN_GROUP = 6; // FAVOUR / AVOID need at least this many scored picks, as TRACK RECORD does

function onOpen() {
  SpreadsheetApp.getUi().createMenu('MatchMind')
    .addItem('Send now', 'sendPending')
    .addItem('Pull unsettled matches', 'pullUnsettled')
    .addItem('Goals report', 'goalsReport')
    .addItem('Test connection', 'testConnection')
    .addItem('Set provider key', 'setProviderKey')
    .addToUi();
}

function setup() {
  const book = SpreadsheetApp.getActive();
  const sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME, 0);
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  // Plain text: otherwise Sheets turns a model version such as 2024-08-06 or 4.10 into a date or a number.
  sheet.getRange('A:H').setNumberFormat('@');
  sheet.setFrozenRows(1);
  const settle = book.getSheetByName(SETTLE_SHEET) || book.insertSheet(SETTLE_SHEET);
  settle.getRange(1, 1, 1, SETTLE_COLUMNS.length).setValues([SETTLE_COLUMNS]);
  settle.getRange('A:P').setNumberFormat('@');
  settle.setFrozenRows(1);
  const account = book.getSheetByName('ACCOUNT') || book.insertSheet('ACCOUNT');
  account.getRange(1, 1, 1, 4).setValues([['importId', 'transactions', 'sync', 'syncedAt']]);
  account.getRange('A:D').setNumberFormat('@');
  account.setFrozenRows(1);
  const goals = book.getSheetByName(GOALS_SHEET) || book.insertSheet(GOALS_SHEET);
  goals.getRange(1, 1, 1, GOALS_COLUMNS.length).setValues([GOALS_COLUMNS]);
  goals.getRange('A:AC').setNumberFormat('@');
  goals.setFrozenRows(1);
  const report = book.getSheetByName(GOALS_REPORT_SHEET) || book.insertSheet(GOALS_REPORT_SHEET);
  report.getRange('A:J').setNumberFormat('@'); // "+3.00" and "83%" stay as written instead of becoming numbers
  ScriptApp.getProjectTriggers()
    .filter(t => ['sendPending', 'cleanupOldRows', 'pullUnsettled', 'goalsReport'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPending').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('cleanupOldRows').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('pullUnsettled').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('goalsReport').timeBased().everyHours(1).create();
}

/**
 * Scores the GOALS rows whose result is filled in (ngResult, bttsResult, settledAt) and rewrites GOALS_REPORT, which
 * the AI Next Goal & BTTS Prompt reads before predicting. Never calls MatchMind: these rows stay in the sheet.
 */
function goalsReport() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // a send run holds the lock: the next hour scores the rows
  try {
    const book = SpreadsheetApp.getActive();
    const sheet = book.getSheetByName(GOALS_SHEET);
    if (!sheet) throw new Error('Run setup first: there is no ' + GOALS_SHEET + ' tab');
    const rows = sheet.getDataRange().getValues();
    const at = GOALS_COLUMNS.indexOf('ngResult');
    for (let r = 1; r < rows.length; r++) {
      const result = goalOutcome(rows[r]);
      if (result[0] === String(rows[r][at]) && result[1] === String(rows[r][at + 1])) continue;
      // Rows deleted, inserted or sorted, or a result edited, during the run: stop, the next run reads the sheet again.
      // Every input column is compared: two agents' rows for one match share league, teams and kick-off.
      const current = sheet.getRange(r + 1, 1, 1, at).getValues()[0];
      if (current.some((v, i) => String(v) !== String(rows[r][i]))) break;
      const settledAt = result.some(v => /^(WIN|LOSS|VOID)$/.test(v)) ? new Date().toISOString() : '';
      sheet.getRange(r + 1, at + 1, 1, 3).setValues([[result[0], result[1], settledAt]]);
      rows[r][at] = result[0];
      rows[r][at + 1] = result[1];
      rows[r][at + 2] = settledAt;
    }
    const table = goalsReportTable(rows.slice(1), new Date());
    const report = book.getSheetByName(GOALS_REPORT_SHEET) || book.insertSheet(GOALS_REPORT_SHEET);
    report.clearContents();
    report.getRange(1, 1, table.length, GOALS_REPORT_COLUMNS.length).setValues(table);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/**
 * [ngResult, bttsResult] of one GOALS row: WIN, LOSS or VOID per pick, '' for NO_BET or while the result is not in,
 * and "check: ..." when the filled-in result cannot be right (the report leaves such rows out).
 */
function goalOutcome(row) {
  const cell = name => String(row[GOALS_COLUMNS.indexOf(name)]).trim().toUpperCase();
  const first = cell('firstGoal') === 'NO_GOAL' ? 'NONE' : cell('firstGoal'); // the word the row uses for the pick
  if (!first) return ['', ''];
  const ngPick = cell('ngPick'), bttsPick = cell('bttsPick');
  const ngBet = ['HOME', 'AWAY', 'NO_GOAL'].includes(ngPick), bttsBet = ['YES', 'NO'].includes(bttsPick);
  const check = message => ['check: ' + message, 'check: ' + message];
  if (!ngBet && !['', 'NO_BET'].includes(ngPick)) return check('ngPick must be HOME, AWAY, NO_GOAL or NO_BET');
  if (!bttsBet && !['', 'NO_BET'].includes(bttsPick)) return check('bttsPick must be YES, NO or NO_BET');
  if (first === 'VOID') return [ngBet ? 'VOID' : '', bttsBet ? 'VOID' : ''];
  if (!['HOME', 'AWAY', 'NONE'].includes(first)) return check('firstGoal must be HOME, AWAY, NONE or VOID');
  const home = cell('homeScore'), away = cell('awayScore');
  if (!/^\d{1,2}$/.test(home) || !/^\d{1,2}$/.test(away)) return check('homeScore and awayScore need whole numbers');
  const h = Number(home), a = Number(away);
  if ((first === 'NONE') !== (h + a === 0) || (first === 'HOME' && h === 0) || (first === 'AWAY' && a === 0)) {
    return check('firstGoal ' + first + ' does not fit the score ' + h + '-' + a);
  }
  const scorer = first === 'NONE' ? 'NO_GOAL' : first;
  return [ngBet ? (ngPick === scorer ? 'WIN' : 'LOSS') : '',
    bttsBet ? ((bttsPick === 'YES') === (h > 0 && a > 0) ? 'WIN' : 'LOSS') : ''];
}

/** Every scored pick (WIN or LOSS) with its price, stated probability and the bookmaker's without margin (q). */
function goalPicks(rows) {
  const cell = (row, name) => String(row[GOALS_COLUMNS.indexOf(name)]).trim();
  // Agents may write a decimal comma (1,85); an empty or unreadable cell is null, never 0.
  const number = text => { const v = Number(text.replace(',', '.')); return text && Number.isFinite(v) ? v : null; };
  // A probability outside 0..1 (e.g. 54 for 54%) is unknown: it would otherwise skew the stated, tooSure and edge figures.
  const probability = text => { const v = number(text); return v !== null && v >= 0 && v <= 1 ? v : null; };
  const markets = [
    ['NEXT_GOAL', 'ngPick', 'ngResult', { HOME: ['ngHomeOdds', 'pNgHome'], NO_GOAL: ['ngNoGoalOdds', 'pNgNoGoal'], AWAY: ['ngAwayOdds', 'pNgAway'] }],
    ['BTTS', 'bttsPick', 'bttsResult', { YES: ['bttsYesOdds', 'pBttsYes'], NO: ['bttsNoOdds', null] }],
  ];
  const picks = [];
  rows.forEach(row => markets.forEach(([market, pickColumn, resultColumn, selections]) => {
    const result = cell(row, resultColumn), pick = cell(row, pickColumn).toUpperCase();
    if (!['WIN', 'LOSS'].includes(result) || !selections[pick]) return;
    const price = number(cell(row, selections[pick][0]));
    if (price === null || price <= 1) return; // without its price a pick has no units: leave it out
    const yes = probability(cell(row, 'pBttsYes'));
    const p = selections[pick][1] ? probability(cell(row, selections[pick][1])) : yes === null ? null : 1 - yes;
    const prices = Object.keys(selections).map(s => number(cell(row, selections[s][0])));
    const q = prices.every(v => v !== null && v > 1) ? (1 / price) / prices.reduce((sum, v) => sum + 1 / v, 0) : null;
    picks.push({ market, pick, price, p, q, won: result === 'WIN', version: cell(row, 'promptVersion'),
      model: (cell(row, 'provider') + ' ' + cell(row, 'model')).trim() });
  }));
  return picks;
}

/** The GOALS_REPORT tab as rows of GOALS_REPORT_COLUMNS.length cells: groups of scored picks, then FAVOUR / AVOID. */
function goalsReportTable(rows, now) {
  const width = GOALS_REPORT_COLUMNS.length;
  const pad = cells => cells.concat(Array(width - cells.length).fill(''));
  const picks = goalPicks(rows);
  const waiting = rows.filter(r => String(r[GOALS_COLUMNS.indexOf('homeTeam')]).trim()
    && !String(r[GOALS_COLUMNS.indexOf('firstGoal')]).trim()).length;
  const table = [pad(['MatchMind GOALS report', 'updated ' + Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm')
    + ' GMT+7', 'scored picks: ' + picks.length, 'rows waiting for a result: ' + waiting])];
  if (!picks.length) {
    table.push(pad(['No scored picks yet: follow the rules of the AI Next Goal & BTTS Prompt as written.']));
    return table;
  }
  table.push(GOALS_REPORT_COLUMNS.slice());
  const band = (bands, v) => bands.find(b => v <= b[0])[1];
  const labels = (prefix, bands) => bands.map(b => prefix + b[1]);
  // [key of a pick, keys in display order (null: alphabetical), whether the group can go to FAVOUR / AVOID]
  const groupings = [
    [p => p.market, null, true],
    [p => p.market + ' ' + p.pick, null, true],
    [p => 'price ' + band(GOAL_PRICE_BANDS, p.price), labels('price ', GOAL_PRICE_BANDS), true],
    [p => 'edge ' + (p.q === null || p.p === null ? 'unknown' : band(GOAL_EDGE_BANDS, p.p - p.q)),
      labels('edge ', GOAL_EDGE_BANDS).concat(['edge unknown']), true],
    [p => 'prompt v' + (p.version || '?'), null, false],
    [p => 'model ' + p.model, null, false],
  ];
  const favour = [], avoid = [];
  groupings.forEach(([key, order, signal]) => {
    const groups = new Map();
    picks.forEach(p => groups.set(key(p), (groups.get(key(p)) || []).concat([p])));
    // Numbers inside keys compare as numbers: prompt v2 before prompt v10.
    const keys = [...groups.keys()].sort((a, b) => order ? order.indexOf(a) - order.indexOf(b)
      : a.localeCompare(b, undefined, { numeric: true }));
    keys.forEach(k => {
      const s = goalStats(groups.get(k));
      table.push([k, s.n, s.wins, s.n - s.wins, percent(s.winRate), signed(s.units, 2), signed(s.roi * 100, 0) + '%',
        s.stated === null ? '' : percent(s.stated), s.market === null ? '' : percent(s.market),
        s.stated === null ? '' : signed((s.stated - s.winRate) * 100, 0)]);
      if (!signal || s.n < GOAL_MIN_GROUP) return;
      if (s.winRate >= 0.6) favour.push(k + ' ' + percent(s.winRate) + ' (n ' + s.n + ')');
      else if (s.winRate < 0.45) avoid.push(k + ' ' + percent(s.winRate) + ' (n ' + s.n + ')');
    });
  });
  table.push(pad(['FAVOUR (won 60% or more, at least ' + GOAL_MIN_GROUP + ' picks)', favour.join(' · ') || 'none yet']));
  table.push(pad(['AVOID (won under 45%, at least ' + GOAL_MIN_GROUP + ' picks)', avoid.join(' · ') || 'none yet']));
  table.push(pad(['winRate = wins / picks. units = profit at a stake of 1 per pick, roi = units / picks. stated = the'
    + ' probability you gave, market = the bookmaker\'s without margin. tooSure = stated minus win rate, in points.']));
  return table;
}

function goalStats(picks) {
  const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const wins = picks.filter(p => p.won).length;
  const units = picks.reduce((sum, p) => sum + (p.won ? p.price - 1 : -1), 0);
  return { n: picks.length, wins, winRate: wins / picks.length, units, roi: units / picks.length,
    stated: average(picks.map(p => p.p).filter(v => v !== null)),
    market: average(picks.map(p => p.q).filter(v => v !== null)) };
}

function percent(fraction) {
  return Math.round(fraction * 100) + '%';
}

/** +3.00, -2.30, 0.00: a sign on every non-zero figure. */
function signed(value, digits) {
  const text = Math.abs(value).toFixed(digits);
  return (Number(text) === 0 ? '' : value > 0 ? '+' : '-') + text;
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
      ...Array(SETTLE_COLUMNS.length - 6).fill('')]);
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
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty('MATCHMIND_API_KEY');
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Run setup first: there is no ' + SHEET_NAME + ' tab');
    const rows = sheet.getDataRange().getValues();
    const started = Date.now();
    const badKeys = new Set();
    for (let r = 1; r < rows.length && Date.now() - started < TIME_BUDGET_MS; r++) {
      if (!String(rows[r][5]).trim() || /^(sent|rejected)\b/.test(rows[r][6])) continue;
      const name = keyName(rows[r][2]);
      const rowKey = props.getProperty(name) || key;
      if (badKeys.has(rowKey)) continue;   // that key was refused this run: its rows wait, the others go on
      const outcome = rowKey ? send(rowKey, rows[r])
        : { status: 'retry: add the script property ' + name + ' or MATCHMIND_API_KEY (MatchMind > Set provider key)' };
      if (/^retry 401\b/.test(outcome.status)) {
        badKeys.add(rowKey);
        outcome.status += ' - check the ' + (props.getProperty(name) ? name : 'MATCHMIND_API_KEY') + ' script property';
        outcome.stop = false;
      }
      // Rows deleted, inserted or sorted during the run moved this one: stop, the next run reads the sheet again.
      if (String(sheet.getRange(r + 1, 6).getValue()) !== String(rows[r][5])) break;
      sheet.getRange(r + 1, 7, 1, 2).setValues([[outcome.status, /^sent\b/.test(outcome.status) ? new Date().toISOString() : '']]);
      SpreadsheetApp.flush();
      if (outcome.stop) break;
    }
    pushResults(started);
    const accountKey = props.getProperty('MATCHMIND_ACCOUNT_KEY') || key;
    if (accountKey) pushAccountTransactions(accountKey, started);
  } finally {
    lock.releaseLock();
  }
}

function pushAccountTransactions(key, started) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('ACCOUNT');
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let r = 1; r < rows.length && Date.now() - started < TIME_BUDGET_MS; r++) {
    const [importId, body, sync] = rows[r];
    if (!importId || !body || /^(sent|rejected)\b/.test(sync)) continue;
    let outcome;
    try {
      const transactions = JSON.parse(body);
      if (!Array.isArray(transactions)) throw new Error();
      outcome = post(key, '/api/v1/external/account/transactions', key.startsWith('mmk_') ? {} : { 'X-Provider': 'sheet' },
        JSON.stringify({ importId, transactions }));
    } catch (e) {
      outcome = { status: 'rejected: transactions must be a JSON array' };
    }
    const current = sheet.getRange(r + 1, 1, 1, 3).getValues()[0];
    if (current[0] !== importId || current[1] !== body || current[2] !== sync) break;
    sheet.getRange(r + 1, 3, 1, 2).setValues([[outcome.status, /^sent\b/.test(outcome.status) ? new Date().toISOString() : '']]);
    SpreadsheetApp.flush();
    if (outcome.stop) break;
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
    sheet.getRange(r + 1, 15, 1, 2).setValues([[outcome.status, /^sent\b/.test(outcome.status) ? new Date().toISOString() : '']]);
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

/** Removes only successful rows: MatchMind tab rows 48 hours after processedAt, SETTLE tab rows 72 hours after syncedAt. */
function cleanupOldRows() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const book = SpreadsheetApp.getActive();
    cleanupTab(book.getSheetByName(SHEET_NAME), 6, 7, RETENTION_MS);
    cleanupTab(book.getSheetByName(SETTLE_SHEET), 14, 15, SETTLE_RETENTION_MS);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/** Deletes the rows whose status cell (statusCol, 0-based) starts with "sent" and whose time cell is retentionMs old. */
function cleanupTab(sheet, statusCol, timeCol, retentionMs) {
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  const width = timeCol + 1;
  const now = Date.now();
  for (let r = rows.length - 1; r >= 1; r--) {
    const row = rows[r];
    if (!/^sent\b/.test(row[statusCol])) continue;
    // Recheck the row before changing it; the script lock does not prevent manual sheet edits.
    const current = sheet.getRange(r + 1, 1, 1, width).getValues()[0];
    if (row.slice(0, width).some((value, i) => String(value) !== String(current[i]))) continue;
    const timestamp = Date.parse(String(row[timeCol] || ''));
    if (!Number.isFinite(timestamp)) {
      // Legacy rows have no known send time: retain them for another full retention period.
      sheet.getRange(r + 1, timeCol + 1).setValue(new Date(now).toISOString());
    } else if (now - timestamp >= retentionMs) {
      sheet.deleteRows(r + 1, 1);
    }
  }
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
  if (code === 401) return { status: 'retry ' + detail, stop: true };
  // A server error or a lock conflict on this row: try it again next run, and go on with the others.
  if (code >= 500 || data.code === 'CONCURRENT_UPDATE') return { status: 'retry ' + detail };
  return { status: 'rejected ' + detail };
}

/** Script property holding the key for a provider: "openai-gpt" -> MATCHMIND_KEY_OPENAI_GPT. */
function keyName(provider) {
  return 'MATCHMIND_KEY_' + String(provider).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/** Menu: stores (or, with an empty key, removes) the key one provider's rows are sent with. */
function setProviderKey() {
  const ui = SpreadsheetApp.getUi();
  const provider = ui.prompt('Set provider key', 'Provider, exactly as in the provider column (e.g. openai-gpt):', ui.ButtonSet.OK_CANCEL);
  if (provider.getSelectedButton() !== ui.Button.OK || !provider.getResponseText().trim()) return;
  const name = keyName(provider.getResponseText());
  const key = ui.prompt('Set provider key', 'API key for ' + name + ' (mmk_...). Leave empty to remove it:', ui.ButtonSet.OK_CANCEL);
  if (key.getSelectedButton() !== ui.Button.OK) return;
  const props = PropertiesService.getScriptProperties();
  if (key.getResponseText().trim()) props.setProperty(name, key.getResponseText().trim()); else props.deleteProperty(name);
  ui.alert(name + (key.getResponseText().trim() ? ' saved.' : ' removed.'));
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
