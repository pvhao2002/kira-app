import Decimal from 'decimal.js';
import { log } from '../log.js';
import { convertLine } from './odd-converter.js';

const SQL_LOAD_VERSION_ID = `
  select prediction_version_id
  from prediction_version
  where code = :code
    and is_active = 1
  limit 1
`;

const SQL_LOAD_TARGET_ODDS = `
  select e.event_id,
         e.league_id,
         max(case when eo.market = 'hdc' and eo.type = 'open' then eo.line end)            as open_hdc_line,
         max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.line end)        as prematch_hdc_line,
         max(case when eo.market = 'ou' and eo.type = 'open' then eo.line end)              as open_ou_line,
         max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.line end)         as prematch_ou_line,
         max(case when eo.market = 'corner' and eo.type = 'open' then eo.line end)           as open_corner_line,
         max(case when eo.market = 'corner' and eo.type = 'pre-match' then eo.line end)     as prematch_corner_line,
         max(case when eo.market = 'hdc' and eo.type = 'open' then eo.price_a end)            as open_hdc_price_a,
         max(case when eo.market = 'hdc' and eo.type = 'open' then eo.price_b end)            as open_hdc_price_b,
         max(case when eo.market = 'ou' and eo.type = 'open' then eo.price_a end)              as open_ou_price_a,
         max(case when eo.market = 'ou' and eo.type = 'open' then eo.price_b end)              as open_ou_price_b,
         max(case when eo.market = 'corner' and eo.type = 'open' then eo.price_a end)           as open_corner_price_a,
         max(case when eo.market = 'corner' and eo.type = 'open' then eo.price_b end)           as open_corner_price_b,
         max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.price_a end)        as prematch_hdc_price_a,
         max(case when eo.market = 'hdc' and eo.type = 'pre-match' then eo.price_b end)        as prematch_hdc_price_b,
         max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.price_a end)           as prematch_ou_price_a,
         max(case when eo.market = 'ou' and eo.type = 'pre-match' then eo.price_b end)           as prematch_ou_price_b,
         max(case when eo.market = 'corner' and eo.type = 'pre-match' then eo.price_a end)        as prematch_corner_price_a,
         max(case when eo.market = 'corner' and eo.type = 'pre-match' then eo.price_b end)        as prematch_corner_price_b
  from events e
           left join event_odds eo on eo.event_id = e.event_id and eo.market in ('hdc', 'ou', 'corner')
  where e.event_id = :event_id
  group by e.event_id, e.league_id
`;

const SQL_UPSERT_COMPLETED_PREDICTION = `
  insert into event_prediction (
      event_id,
      prediction_version_id,
      status,
      prematch_hdc_line,
      prematch_ou_line,
      open_hdc_line,
      open_ou_line,
      open_corner_line,
      prematch_corner_line,
      prematch_hdc_price_a,
      prematch_hdc_price_b,
      prematch_ou_price_a,
      prematch_ou_price_b,
      goal_str_pick,
      hdc_pick,
      ou_pick,
      hdc_vote_count,
      ou_vote_count,
      match_sample_count,
      error_message
  )
  values (
      :event_id,
      :prediction_version_id,
      'completed',
      :prematch_hdc_line,
      :prematch_ou_line,
      :open_hdc_line,
      :open_ou_line,
      :open_corner_line,
      :prematch_corner_line,
      :prematch_hdc_price_a,
      :prematch_hdc_price_b,
      :prematch_ou_price_a,
      :prematch_ou_price_b,
      :goal_str_pick,
      :hdc_pick,
      :ou_pick,
      :hdc_vote_count,
      :ou_vote_count,
      :match_sample_count,
      null
  )
  on duplicate key update
      status               = values(status),
      prematch_hdc_line    = values(prematch_hdc_line),
      prematch_ou_line     = values(prematch_ou_line),
      open_hdc_line        = values(open_hdc_line),
      open_ou_line         = values(open_ou_line),
      open_corner_line     = values(open_corner_line),
      prematch_corner_line = values(prematch_corner_line),
      prematch_hdc_price_a = values(prematch_hdc_price_a),
      prematch_hdc_price_b = values(prematch_hdc_price_b),
      prematch_ou_price_a  = values(prematch_ou_price_a),
      prematch_ou_price_b  = values(prematch_ou_price_b),
      goal_str_pick        = values(goal_str_pick),
      hdc_pick             = values(hdc_pick),
      ou_pick              = values(ou_pick),
      hdc_vote_count       = values(hdc_vote_count),
      ou_vote_count        = values(ou_vote_count),
      match_sample_count   = values(match_sample_count),
      error_message        = null,
      actual_ft_goal_str   = null,
      result_hdc           = null,
      result_ou            = null,
      settled_at           = null,
      updated_at           = current_timestamp
`;

