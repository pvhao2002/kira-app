import { BusinessException, hasText, sleep as realSleep } from '../util.js';
import { log } from '../log.js';
import { isEmptyOddsResponse } from '../crawl/event.js';
import { toLocalDateTime } from './crawl-date.js';

const SUPPORTED_ODDS_MARKETS = new Set(['hdc', 'ou', 'corner']);
const IN_PLAY_STATUS_FALLBACK = new Set(['1H', 'HT', '2H', 'ET', 'Penalties']);

// Transient AiScore failures get a bounded retry with increasing backoff before the crawl is marked failed.
// A Cloudflare verification challenge is handled by the visible lane and is never retried automatically.
const MAX_CRAWL_RETRIES = 3;
const RETRY_DELAYS_MS = [5000, 15000, 45000];
const TRANSIENT_ERROR_PREFIXES = ['AISCORE_UPSTREAM_UNAVAILABLE', 'AISCORE_UNEXPECTED_RESPONSE', 'AISCORE_ODDS_DETAIL_FETCH_FAILED'];

const SQL_SELECT_EVENT_BASE = `
  select e.event_id,
         e.external_id                 match_id,
         e.link,
         e.has_odds,
         e.has_odds_corner,
         e.status,
         coalesce(r.is_terminal, 0) as is_terminal,
         coalesce(r.is_in_play, 0) as is_in_play
  from events e
  left join aiscore_match_status_ref r
    on r.status_type = 'status_id'
   and r.code = e.status_id
   and r.sport_id = 1
`;
const SQL_SELECT_EVENT = `${SQL_SELECT_EVENT_BASE}where e.event_id = :eventId\n`;
const SQL_SELECT_EVENT_BY_EXTERNAL_ID = `${SQL_SELECT_EVENT_BASE}where e.external_id = :externalId\n`;
const SQL_LOCK_EVENT = 'select event_id from events where event_id = :event_id for update';
const SQL_CLEAR_EVENT_ODDS_FLAGS = `
  update events
  set has_odds = false,
      has_odds_corner = false
  where event_id = :event_id
`;
const SQL_DELETE_EVENT_ODDS = 'delete from event_odds where event_id = :event_id';
const SQL_DELETE_EVENT_ODDS_TIMELINE = 'delete from event_odds_timeline where event_id = :event_id';
const SQL_INSERT_EVENT_ODDS = `
  insert ignore into event_odds (event_id, type, market, line, price_a, price_b)
  values (:event_id, :type, :market, :line, :price_a, :price_b)
`;
const SQL_INSERT_EVENT_ODDS_TIMELINE = `
  insert into event_odds_timeline (event_id, market, line, price_a, price_b, goal, match_minute, crawled_at)
  values (:event_id, :market, :line, :price_a, :price_b, :goal, :match_minute, :crawled_at)
`;
const SQL_DELETE_EVENT_CLAIM = 'delete from event_claim where event_id = :event_id';
const SQL_UPDATE_EVENT_CLAIM = `
  update event_claim
  set status = :status,
      description = :description
  where event_id = :event_id
`;

const pad = (n) => String(n).padStart(2, '0');
const localNow = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const parseCrawledAt = (crawledAt, fallback) => (hasText(crawledAt) && toLocalDateTime(crawledAt)) || fallback;

const isSupportedMarket = (m) => hasText(m) && SUPPORTED_ODDS_MARKETS.has(m);
const normalizeOddsType = (t) => (t === 'ht' ? 'half-time' : t);
const extractMatchIdFromLink = (link) => {
  const trimmed = link.trim();
  const i = trimmed.lastIndexOf('/');
  return i < 0 || i === trimmed.length - 1 ? null : trimmed.substring(i + 1);
};

function shouldReleaseClaimAfterSuccess({ status, isTerminal, isInPlay }) {
  if (isInPlay === 1) return true;
  if (isTerminal === 1) return false;
  if (hasText(status)) {
    if (IN_PLAY_STATUS_FALLBACK.has(status)) return true;
    if (status.toLowerCase() === 'ft') return false;
  }
  return false;
}

