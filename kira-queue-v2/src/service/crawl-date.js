import { hasText } from '../util.js';
import { log } from '../log.js';

const STATUS_DONE = 'done';
const STATUS_FAILED = 'failed';

const SQL_START_CRAWL_DATE = `
  insert into crawl_date (date, status, total_events, message)
  values (:date, 'in_progress', 0, null)
  on duplicate key update
      status = 'in_progress',
      total_events = 0,
      message = null
`;

const SQL_CRAWL_DATE = `
  update crawl_date
  set status       = :status,
      total_events = :total_events,
      message      = :error_message
  where date = :date
`;

const SQL_UPSERT_LEAGUE = `
  insert ignore into leagues (league_name, logo_url, country, country_code_short,
                       external_id, has_stats, slug, sport_id, color)
  values (:league_name, :logo_url, :country, :country_code_short,
          :external_id, :has_stats, :slug, :sport_id, :color)
`;

const SQL_UPSERT_TEAM = `
  insert ignore into teams (team_name, logo_url, external_id, sport_id)
  values (:team_name, :logo_url, :external_id, :sport_id)
`;

const SQL_UPSERT_EVENT = `
  insert into events (external_id, league_id, home_id, away_id,
                      event_name, event_date, status, status_id, link,
                      has_odds, has_odds_corner)
  values (:exid, :league_id, :home_id, :away_id,
          :event_name, :event_date, :status, :status_id, :link,
          :has_odds, :has_odds_corner)
  on duplicate key update
      league_id = values(league_id),
      home_id = values(home_id),
      away_id = values(away_id),
      event_name = values(event_name),
      event_date = values(event_date),
      status = values(status),
      status_id = values(status_id),
      link = values(link),
      has_odds = values(has_odds),
      has_odds_corner = values(has_odds_corner)
`;

const SQL_UPSERT_EVENT_RESULT = `
  insert into event_result (event_id, ht_home_goal, ht_away_goal, ft_home_goal, ft_away_goal,
                            ft_home_corner, ft_away_corner, ft_home_yellow_card, ft_away_yellow_card,
                            ht_result, ht_goal_str, ft_result, ft_goal_str)
  values (:eventId, :htHomeGoal, :htAwayGoal, :ftHomeGoal, :ftAwayGoal,
          :ftHomeCorner, :ftAwayCorner, :ftHomeYellowCard, :ftAwayYellowCard,
          :htResult, :htGoalStr, :ftResult, :ftGoalStr)
  on duplicate key update
      ht_home_goal = values(ht_home_goal),
      ht_away_goal = values(ht_away_goal),
      ft_home_goal = values(ft_home_goal),
      ft_away_goal = values(ft_away_goal),
      ft_home_corner = values(ft_home_corner),
      ft_away_corner = values(ft_away_corner),
      ft_home_yellow_card = values(ft_home_yellow_card),
      ft_away_yellow_card = values(ft_away_yellow_card),
      ht_result = values(ht_result),
      ht_goal_str = values(ht_goal_str),
      ft_result = values(ft_result),
      ft_goal_str = values(ft_goal_str)
`;

const SQL_SELECT_LEAGUES = `
  select league_id, league_name, external_id
  from leagues
  where league_name in (:names) or external_id in (:exids)
`;

const SQL_SELECT_TEAMS = `
  select team_id, team_name, external_id
  from teams
  where team_name in (:names) or external_id in (:exids)
`;

const SQL_SELECT_EVENT_IDS = 'select event_id, external_id from events where external_id in (:exids)';

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const nonNegative = (v) => (v === null || v === undefined ? null : Math.max(0, v));
const distinctTexts = (values) => [...new Set(values.filter((v) => v !== null && v !== undefined && hasText(String(v))).map(String))];