const SQL_DELETE_PREDICTION = `
  delete from event_prediction
  where event_id = :event_id
    and prediction_version_id = :prediction_version_id
`;

const SQL_LOCK_EVENT = `
  select event_id
  from events
  where event_id = :event_id
  for update
`;

const SQL_HAS_CURRENT_PREDICTION_ROWS = `
  select 1
  from event_prediction ep
         inner join prediction_version pv
                    on pv.prediction_version_id = ep.prediction_version_id
  where ep.event_id = :event_id
    and pv.is_active = 1
    and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
  limit 1
`;

const SQL_DELETE_EVENT_ODDS = `
  delete from event_odds
  where event_id = :event_id
`;
const SQL_DELETE_EVENT_ODDS_TIMELINE = `
  delete from event_odds_timeline
  where event_id = :event_id
`;
const SQL_DELETE_EVENT_RESULT = `
  delete from event_result
  where event_id = :event_id
`;
const SQL_DELETE_EVENT_CRAWL_FAILED = `
  delete from event_crawl_failed
  where event_id = :event_id
`;

const SQL_DELETE_EVENT_IF_NO_CURRENT_PREDICTIONS = `
  delete from events
  where event_id = :event_id
    and not exists (
      select 1
      from event_prediction ep
             inner join prediction_version pv
                        on pv.prediction_version_id = ep.prediction_version_id
      where ep.event_id = events.event_id
        and pv.is_active = 1
        and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
    )
`;

const SQL_UPSERT_INCOMPLETE_PREDICTION = `
  insert into event_prediction (
      event_id,
      prediction_version_id,
      status,
      error_message
  )
  select e.event_id,
         :prediction_version_id,
         :status,
         :error_message
  from events e
  where e.event_id = :event_id
  on duplicate key update
      status               = values(status),
      prematch_hdc_line    = null,
      prematch_ou_line     = null,
      open_hdc_line        = null,
      open_ou_line         = null,
      open_corner_line     = null,
      prematch_corner_line = null,
      prematch_hdc_price_a = null,
      prematch_hdc_price_b = null,
      prematch_ou_price_a  = null,
      prematch_ou_price_b  = null,
      goal_str_pick        = null,
      hdc_pick             = null,
      ou_pick              = null,
      hdc_vote_count       = null,
      ou_vote_count        = null,
      match_sample_count   = null,
      error_message        = values(error_message),
      actual_ft_goal_str   = null,
      result_hdc           = null,
      result_ou            = null,
      settled_at           = null,
      updated_at           = current_timestamp
`;

export const PICK = Object.freeze({ HOME: 'HOME', AWAY: 'AWAY', OVER: 'OVER', UNDER: 'UNDER', DRAW: 'DRAW', NONE: 'NONE' });
const ERROR_MESSAGE_MAX_LENGTH = 512;

// ---- static helpers (TargetEventOdds is a plain object; prices are decimal strings/Decimals or null) ----
export const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
const nil = (v) => v === null || v === undefined;

export const hasRequiredHdcOuLines = (o) =>
  !isBlank(o.openHdcLine) && !isBlank(o.prematchHdcLine) && !isBlank(o.openOuLine) && !isBlank(o.prematchOuLine);
export const hasCornerLines = (o) => !isBlank(o.openCornerLine) && !isBlank(o.prematchCornerLine);
export function hasRequiredOpenPrematchLines(o) {
  if (!hasRequiredHdcOuLines(o)) return false;
  if (hasCornerLines(o)) return true;
  return isBlank(o.openCornerLine) && isBlank(o.prematchCornerLine);
}
export const hasRequiredHdcOuPrices = (o) =>
  [o.openHdcPriceA, o.openHdcPriceB, o.openOuPriceA, o.openOuPriceB,
    o.prematchHdcPriceA, o.prematchHdcPriceB, o.prematchOuPriceA, o.prematchOuPriceB].every((p) => !nil(p));
export const hasCornerPrices = (o) =>
  !nil(o.openCornerPriceA) && !nil(o.openCornerPriceB) && !nil(o.prematchCornerPriceA) && !nil(o.prematchCornerPriceB);