const toEventRow = (r) => ({
  eventId: Number(r.event_id),
  link: r.link ?? null,
  hasOdds: Boolean(r.has_odds),
  hasOddsCorner: r.has_odds_corner === null || r.has_odds_corner === undefined ? null : Boolean(r.has_odds_corner),
  status: r.status ?? null,
  isTerminal: Number(r.is_terminal),
  isInPlay: Number(r.is_in_play),
  matchId: r.match_id ?? null,
});

/** Port of CrawEventServiceV2. */
export function createCrawlEventService({ db, eventCrawler, sleep = realSleep }) {
  async function queryEventRow(sql, params) {
    const rows = await db.query(sql, params);
    return rows.length === 0 ? null : toEventRow(rows[0]);
  }

  const loadEventRow = (eventId) => queryEventRow(SQL_SELECT_EVENT, { eventId });
  const loadEventRowByExternalId = (externalId) => queryEventRow(SQL_SELECT_EVENT_BY_EXTERNAL_ID, { externalId });

  const updateEventClaim = (eventId, status, description) =>
    db.update(SQL_UPDATE_EVENT_CLAIM, { event_id: eventId, status, description });
  const failEventClaim = (eventId, des) => updateEventClaim(eventId, 'failed', des);
  const skippedEventClaim = (eventId, des) => updateEventClaim(eventId, 'skipped', des);
  const releaseEventClaim = (eventId) => db.update(SQL_DELETE_EVENT_CLAIM, { event_id: eventId });

  async function crawlEventWithRetry(matchId, eventRow) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await eventCrawler.crawlEvent(matchId, eventRow);
      } catch (ex) {
        const transient = ex instanceof BusinessException && TRANSIENT_ERROR_PREFIXES.some((p) => ex.message?.startsWith(p));
        if (!transient || attempt > MAX_CRAWL_RETRIES) throw ex;
        const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
        log.warn(`CrawEventServiceV2 >> transient AiScore error, retrying in ${delay}ms (attempt ${attempt}/${MAX_CRAWL_RETRIES}): ${ex.message}`);
        await sleep(delay);
      }
    }
  }

  function flattenTimeline(eventId, timeline) {
    if (!timeline) return [];
    const defaultCrawledAt = localNow();
    const params = [];
    for (const items of [timeline.hdc, timeline.ou, timeline.corner]) {
      for (const item of items ?? []) {
        if (!isSupportedMarket(item.market)) continue;
        params.push({
          event_id: eventId,
          market: item.market,
          line: item.line,
          price_a: item.priceA,
          price_b: item.priceB,
          goal: item.score,
          match_minute: item.matchMinute,
          crawled_at: parseCrawledAt(item.crawledAt, defaultCrawledAt),
        });
      }
    }
    return params;
  }

  async function persistOdds(tx, eventId, odds, timeline) {
    const started = Date.now();
    await tx.update(SQL_DELETE_EVENT_ODDS_TIMELINE, { event_id: eventId });
    await tx.update(SQL_DELETE_EVENT_ODDS, { event_id: eventId });
    let oddsRows = 0;
    if (odds && odds.length > 0) {
      const oddsParams = odds
        .filter((o) => isSupportedMarket(o.market))
        .filter((o) => hasText(o.type))
        .map((o) => ({
          event_id: eventId, type: normalizeOddsType(o.type), market: o.market, line: o.line, price_a: o.priceA, price_b: o.priceB,
        }));
      oddsRows = oddsParams.length;
      await tx.batchInsertSafe(SQL_INSERT_EVENT_ODDS, oddsParams);
    }
    const timelineParams = flattenTimeline(eventId, timeline);
    if (timelineParams.length > 0) await tx.batchInsertSafe(SQL_INSERT_EVENT_ODDS_TIMELINE, timelineParams);
    log.info(`persistOdds eventId=${eventId} oddsRows=${oddsRows} timelineRows=${timelineParams.length} totalMs=${Date.now() - started}`);
  }

  // Lock order: the events row first (FOR UPDATE), then its child tables. Writers for the same event are
  // serialized across instances; without it, two "delete where event_id" on an empty range share gap locks
  // and their following inserts deadlock.
  // Intentional change from v1: Java self-called this from processEvent/recrawlOdds, bypassing @Transactional
  // (partial per-row writes). v2 always runs it all-or-nothing; a lock error rolls back and fails the claim.
  function persistCrawlResult(eventId, response) {
    return db.withTx(async (tx) => {
      await tx.query(SQL_LOCK_EVENT, { event_id: eventId });
      if (!response.odds || response.odds.length === 0) await tx.update(SQL_CLEAR_EVENT_ODDS_FLAGS, { event_id: eventId });
      await persistOdds(tx, eventId, response.odds, response.oddsTimeline);
    });
  }

  async function handleClaimAfterSuccess(row) {
    const state = { status: row.status === null ? '-' : row.status, isTerminal: row.isTerminal, isInPlay: row.isInPlay };
    if (shouldReleaseClaimAfterSuccess(state)) await releaseEventClaim(row.eventId);
    else await updateEventClaim(row.eventId, 'completed', 'odds updated');
  }

  async function processEvent(eventId) {
    const row = await loadEventRow(eventId);
    if (!row) {
      log.warn(`CrawEventServiceV2 >> event not found: ${eventId}`);
      await skippedEventClaim(eventId, 'event not found');
      return;
    }
    if (!hasText(row.link)) {
      log.warn(`CrawEventServiceV2 >> event has no link: ${eventId}`);
      await skippedEventClaim(eventId, 'event has no link');
      return;
    }
    if (!row.hasOdds) {
      log.warn(`CrawEventServiceV2 >> event no odds: ${eventId}`);
      await skippedEventClaim(eventId, 'event has no odds');
      return;
    }
    try {
      const matchId = extractMatchIdFromLink(row.link);
      if (!hasText(matchId)) {
        log.warn(`CrawEventServiceV2 >> cannot parse matchId from link: eventId=${eventId}`);
        await skippedEventClaim(eventId, 'cannot parse matchId from link');
        return;
      }
      const response = await crawlEventWithRetry(matchId, row);
      if (isEmptyOddsResponse(response)) {
        log.warn(`CrawEventServiceV2 >> empty odds crawl response (no Bet365?): eventId=${eventId}`);
        await failEventClaim(eventId, 'empty odds crawl response (no Bet365?)');
        return;
      }
      await persistCrawlResult(eventId, response);
      await handleClaimAfterSuccess(row);
    } catch (ex) {
      log.warn(`CrawEventServiceV2 >> failed eventId=${eventId}: ${ex?.message}`);
      await failEventClaim(eventId, `exception: ${ex?.message}`);
    }
  }

  async function recrawlOdds(eventId) {
    const row = await loadEventRow(eventId);
    if (!row) throw BusinessException.notFound(`Event not found: ${eventId}`);
    if (!hasText(row.link)) throw new BusinessException(`Event has no link: ${eventId}`);
    const matchId = extractMatchIdFromLink(row.link);
    if (!hasText(matchId)) throw new BusinessException(`Cannot parse matchId from link: eventId=${eventId}`);
    try {
      const response = await crawlEventWithRetry(matchId, row);
      if (isEmptyOddsResponse(response)) throw new BusinessException(`Empty odds crawl response (no Bet365?): eventId=${eventId}`);
      await persistCrawlResult(eventId, response);
      const oddsRowCount = response.odds ? response.odds.length : 0;
      log.info(`CrawEventServiceV2 >> recrawlOdds completed eventId=${eventId}, oddsRows=${oddsRowCount}`);
      return { success: true, message: null, oddsRowCount };
    } catch (ex) {
      if (ex instanceof BusinessException) throw ex;
      // Raw DB/decode messages never reach the HTTP response; log the error type only.
      log.warn(`CrawEventServiceV2 >> recrawlOdds failed eventId=${eventId}: ${ex?.code ?? ex?.name ?? 'Error'}`);
      throw new BusinessException(`AISCORE_RECRAWL_FAILED: eventId=${eventId}`, 422, ex);
    }
  }

  return { processEvent, recrawlOdds, loadEventRowByExternalId, persistCrawlResult };
}