/** OffsetDateTime.parse(..).toLocalDateTime(): wall-clock of the given offset, as a MySQL DATETIME string; null if unparseable. */
export function toLocalDateTime(s) {
  const m = /^(\d{4}-\d\d-\d\d)T(\d\d:\d\d)(?::(\d\d))?(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.exec(s);
  return m ? `${m[1]} ${m[2]}:${m[3] ?? '00'}` : null;
}

export function parseEventDate(eventDate) {
  if (!hasText(eventDate)) return null;
  const local = toLocalDateTime(eventDate);
  if (local === null) throw new Error('Invalid event date');
  return local;
}

const toLeagueParams = (l) => ({
  league_name: l.leagueName, logo_url: l.logoUrl, country: l.country, country_code_short: l.countryCodeShort,
  external_id: l.externalId, has_stats: l.hasStats, slug: l.slug, sport_id: l.sportId, color: l.color,
});
const toTeamParams = (t) => ({ team_name: t.teamName, logo_url: t.logoUrl, external_id: t.externalId, sport_id: t.sportId });

function toEventResultParams(eventId, r) {
  if (!r) return { eventId };
  return {
    eventId,
    htHomeGoal: nonNegative(r.htHomeGoal), htAwayGoal: nonNegative(r.htAwayGoal),
    ftHomeGoal: nonNegative(r.ftHomeGoal), ftAwayGoal: nonNegative(r.ftAwayGoal),
    ftHomeCorner: nonNegative(r.ftHomeCorner), ftAwayCorner: nonNegative(r.ftAwayCorner),
    ftHomeYellowCard: nonNegative(r.ftHomeYellowCard), ftAwayYellowCard: nonNegative(r.ftAwayYellowCard),
    htResult: r.htResult, htGoalStr: r.htGoalStr, ftResult: r.ftResult, ftGoalStr: r.ftGoalStr,
  };
}

/** Port of CrawDateServiceV2. */
export function createCrawlDateService({ db, dateCrawler, statusLabels }) {
  const updateStatus = (d, date, status, total, error) =>
    d.update(SQL_CRAWL_DATE, { date, status, total_events: total, error_message: error });

  async function loadIds(d, sql, names, exids, idCol, nameCol) {
    const byName = new Map();
    const byExternalId = new Map();
    if (names.length === 0 && exids.length === 0) return { byName, byExternalId };
    const rows = await d.query(sql, { names: names.length === 0 ? [''] : names, exids: exids.length === 0 ? [''] : exids });
    for (const r of rows) {
      byName.set(r[nameCol], Number(r[idCol]));
      if (hasText(r.external_id)) byExternalId.set(r.external_id, Number(r[idCol]));
    }
    return { byName, byExternalId };
  }

  const resolveId = (entity, byExternalId, byName, nameKey) => {
    if (!entity) return null;
    if (hasText(entity.externalId) && byExternalId.has(entity.externalId)) return byExternalId.get(entity.externalId);
    return byName.get(entity[nameKey]) ?? null;
  };

  async function persistEvents(d, events) {
    if (!events || events.length === 0) return;
    // Sorted keys: every transaction locks rows in the same order, so concurrent writers cannot deadlock on each other.
    const leagueByName = new Map();
    for (const b of events) {
      if (b.league && hasText(b.league.leagueName) && !leagueByName.has(b.league.leagueName)) {
        leagueByName.set(b.league.leagueName, toLeagueParams(b.league));
      }
    }
    const leagueNames = [...leagueByName.keys()].sort(cmp);
    await d.batchInsertSafe(SQL_UPSERT_LEAGUE, leagueNames.map((n) => leagueByName.get(n)));

    const teamByName = new Map();
    for (const b of events) {
      for (const t of [b.homeTeam, b.awayTeam]) {
        if (t && hasText(t.teamName) && !teamByName.has(t.teamName)) teamByName.set(t.teamName, toTeamParams(t));
      }
    }
    const teamNames = [...teamByName.keys()].sort(cmp);
    await d.batchInsertSafe(SQL_UPSERT_TEAM, teamNames.map((n) => teamByName.get(n)));

    const leagues = await loadIds(d, SQL_SELECT_LEAGUES, leagueNames,
      distinctTexts(leagueNames.map((n) => leagueByName.get(n).external_id)), 'league_id', 'league_name');
    const teams = await loadIds(d, SQL_SELECT_TEAMS, teamNames,
      distinctTexts(teamNames.map((n) => teamByName.get(n).external_id)), 'team_id', 'team_name');

    const eventParams = [];
    for (const b of events) {
      const e = b.event;
      if (!e || !hasText(e.externalId)) continue;
      eventParams.push({
        exid: e.externalId,
        league_id: resolveId(b.league, leagues.byExternalId, leagues.byName, 'leagueName'),
        home_id: resolveId(b.homeTeam, teams.byExternalId, teams.byName, 'teamName'),
        away_id: resolveId(b.awayTeam, teams.byExternalId, teams.byName, 'teamName'),
        event_name: e.eventName,
        event_date: parseEventDate(e.eventDate),
        status: statusLabels.resolveStatus(e.statusId, e.status),
        status_id: e.statusId,
        link: e.link,
        has_odds: e.hasOdds === true,
        has_odds_corner: e.hasOddsCorner === true,
      });
    }
    eventParams.sort((a, b) => cmp(String(a.exid), String(b.exid)));
    await d.batchInsertSafe(SQL_UPSERT_EVENT, eventParams);

    const exIds = eventParams.map((p) => p.exid).filter((x) => x !== null && x !== undefined).map(String);
    const idRows = await d.query(SQL_SELECT_EVENT_IDS, { exids: exIds });
    const eventIdByExId = new Map();
    for (const r of idRows) if (!eventIdByExId.has(r.external_id)) eventIdByExId.set(r.external_id, Number(r.event_id));

    const resultParams = [];
    for (const b of events) {
      const e = b.event;
      if (!e || !hasText(e.externalId)) continue;
      const eventId = eventIdByExId.get(e.externalId);
      if (eventId === undefined) continue;
      resultParams.push(toEventResultParams(eventId, b.result));
    }
    await d.batchInsertSafe(SQL_UPSERT_EVENT_RESULT, resultParams);
  }

  async function crawlDate(dates) {
    if (!dates || dates.length === 0) return;
    for (const date of dates) await db.update(SQL_START_CRAWL_DATE, { date });
    for (const date of dates) {
      log.info(`Start crawlDateV2 for date: ${date}`);
      const started = Date.now();
      let fetched = 0;
      try {
        const response = await dateCrawler.crawlDate(date);
        const events = response.events ?? [];
        fetched = events.length;
        const persistStart = Date.now();
        await persistEvents(db, events);
        await updateStatus(db, date, STATUS_DONE, fetched, null);
        log.info(`CrawlDateV2 persist done for date=${date}, ${fetched} events, took ${((Date.now() - persistStart) / 1000).toFixed(2)} s`);
      } catch (ex) {
        log.warn(`Error during crawlDateV2 fetch for date=${date}: ${ex?.message}`);
        await updateStatus(db, date, STATUS_FAILED, 0, ex?.message ?? null);
      } finally {
        log.info(`CrawlDateV2 fetch for date=${date} has ${fetched} events, took ${((Date.now() - started) / 1000).toFixed(2)} s`);
      }
    }
  }

  /**
   * Persist already-mapped matches (e.g. from the browser extension). Upsert by external_id, idempotent.
   * One transaction: the crawl_date upsert takes the row's X lock first, so concurrent requests for the
   * same date (any instance) run one after another instead of interleaving.
   */
  function persistDate(date, events) {
    const list = events ?? [];
    return db.withTx(async (tx) => {
      await tx.update(SQL_START_CRAWL_DATE, { date });
      await persistEvents(tx, list);
      await updateStatus(tx, date, STATUS_DONE, list.length, null);
    });
  }

  return { crawlDate, persistDate };
}