export function hasRequiredOpenPrematchPrices(o) {
  if (!hasRequiredHdcOuPrices(o)) return false;
  if (hasCornerLines(o)) return hasCornerPrices(o);
  return nil(o.openCornerPriceA) && nil(o.openCornerPriceB) && nil(o.prematchCornerPriceA) && nil(o.prematchCornerPriceB);
}

export const skippedResult = (message) => ({
  status: 'skipped', hdcPick: null, ouPick: null, goalStrPick: null, hdcVoteCount: null, ouVoteCount: null,
  matchSampleCount: null, prematchHdcLine: null, prematchOuLine: null, errorMessage: message,
});

const isUsefulPick = (p) => p !== null && p !== undefined && String(p).trim() !== '' && p !== PICK.NONE;

/** Tie on vote count resolves to the lexicographically larger pick name (HOME over AWAY, UNDER over OVER), as in v1. */
export function majorityPick(counter) {
  let best = null;
  for (const [pick, count] of counter) {
    if (pick === PICK.NONE) continue;
    if (best === null || count > best[1] || (count === best[1] && pick > best[0])) best = [pick, count];
  }
  return best === null ? PICK.NONE : best[0];
}

function parseIntStrict(text) {
  const t = String(text).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error(`Invalid integer: ${t}`);
  return Number.parseInt(t, 10);
}

export function picksForScore(ftGoalStr, odds) {
  const parts = ftGoalStr.split('-');
  const home = parseIntStrict(parts[0]);
  const away = parseIntStrict(parts[1]);
  const total = new Decimal(home + away);
  const ouPick = total.gt(convertLine(odds.prematchOuLine)) ? PICK.OVER : PICK.UNDER;
  const hdcHome = convertLine(odds.prematchHdcLine.split('#')[0]);
  const hdcPick = new Decimal(home).plus(hdcHome).gte(away) ? PICK.HOME : PICK.AWAY;
  return { hdcPick, ouPick };
}

export function buildCompletedResult(odds, topScores) {
  const hdc = new Map();
  const ou = new Map();
  let maxSample = 0;
  for (const row of topScores) {
    const picks = picksForScore(row.ftGoalStr, odds);
    hdc.set(picks.hdcPick, (hdc.get(picks.hdcPick) ?? 0) + 1);
    ou.set(picks.ouPick, (ou.get(picks.ouPick) ?? 0) + 1);
    maxSample = Math.max(maxSample, row.matchCount);
  }
  const finalHdc = majorityPick(hdc);
  const finalOu = majorityPick(ou);
  return {
    status: 'completed',
    hdcPick: finalHdc,
    ouPick: finalOu,
    goalStrPick: topScores.map((r) => r.ftGoalStr),
    hdcVoteCount: hdc.get(finalHdc) ?? 0,
    ouVoteCount: ou.get(finalOu) ?? 0,
    matchSampleCount: maxSample,
    prematchHdcLine: odds.prematchHdcLine,
    prematchOuLine: odds.prematchOuLine,
    errorMessage: null,
  };
}

export const formatGoalStrPick = (topScores) => JSON.stringify(topScores.map((r) => r.ftGoalStr));

const toTargetOdds = (r) => ({
  eventId: Number(r.event_id),
  leagueId: r.league_id === null || r.league_id === undefined ? null : Number(r.league_id),
  openHdcLine: r.open_hdc_line ?? null,
  prematchHdcLine: r.prematch_hdc_line ?? null,
  openOuLine: r.open_ou_line ?? null,
  prematchOuLine: r.prematch_ou_line ?? null,
  openCornerLine: r.open_corner_line ?? null,
  prematchCornerLine: r.prematch_corner_line ?? null,
  openHdcPriceA: r.open_hdc_price_a ?? null,
  openHdcPriceB: r.open_hdc_price_b ?? null,
  openOuPriceA: r.open_ou_price_a ?? null,
  openOuPriceB: r.open_ou_price_b ?? null,
  openCornerPriceA: r.open_corner_price_a ?? null,
  openCornerPriceB: r.open_corner_price_b ?? null,
  prematchHdcPriceA: r.prematch_hdc_price_a ?? null,
  prematchHdcPriceB: r.prematch_hdc_price_b ?? null,
  prematchOuPriceA: r.prematch_ou_price_a ?? null,
  prematchOuPriceB: r.prematch_ou_price_b ?? null,
  prematchCornerPriceA: r.prematch_corner_price_a ?? null,
  prematchCornerPriceB: r.prematch_corner_price_b ?? null,
});

