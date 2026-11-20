import { asRecord, asArray, numberArray, stringValue, numberValue, findById, entityId, stringArray, hasText } from '../util.js';
import { log } from '../log.js';

// CountryCodeShortUtil is not ported: in kira-queue it is only used by the dead EventHtml DTO;
// the live path (MatchMapper) takes the iso code straight from the protobuf country.

const SQL_LOAD_LABELS = `
  select code, label
  from aiscore_match_status_ref
  where status_type = 'status_id'
    and sport_id = :sport_id
`;

/** Port of AiscoreMatchStatusLabelCache (football, sport_id = 1). */
export class MatchStatusLabelCache {
  #labels = new Map();

  async load(db) {
    const rows = await db.query(SQL_LOAD_LABELS, { sport_id: 1 });
    this.#labels = new Map(rows.map((r) => [Number(r.code), r.label]));
    if (this.#labels.size === 0) log.warn('aiscore_match_status_ref cache is empty for status_id sport_id=1');
    else log.info(`Loaded ${this.#labels.size} aiscore_match_status_ref labels (status_id, sport_id=1)`);
  }

  resolveStatus(statusId, apiStatusFallback) {
    const fallback = hasText(apiStatusFallback) ? apiStatusFallback : '-';
    if (statusId === null || statusId === undefined) return fallback;
    if (this.#labels.has(statusId)) {
      const label = this.#labels.get(statusId);
      return hasText(label) ? label : '-';
    }
    return fallback;
  }
}

export function toGmt7DateTime(value) {
  const seconds = numberValue(value);
  if (seconds === null) return null;
  return `${new Date((seconds + 7 * 3600) * 1000).toISOString().slice(0, 19)}+07:00`;
}

function fullLogoUrl(value, kind) {
  if (!hasText(value)) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://img0.aiscore.com/football/${kind}/${value}`;
}

function slugify(value) {
  if (!hasText(value)) return null;
  const slug = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? null : slug;
}

const teamSlug = (team) => stringValue(team.slug) ?? slugify(stringValue(team.name));

function buildMatchLink(match, homeTeam, awayTeam) {
  const id = stringValue(match.id);
  if (id === null) return null;
  const home = teamSlug(homeTeam);
  const away = teamSlug(awayTeam);
  if (home === null || away === null) return `https://www.aiscore.com/match/${id}`;
  return `https://www.aiscore.com/match-${home}-${away}/${id}`;
}

function mapEventStatus(match) {
  const statusId = numberValue(match.statusId);
  if (statusId === 8) return 'FT';
  if (statusId !== null) return String(statusId);
  const matchStatus = numberValue(match.matchStatus);
  return matchStatus !== null ? String(matchStatus) : '-';
}

function matchOutcome(home, away) {
  if (home === null || away === null) return 'None';
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

const goalString = (h, a) => (h === null || a === null ? null : `${h}-${a}`);
const score = (scores, i) => (i < scores.length ? scores[i] : null);

export function mapResultForDatabase(homeScores, awayScores) {
  const htHomeGoal = score(homeScores, 1);
  const htAwayGoal = score(awayScores, 1);
  const ftHomeGoal = score(homeScores, 0);
  const ftAwayGoal = score(awayScores, 0);
  return {
    htResult: matchOutcome(htHomeGoal, htAwayGoal),
    htGoalStr: goalString(htHomeGoal, htAwayGoal),
    ftResult: matchOutcome(ftHomeGoal, ftAwayGoal),
    ftGoalStr: goalString(ftHomeGoal, ftAwayGoal),
    htHomeGoal, htAwayGoal, ftHomeGoal, ftAwayGoal,
    htHomeCorner: null, htAwayCorner: null,
    ftHomeCorner: score(homeScores, 4), ftAwayCorner: score(awayScores, 4),
    htHomeYellowCard: null, htAwayYellowCard: null,
    ftHomeYellowCard: score(homeScores, 3), ftAwayYellowCard: score(awayScores, 3),
    htHomeFoul: null, htAwayFoul: null, ftHomeFoul: null, ftAwayFoul: null,
    htHomeOffside: null, htAwayOffside: null, ftHomeOffside: null, ftAwayOffside: null,
    htHomeTotalShot: null, htAwayTotalShot: null, ftHomeTotalShot: null, ftAwayTotalShot: null,
    htHomeShotOnTarget: null, htAwayShotOnTarget: null, ftHomeShotOnTarget: null, ftAwayShotOnTarget: null,
  };
}

function mapLeague(competition) {
  const country = asRecord(competition.country);
  return {
    externalId: stringValue(competition.id),
    leagueName: stringValue(competition.name),
    logoUrl: fullLogoUrl(stringValue(competition.logo), 'competition'),
    country: stringValue(country.name),
    countryCodeShort: stringValue(country.iso),
    hasStats: numberValue(competition.hasStats),
    slug: stringValue(competition.slug),
    sportId: numberValue(competition.sportId),
    color: stringValue(competition.color),
  };
}

function mapTeam(team) {
  return {
    externalId: stringValue(team.id),
    teamName: stringValue(team.name),
    logoUrl: fullLogoUrl(stringValue(team.logo), 'team'),
    sportId: numberValue(team.sportId),
  };
}

function countValidOddItems(match) {
  const odds = asRecord(asRecord(match.ext).odds);
  return asArray(odds.oddItems).filter((item) => stringArray(asRecord(item).odd).some((v) => v && v.trim() !== '')).length;
}

/** MatchMapper.mapDatabaseEvent: one protobuf match -> crawled bundle. */
export function mapDatabaseEvent(match, decoded) {
  const m = asRecord(match);
  const competition = findById(decoded.competitions, entityId(m.competition));
  const homeTeam = findById(decoded.teams, entityId(m.homeTeam));
  const awayTeam = findById(decoded.teams, entityId(m.awayTeam));
  const homeScores = numberArray(m.homeScores);
  const awayScores = numberArray(m.awayScores);
  const homeName = stringValue(homeTeam.name);
  const awayName = stringValue(awayTeam.name);
  const validOddItemCount = countValidOddItems(m);
  return {
    league: mapLeague(competition),
    homeTeam: mapTeam(homeTeam),
    awayTeam: mapTeam(awayTeam),
    event: {
      externalId: stringValue(m.id),
      leagueExternalId: stringValue(competition.id),
      homeExternalId: stringValue(homeTeam.id),
      awayExternalId: stringValue(awayTeam.id),
      eventName: homeName !== null && awayName !== null ? `${homeName} - ${awayName}` : null,
      eventDate: toGmt7DateTime(m.matchTime),
      status: mapEventStatus(m),
      statusId: numberValue(m.statusId),
      link: buildMatchLink(m, homeTeam, awayTeam),
      matchStatus: numberValue(m.matchStatus),
      hasOdds: validOddItemCount >= 3,
      hasOddsCorner: validOddItemCount === 4,
    },
    result: mapResultForDatabase(homeScores, awayScores),
  };
}
