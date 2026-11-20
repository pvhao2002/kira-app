import { BusinessException, isEmptyObject } from '../util.js';
import { log } from '../log.js';
import * as defaultProto from '../protobuf.js';
import * as defaultOdds from '../mapper/odds.js';

// Template literals, not String.replace('%s', v): replace() expands `$&`/`$'`/`$$` in v (Java formatted() does not).
const oddListUrl = (matchId) => `https://api.aiscore.com/v1/web/api/match/odds_list?match_id=${matchId}&code=195`;
const oddDetailUrl = (matchId, type) => `https://api.aiscore.com/v1/web/api/match/odds/detail?match_id=${matchId}&cid=2&odds_type=${type}`;
const ODDS_TYPE_LIST = ['asia', 'bs', 'corner'];
const DEFAULT_WAIT_MS = 100;

const emptyResponse = () => ({ matchId: null, event: null, eventResult: null, odds: [], oddsTimeline: null, aiscoreRaw: {} });

/** Port of EventCrawlService. */
export function createEventCrawler({ browser, fetchClient, proto = defaultProto, oddsMapper = defaultOdds }) {
  const decodeDetail = (body) => {
    const decoded = proto.decodeMatchOddsDetail(body);
    return isEmptyObject(decoded) ? null : decoded;
  };

  function mapOddsDecoded(matchId, oddsList, details, requireCorner) {
    // Distinguish a silently-failed fetch (mid-crawl block) from a genuinely empty odds-detail payload:
    // throw so the caller keeps the existing timeline rows instead of persisting a partial result.
    for (const required of requireCorner ? ODDS_TYPE_LIST : ['asia', 'bs']) {
      if (!details || details[required] === undefined || details[required] === null) {
        throw new BusinessException(
          `AISCORE_ODDS_DETAIL_FETCH_FAILED: odds detail fetch returned no body for type=${required}, matchId=${matchId}`,
        );
      }
    }
    const oddsDetails = {
      asia: decodeDetail(details.asia),
      eu: null,
      bs: decodeDetail(details.bs),
      corner: details.corner === undefined || details.corner === null ? null : decodeDetail(details.corner),
    };
    const timeline = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
    return {
      matchId,
      event: null,
      eventResult: null,
      odds: oddsMapper.mapOddsListForDatabase(oddsList),
      oddsTimeline: oddsMapper.groupOddsTimelineForResponse(timeline),
      aiscoreRaw: null,
    };
  }

  /** Pure decode + map of already-fetched bodies. Empty when no Bet365; throws when a required detail tab is missing. */
  function mapOdds(matchId, oddsListBody, details) {
    const oddsList = proto.decodeMatchOdds(oddsListBody);
    if (!oddsMapper.hasBet365Company(oddsList)) return emptyResponse();
    return mapOddsDecoded(matchId, oddsList, details, false);
  }

  async function fetchOddsDetailTabs(page, event) {
    const bodies = {};
    for (const type of ODDS_TYPE_LIST) {
      if (!event.hasOddsCorner && type === 'corner') continue;
      const body = await fetchClient.fetchOptional(page, oddDetailUrl(event.matchId, type));
      await page.waitForTimeout(DEFAULT_WAIT_MS);
      if (body !== null && body !== undefined) bodies[type] = body;
    }
    return bodies;
  }

  async function crawlOnPage(page, matchId, event) {
    const start = Date.now();
    const sec = () => ((Date.now() - start) / 1000).toFixed(3);
    const listBody = await fetchClient.fetchOptional(page, oddListUrl(matchId));
    if (!listBody || listBody.length === 0) {
      log.warn(`MatchOdds timing summary matchId=${matchId} outcome=fetchFailed totalSec=${sec()}`);
      return emptyResponse();
    }
    const oddsList = proto.decodeMatchOdds(listBody);
    if (!oddsMapper.hasBet365Company(oddsList)) {
      log.info(`MatchOdds timing summary matchId=${matchId} outcome=noBet365 totalSec=${sec()}`);
      return emptyResponse();
    }
    // ponytail: has_odds_corner NULL (crawl-event.js maps it to null) is treated as false: corner tab skipped,
    // odds persisted without corner. Java NPEs here instead (crawl fails, rows kept). Fail on null if corner wipes matter.
    const response = mapOddsDecoded(matchId, oddsList, await fetchOddsDetailTabs(page, event), !!event.hasOddsCorner);
    log.info(`MatchOdds timing summary matchId=${matchId} outcome=success totalSec=${sec()}`);
    return response;
  }

  const crawlEvent = (matchId, event) => browser.getLane('event').withPage((page) => crawlOnPage(page, matchId, event));

  return { crawlEvent, mapOdds };
}

export const isEmptyOddsResponse = (r) => r.matchId === null || r.matchId === undefined || String(r.matchId).trim() === '';
