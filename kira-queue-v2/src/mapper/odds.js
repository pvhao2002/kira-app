import { asRecord, asArray, stringArray, stringValue, numberValue, isEmptyObject, parseDouble } from '../util.js';
import { toGmt7DateTime } from './match.js';

// Prices and lines stay decimal strings end to end (no float arithmetic on money); only the Asian-handicap
// label formatting uses Number, exactly as the Java OddsMapper did.

function isBet365Company(company) {
  const id = numberValue(company.id);
  const name = stringValue(company.name);
  const normalized = name === null ? '' : name.replace(/\s+/g, '').toLowerCase();
  return id === 2 || normalized === 'bet365';
}

export const hasBet365Company = (oddsList) => asArray(oddsList.companies).some((c) => isBet365Company(asRecord(c)));

const decimalString = (value) => (parseDouble(value) === null ? null : value);

function trimDecimal(value) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, '');
}

function formatAsianHandicap(value) {
  const rounded = Math.round(value * 4) / 4;
  const lower = Math.floor(rounded * 2) / 2;
  const upper = Math.ceil(rounded * 2) / 2;
  return lower === upper ? trimDecimal(lower) : `${trimDecimal(lower)}/${trimDecimal(upper)}`;
}

function formatOddLine(market, line) {
  if (market !== 'hdc') return decimalString(line);
  const handicap = parseDouble(line);
  if (handicap === null) return null;
  if (handicap === 0) return '0#0';
  const abs = Math.abs(handicap);
  const homeSign = handicap > 0 ? '-' : '+';
  const awaySign = handicap > 0 ? '+' : '-';
  return `${homeSign}${formatAsianHandicap(abs)}#${awaySign}${formatAsianHandicap(abs)}`;
}

function mapOddsListItem(type, market, value) {
  const odds = stringArray(asRecord(value).odd);
  const priceA = decimalString(odds[0] ?? null);
  const line = formatOddLine(market, odds[1] ?? null);
  const priceB = decimalString(odds[2] ?? null);
  if (priceA === null || line === null || priceB === null) return null;
  return { type, market, line, priceA, priceB };
}

function mapOddsListMarket(market, items) {
  const bet365 = items.map(asRecord).find((item) => isBet365Company(asRecord(item.company)));
  if (!bet365) return [];
  return [
    mapOddsListItem('open', market, bet365.f),
    mapOddsListItem('pre-match', market, bet365.s),
    mapOddsListItem('half-time', market, bet365.l),
  ].filter((s) => s !== null);
}

export function mapOddsListForDatabase(oddsList) {
  return [
    ...mapOddsListMarket('hdc', asArray(oddsList.asia)),
    ...mapOddsListMarket('ou', asArray(oddsList.bs)),
    ...mapOddsListMarket('corner', asArray(oddsList.corner)),
  ];
}

function oddsDetailItems(body) {
  if (isEmptyObject(body)) return [];
  return asArray(body.oddsDetail).flatMap((c) => asArray(asRecord(c).details));
}

function normalizeGoal(value) {
  if (value === null) return null;
  const n = value.trim();
  return n === '' ? null : n;
}

function mapOddsDetailItems(market, items) {
  const result = [];
  for (const item of items) {
    const d = asRecord(item);
    const line = formatOddLine(market, stringValue(d.d));
    const priceA = decimalString(stringValue(d.w));
    const priceB = decimalString(stringValue(d.l));
    if (line === null || priceA === null || priceB === null) continue;
    result.push({
      market,
      line,
      priceA,
      priceB,
      matchMinute: stringValue(d.time),
      crawledAt: toGmt7DateTime(d.updateTime),
      score: normalizeGoal(stringValue(d.score)),
      statusId: numberValue(d.statusId),
    });
  }
  return result;
}

/** details = { asia, eu, bs, corner } decoded MatchOddsDetail bodies (null when absent). */
export function mapOddsTimelineForDatabase(details) {
  if ([details.asia, details.eu, details.bs, details.corner].every(isEmptyObject)) return [];
  return [
    ...mapOddsDetailItems('hdc', oddsDetailItems(details.asia)),
    ...mapOddsDetailItems('ou', oddsDetailItems(details.bs)),
    ...mapOddsDetailItems('corner', oddsDetailItems(details.corner)),
  ];
}

export function groupOddsTimelineForResponse(timeline) {
  return {
    hdc: timeline.filter((i) => i.market === 'hdc'),
    ou: timeline.filter((i) => i.market === 'ou'),
    corner: timeline.filter((i) => i.market === 'corner'),
  };
}