/** Port of PredictionEngineSupport bound to a db (or a transaction). */
export function createPredictionSupport(db) {
  const truncate = (m) => (m === null || m === undefined || m.length <= ERROR_MESSAGE_MAX_LENGTH ? m : m.slice(0, ERROR_MESSAGE_MAX_LENGTH));

  async function loadVersionId(versionCode) {
    const rows = await db.query(SQL_LOAD_VERSION_ID, { code: versionCode });
    return rows.length === 0 ? null : Number(rows[0].prediction_version_id);
  }

  async function loadTargetOdds(eventId) {
    const rows = await db.query(SQL_LOAD_TARGET_ODDS, { event_id: eventId });
    return rows.length === 0 ? null : toTargetOdds(rows[0]);
  }

  async function updateCompleted(eventId, versionId, odds, topScores) {
    const result = buildCompletedResult(odds, topScores);
    if (!isUsefulPick(result.hdcPick) && !isUsefulPick(result.ouPick)) {
      await db.update(SQL_DELETE_PREDICTION, { event_id: eventId, prediction_version_id: versionId });
      log.info(`Skip persisting prediction without hdc/ou pick for event_id=${eventId}, version_id=${versionId}`);
      return;
    }
    const corner = hasCornerLines(odds);
    await db.update(SQL_UPSERT_COMPLETED_PREDICTION, {
      event_id: eventId,
      prediction_version_id: versionId,
      prematch_hdc_line: odds.prematchHdcLine,
      prematch_ou_line: odds.prematchOuLine,
      open_hdc_line: odds.openHdcLine,
      open_ou_line: odds.openOuLine,
      open_corner_line: corner ? odds.openCornerLine : null,
      prematch_corner_line: corner ? odds.prematchCornerLine : null,
      prematch_hdc_price_a: odds.prematchHdcPriceA ?? null,
      prematch_hdc_price_b: odds.prematchHdcPriceB ?? null,
      prematch_ou_price_a: odds.prematchOuPriceA ?? null,
      prematch_ou_price_b: odds.prematchOuPriceB ?? null,
      goal_str_pick: formatGoalStrPick(topScores),
      hdc_pick: result.hdcPick,
      ou_pick: result.ouPick,
      hdc_vote_count: result.hdcVoteCount,
      ou_vote_count: result.ouVoteCount,
      match_sample_count: result.matchSampleCount,
    });
  }

  const updateIncomplete = (eventId, versionId, status, message) =>
    db.update(SQL_UPSERT_INCOMPLETE_PREDICTION, {
      event_id: eventId, prediction_version_id: versionId, status, error_message: truncate(message),
    });

  async function updateSkipped(eventId, versionId, message) {
    await updateIncomplete(eventId, versionId, 'skipped', message);
    log.info(`Persist skipped prediction for event_id=${eventId}, version_id=${versionId}: ${message}`);
  }

  async function updateFailed(eventId, versionId, message) {
    await updateIncomplete(eventId, versionId, 'failed', message);
    log.info(`Persist failed prediction for event_id=${eventId}, version_id=${versionId}: ${message}`);
  }

  function deleteEventIfNoCurrentPredictionRows(eventId) {
    return db.withTx(async (tx) => {
      const params = { event_id: eventId };
      if ((await tx.query(SQL_LOCK_EVENT, params)).length === 0) return false;
      if ((await tx.query(SQL_HAS_CURRENT_PREDICTION_ROWS, params)).length > 0) return false;
      await tx.update(SQL_DELETE_EVENT_ODDS, params);
      await tx.update(SQL_DELETE_EVENT_ODDS_TIMELINE, params);
      await tx.update(SQL_DELETE_EVENT_RESULT, params);
      await tx.update(SQL_DELETE_EVENT_CRAWL_FAILED, params);
      const deleted = await tx.update(SQL_DELETE_EVENT_IF_NO_CURRENT_PREDICTIONS, params);
      if (deleted > 0) {
        log.info(`Deleted event without current prediction rows: event_id=${eventId}`);
        return true;
      }
      return false;
    });
  }

  return {
    loadVersionId,
    loadTargetOdds,
    updateCompleted,
    updateSkipped,
    updateFailed,
    deleteEventIfNoCurrentPredictionRows,
    buildCompletedResult,
    buildSkippedResult: skippedResult,
  };
}
