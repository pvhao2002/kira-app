import { BusinessException, hasText } from '../util.js';
import { skippedResult } from '../prediction/support.js';
import { VERSION_CODES } from './on-demand-predict.js';

const UNKNOWN_EVENT_ID = -1;
const MARKETS = ['hdc', 'ou', 'corner'];

const SQL_EXISTING_EVENT = `
  select event_id, league_id
  from events
  where link = :url
     or external_id = :match_id
  order by event_id desc
  limit 1
`;

export function extractMatchId(url) {
  let value = url.trim();
  const q = value.indexOf('?');
  if (q >= 0) value = value.substring(0, q);
  const f = value.indexOf('#');
  if (f >= 0) value = value.substring(0, f);
  while (value.endsWith('/')) value = value.substring(0, value.length - 1);
  const slash = value.lastIndexOf('/');
  if (slash < 0 || slash === value.length - 1) return null;
  return value.substring(slash + 1);
}

const findOdds = (odds, market, type) => (odds ?? []).find((o) => o.market === market && o.type === type) ?? null;
const toSnapshot = (o) => (o ? { line: o.line, priceA: o.priceA, priceB: o.priceB } : null);

// java.math.BigDecimal(String) grammar: no whitespace, no NaN/Infinity, no hex.
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
/** BigDecimal-style parse: keep the exact text when it is a valid decimal, else null. */
const decimal = (value) => (typeof value === 'string' && DECIMAL.test(value) ? value : null);

function buildTargetOdds(eventId, leagueId, snaps) {
  const { hdc: { open: oh, preMatch: ph }, ou: { open: oo, preMatch: po }, corner: { open: oc, preMatch: pc } } = snaps;
  const line = (x) => (x ? x.line : null);
  const a = (x) => decimal(x ? x.priceA : null);
  const b = (x) => decimal(x ? x.priceB : null);
  return {
    eventId, leagueId,
    openHdcLine: line(oh), prematchHdcLine: line(ph), openOuLine: line(oo), prematchOuLine: line(po),
    openCornerLine: line(oc), prematchCornerLine: line(pc),
    openHdcPriceA: a(oh), openHdcPriceB: b(oh), openOuPriceA: a(oo), openOuPriceB: b(oo),
    openCornerPriceA: a(oc), openCornerPriceB: b(oc),
    prematchHdcPriceA: a(ph), prematchHdcPriceB: b(ph), prematchOuPriceA: a(po), prematchOuPriceB: b(po),
    prematchCornerPriceA: a(pc), prematchCornerPriceB: b(pc),
  };
}

/** Port of OnDemandUrlPredictService (POST /predict/url). */
export function createOnDemandUrlPredictService({ eventCrawler, registry, db }) {
  return {
    async predict(request) {
      const url = request?.url;
      if (!hasText(url)) throw new BusinessException('url is required');
      const trimmedUrl = url.trim();
      const matchId = extractMatchId(trimmedUrl);
      if (!hasText(matchId)) throw new BusinessException('Cannot parse matchId from url');

      const rows = await db.query(SQL_EXISTING_EVENT, { url: trimmedUrl, match_id: matchId });
      const existing = rows.length === 0
        ? null
        : { eventId: Number(rows[0].event_id), leagueId: rows[0].league_id == null ? null : Number(rows[0].league_id) };
      const eventId = existing ? existing.eventId : UNKNOWN_EVENT_ID;
      const eventRow = {
        eventId, link: trimmedUrl, hasOdds: true, hasOddsCorner: true, status: null, isTerminal: 0, isInPlay: 0, matchId,
      };
      const crawl = await eventCrawler.crawlEvent(matchId, eventRow);
      if (!crawl || crawl.matchId == null || !hasText(String(crawl.matchId)) || !crawl.odds?.length) {
        throw new BusinessException(`Empty odds crawl response (no Bet365?): matchId=${matchId}`);
      }
      const raw = {};
      const odds = {};
      for (const m of MARKETS) {
        raw[m] = { open: findOdds(crawl.odds, m, 'open'), preMatch: findOdds(crawl.odds, m, 'pre-match') };
        odds[m] = { open: toSnapshot(raw[m].open), preMatch: toSnapshot(raw[m].preMatch) };
      }
      const target = buildTargetOdds(eventId, existing ? existing.leagueId : null, raw);
      const predictions = {};
      for (const code of VERSION_CODES) {
        const engine = registry.findEngine(code);
        predictions[code] = engine ? await engine.compute(target) : skippedResult(`No prediction engine registered for version: ${code}`);
      }
      return { url: trimmedUrl, matchId, eventId: existing ? existing.eventId : null, odds, predictions };
    },
  };
}
