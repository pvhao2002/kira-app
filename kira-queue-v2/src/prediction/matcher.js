import { hasCornerLines } from './support.js';

const TERMINAL_STATUS_FILTER = `
    and (
          exists (select 1
                  from aiscore_match_status_ref r
                  where r.status_type = 'status_id'
                    and r.code = e.status_id
                    and r.sport_id = 1
                    and r.is_terminal = 1
                    and r.code not in (9, 12))
          or (e.status_id is null and e.status = 'FT')
      )
`;

const SQL_SUFFIX = `
  group by er.ft_goal_str
  order by match_count desc, er.ft_goal_str asc
  limit 3
`;

function oddsBranch(key, market, type, lineParam, includePrice, priceAParam, priceBParam) {
  const priceClause = includePrice ? `\n      and price_a = :${priceAParam}\n      and price_b = :${priceBParam}` : '';
  return `select event_id, ${key} k
      from event_odds
      where market = '${market}'
        and type = '${type}'
        and line = :${lineParam}${priceClause}`;
}

function buildOddsEventSubquery(odds, includePrice) {
  const corner = hasCornerLines(odds);
  const branches = [
    oddsBranch(1, 'hdc', 'open', 'open_hdc_line', includePrice, 'open_hdc_price_a', 'open_hdc_price_b'),
    oddsBranch(2, 'hdc', 'pre-match', 'prematch_hdc_line', includePrice, 'prematch_hdc_price_a', 'prematch_hdc_price_b'),
    oddsBranch(3, 'ou', 'open', 'open_ou_line', includePrice, 'open_ou_price_a', 'open_ou_price_b'),
    oddsBranch(4, 'ou', 'pre-match', 'prematch_ou_line', includePrice, 'prematch_ou_price_a', 'prematch_ou_price_b'),
  ];
  if (corner) {
    branches.push(
      oddsBranch(5, 'corner', 'open', 'open_corner_line', includePrice, 'open_corner_price_a', 'open_corner_price_b'),
      oddsBranch(6, 'corner', 'pre-match', 'prematch_corner_line', includePrice, 'prematch_corner_price_a', 'prematch_corner_price_b'),
    );
  }
  return `select event_id
      from (
      ${branches.join('\n      union all\n      ')}
      ) x
      group by event_id
      having count(distinct k) = ${corner ? 6 : 4}`;
}

function buildScoreSql(oddsEventSubquery, extraWhere) {
  const whereClause = extraWhere ? `\n    ${extraWhere}` : '';
  return `select er.ft_goal_str,
       count(*) as match_count
from event_result er
         inner join (
      ${oddsEventSubquery}
         ) eo on eo.event_id = er.event_id
         inner join events e on e.event_id = er.event_id
where e.event_id <> :event_id
  and er.ft_goal_str is not null
  and er.ft_goal_str <> ''
${whereClause}${TERMINAL_STATUS_FILTER}${SQL_SUFFIX}`;
}

export const buildNoPriceSql = (odds, extraWhere = null) => buildScoreSql(buildOddsEventSubquery(odds, false), extraWhere);
export const buildWithPriceSql = (odds, extraWhere = null) => buildScoreSql(buildOddsEventSubquery(odds, true), extraWhere);

const baseLineParams = (eventId, odds) => ({
  event_id: eventId,
  open_hdc_line: odds.openHdcLine,
  prematch_hdc_line: odds.prematchHdcLine,
  open_ou_line: odds.openOuLine,
  prematch_ou_line: odds.prematchOuLine,
  open_corner_line: odds.openCornerLine ?? null,
  prematch_corner_line: odds.prematchCornerLine ?? null,
});

/**
 * Port of HistoricalScoreMatcher. Prices are bound as strings and escaped client-side (pool.query), so MySQL compares
 * them with the DECIMAL(10,2) price columns as DOUBLE, not DECIMAL (v1 bound BigDecimal). Same result for 2-decimal odds.
 */
export function createHistoricalScoreMatcher(db) {
  const queryScores = async (sql, params) =>
    (await db.query(sql, params)).map((r) => ({ ftGoalStr: r.ft_goal_str, matchCount: Number(r.match_count) }));
  const price = (v) => (v === null || v === undefined ? null : String(v));

  return {
    findTopScoresNoPrice: (eventId, odds) => queryScores(buildNoPriceSql(odds), baseLineParams(eventId, odds)),
    findTopScoresWithPrice: (eventId, odds) =>
      queryScores(buildWithPriceSql(odds), {
        ...baseLineParams(eventId, odds),
        open_hdc_price_a: price(odds.openHdcPriceA),
        open_hdc_price_b: price(odds.openHdcPriceB),
        prematch_hdc_price_a: price(odds.prematchHdcPriceA),
        prematch_hdc_price_b: price(odds.prematchHdcPriceB),
        open_ou_price_a: price(odds.openOuPriceA),
        open_ou_price_b: price(odds.openOuPriceB),
        prematch_ou_price_a: price(odds.prematchOuPriceA),
        prematch_ou_price_b: price(odds.prematchOuPriceB),
        open_corner_price_a: price(odds.openCornerPriceA),
        open_corner_price_b: price(odds.openCornerPriceB),
        prematch_corner_price_a: price(odds.prematchCornerPriceA),
        prematch_corner_price_b: price(odds.prematchCornerPriceB),
      }),
    findTopScoresWithLeagueNoPrice: (eventId, odds) =>
      queryScores(buildNoPriceSql(odds, 'and e.league_id = :league_id'), { ...baseLineParams(eventId, odds), league_id: odds.leagueId }),
  };
}
