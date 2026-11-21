import { PredictionStatsView, SettlementResult } from '../core/models';

/**
 * One display locale for the whole app, matching its English text: "29 Dec 2026, 17:00" (day first, 24-hour), never the
 * browser's locale. Times stay in the viewer's own time zone; `tzLabel()` names it (UX-021, UX-112).
 */
export const APP_LOCALE = 'en-GB';
const dateTime = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
const shortDateTime = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "GMT+7": the offset of the zone times are shown in (the browser's unless `timeZone` is given). */
export function tzLabel(at = new Date(), timeZone?: string): string {
  const parts = new Intl.DateTimeFormat(APP_LOCALE, { timeZone, timeZoneName: 'shortOffset' }).formatToParts(at);
  return parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
}

/** Explicit BiDi embeddings, overrides, isolates and marks: agent-supplied text may carry them (UX-030). */
export const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;

/**
 * Agent text (team, league, model names) for display: when it carries BiDi controls it is wrapped in FSI…PDI, which
 * closes any unterminated override at its end, so it cannot reorder the text around it. Plain text is returned as is.
 */
export function bidiSafe(v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return new RegExp(BIDI_CONTROLS.source).test(v) ? `⁨${v}⁩` : v;
}

export function fmtDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

export function fmtShort(iso: string | null | undefined): string {
  return iso ? shortDateTime.format(new Date(iso)) : '—';
}

/** 0.5234 -> "52.3%"; null stays an explicit dash (never a fake 0%). */
export function pct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? '—' : `${(Number(v) * 100).toFixed(digits)}%`;
}

export function num(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined ? '—' : Number(v).toFixed(digits);
}

/** UX-018: a win rate (n = wins + losses) or ROI (n = staked) over fewer picks than this gets a "small sample" badge. */
export const SMALL_SAMPLE = 30;

/** Matches API_DOCUMENTATION.md, "ROI / units"; shown on the Units and ROI headers and tiles. */
export const ROI_DEF = 'Stake 1 per pick at its stored odds: win = odds − 1, half win = (odds − 1) / 2, push = 0, half loss = −0.5, loss = −1; void and pending are left out. ROI = units / staked (push counts as staked).';

/** Profit at a stake of 1, signed with 3 decimals: "+0.900", "−1.000" (a real minus sign); null stays a dash. */
export function units(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(3)}`;
}

export function score(h: number | null | undefined, a: number | null | undefined): string {
  return h === null || h === undefined || a === null || a === undefined ? '—' : `${h}–${a}`;
}

/** AH lines are quoted for the home side: "+0.25" / "-0.75"; totals print as-is. */
export function line(market: string | null | undefined, v: number | null | undefined, display?: string | null): string {
  if (display) return display;
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return market && market.endsWith('AH') && n > 0 ? `+${n}` : `${n}`;
}

export type Severity = 'success' | 'danger' | 'warn' | 'info' | 'secondary' | 'contrast';

export function resultSeverity(r: SettlementResult | string | null | undefined): Severity {
  switch (r) {
    case 'WIN': case 'HALF_WIN': return 'success';
    case 'LOSS': case 'HALF_LOSS': return 'danger';
    case 'PUSH': case 'VOID': return 'secondary';
    default: return 'warn';
  }
}

export function statusSeverity(s: string | null | undefined): Severity {
  switch (s) {
    case 'FINISHED': case 'ACTIVE': case 'SUCCESS': return 'success';
    case 'LIVE': case 'DUPLICATE': return 'info';
    case 'CANCELLED': case 'DISABLED': case 'REVOKED': case 'FAILED': return 'danger';
    case 'REJECTED': case 'POSTPONED': return 'warn';
    default: return 'secondary';
  }
}

const ACRONYMS = /\b(ah|ou|ai|api|ht|ft|cs|id|ip|1x2)\b/g;   // market codes and terms that read wrong as "Ah", "Ai"
export function humanize(v: string | null | undefined): string {
  return v ? v.replaceAll('_', ' ').toLowerCase().replace(ACRONYMS, m => m.toUpperCase()).replace(/^\w/, c => c.toUpperCase()) : '—';
}

/** Local calendar day -> ISO instant of its start; `endExclusive` returns the next day's start. */
export function dayStart(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}
export function dayEndExclusive(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface Col { field: string; header: string; kind?: 'pct' | 'num' | 'int' | 'date' | 'text' | 'units'; }

export function cell(row: Record<string, unknown>, c: Col): string {
  const v = row[c.field] as number | string | null | undefined;
  switch (c.kind) {
    case 'pct': return pct(v as number | null);
    case 'num': return num(v as number | null);
    case 'units': return units(v as number | null);
    case 'date': return fmtDateTime(v as string | null);
    case 'int': return v === null || v === undefined ? '—' : String(v);
    default: return bidiSafe(v === null || v === undefined ? v : String(v));
  }
}

/** Small aggregated tables only (already in memory); big exports go through the server. */
export function downloadCsv(filename: string, cols: Col[], rows: Record<string, unknown>[]): void {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    // Spreadsheet formula-injection guard; numbers (e.g. AH line -0.25) are safe and stay numeric.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [cols.map(c => esc(c.header)).join(','), ...rows.map(r => cols.map(c => esc(r[c.field])).join(','))];
  saveBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
}

export type StatRow = [label: string, home: number | null, away: number | null];

/** Home/away rows for a stats table; match detail and prediction detail show the same set. */
export function statRows(s: Omit<PredictionStatsView, 'extra'>): StatRow[] {
  return [
    ['Possession %', s.possessionHome, s.possessionAway], ['Shots', s.shotsHome, s.shotsAway],
    ['On target', s.shotsOnTargetHome, s.shotsOnTargetAway], ['Off target', s.shotsOffTargetHome, s.shotsOffTargetAway],
    ['Corners', s.cornersHome, s.cornersAway], ['Yellow cards', s.yellowCardsHome, s.yellowCardsAway], ['Red cards', s.redCardsHome, s.redCardsAway],
  ];
}

export interface FieldChange { field: string; before: string; after: string; }

/** Fields whose value differs between two JSON snapshots, formatted for reading (result history, audit). */
export function changedFields(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): FieldChange[] {
  const show = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'string') return /^\d{4}-\d\d-\d\dT/.test(v) ? fmtDateTime(v) : /^[A-Z][A-Z_]+$/.test(v) ? humanize(v) : bidiSafe(v);
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  };
  const label = (k: string) => humanize(k.replace(/([a-z\d])([A-Z])/g, '$1_$2'));
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys
    .filter(k => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null))
    .map(k => ({ field: label(k), before: show(before?.[k]), after: show(after?.[k]) }));
}

// ------------------------------------------------------------------ detail pages (match, prediction, model)

/** UX-008: one line convention everywhere: the decimal line ("-0.25"); the agent's display text only when no number. */
export function lineText(market: string | null | undefined, v: number | null | undefined, display?: string | null): string {
  return v === null || v === undefined ? display || '—' : line(market, v);
}

/** Tooltip of a quarter line: its two half stakes, nearest to zero first ("-0.25" -> "0/-0.5"); '' otherwise. */
export function lineSplit(market: string | null | undefined, v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const q = Math.round(Number(v) * 4);   // quarters are exact integers; no float sums on the line itself
  if (q % 2 === 0) return '';
  const s = Math.sign(q);
  return `${line(market, (q - s) / 4)}/${line(market, (q + s) / 4)}`;
}

/** "AH HOME -0.25", "1X2 · HOME": a pick with the UX-008 line convention; pair it with `lineSplit` as the tooltip. */
export function pickText(market: string | null | undefined, pick: string | null | undefined, l?: number | null, display?: string | null): string {
  if (!market || !pick) return '—';
  return market === '1X2' ? `1X2 · ${pick}` : `${market.replace('_', ' ')} ${pick} ${lineText(market, l, display)}`;
}

/** UX-095: a REMAINING_MATCH pick counts only what happens after the odds were captured. '' for full-match picks. */
export function basisNote(basis: string | null | undefined, market: string | null | undefined, home: number | null | undefined,
                          away: number | null | undefined, minute: number | null | undefined): string {
  if (basis !== 'REMAINING_MATCH') return '';
  const what = market?.startsWith('CORNER_') ? 'Corners' : 'Goals';
  return `${what} after ${minute === null || minute === undefined ? 'capture' : `${minute}'`} from ${score(home, away)}`;
}

/** UX-004: one sentence explaining a settlement row from its `details` (engine `settle-v1` keys). */
export function settlementSentence(details: Record<string, unknown> | null | undefined, result: string): string {
  const d = (details ?? {}) as Record<string, any>;
  const head = pickText(d['market'], d['pick'], d['line']);
  const sc = (s: unknown) => String(s).replace('-', '–');
  const engine = humanize(d['engineResult'] ?? result);
  const override = d['overriddenTo'] ? ` Admin override: ${engine} set to ${humanize(d['overriddenTo'])}.` : '';
  if (result === 'PENDING' && d['previousResult']) {
    return `${head}: match is ${humanize(d['matchStatus'])} again → Pending (was ${humanize(d['previousResult'])}).`;
  }
  if (d['matchStatus'] === 'CANCELLED') return `${head}: match cancelled → ${engine}.${override}`;
  if (d['basisScore'] === undefined) return `${head}: match ${humanize(d['matchStatus'])} → ${engine}.${override}`;
  const remaining = d['settlementBasis'] === 'REMAINING_MATCH';
  const corners = d['finalCorners'] !== undefined;
  let s = `${head} ${remaining ? `on the remaining match from ${sc(d['atCapture'])}` : 'on the full match'}: `
    + `final${corners ? ' corners' : ''} ${sc(d['finalCorners'] ?? d['finalScore'])}${remaining ? `, so ${sc(d['basisScore'])} counts` : ''}. `;
  const legs = (d['legs'] ?? []) as { line: number; margin: number; result: string }[];
  const leg = (l: { line: number; margin: number; result: string }) =>
    `${line(d['market'], l.line)} (margin ${l.margin}, ${humanize(l.result).toLowerCase()})`;
  if (d['outcome1x2']) s += `Outcome ${humanize(d['outcome1x2'])} → ${engine}.`;
  else if (legs.length === 2) s += `Quarter line split: ${leg(legs[0])} and ${leg(legs[1])} → ${engine}.`;
  else if (legs.length === 1) s += `Margin ${legs[0].margin} → ${engine}.`;
  else s += `→ ${engine}.`;
  return s + override;
}

const RESULT_AUDIT_KEYS = new Set(['resultAt', 'requestId', 'changedBy', 'reason']);
const RESULT_PAIRS: [label: string, home: string, away: string][] = [
  ['Final score', 'finalHomeScore', 'finalAwayScore'], ['HT score', 'htHomeScore', 'htAwayScore'],
  ['Corners', 'finalHomeCorners', 'finalAwayCorners'], ['HT corners', 'htHomeCorners', 'htAwayCorners'],
];

/** UX-003/UX-105: changed fields of a match result history row; home/away pairs read as one score, audit keys left out. */
export function resultChanges(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): FieldChange[] {
  const view = (r: Record<string, unknown> | null | undefined) => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(r ?? {})) {
      const pair = RESULT_PAIRS.find(p => p[1] === k || p[2] === k);
      if (RESULT_AUDIT_KEYS.has(k)) continue;
      if (pair) out[pair[0]] = score(r![pair[1]] as number | null, r![pair[2]] as number | null);
      else out[k === 'startTime' ? 'Kick-off' : k] = r![k];
    }
    return out;
  };
  return changedFields(view(before), view(after));
}

/** UX-025: `stats.extra` entries shaped `{home, away}` as stat rows; anything else stays for the JSON view. */
export function extraStatRows(extra: unknown): { rows: [string, unknown, unknown][]; rest: Record<string, unknown> | null } {
  const rows: [string, unknown, unknown][] = [];
  const rest: Record<string, unknown> = {};
  if (!extra || typeof extra !== 'object') return { rows, rest: null };
  for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
    if (v && typeof v === 'object' && ('home' in v || 'away' in v)) {
      const p = v as { home?: unknown; away?: unknown };
      rows.push([humanize(k.replace(/([a-z\d])([A-Z])/g, '$1_$2')), p.home ?? null, p.away ?? null]);
    } else rest[k] = v;
  }
  return { rows, rest: Object.keys(rest).length ? rest : null };
}

/** UX-025: Monte Carlo probabilities `{market: {outcome: p}}` (or flat `{outcome: p}`) as small tables. */
export function probabilityTables(p: unknown): { market: string; rows: { outcome: string; probability: number }[] }[] {
  const groups = new Map<string, { outcome: string; probability: number }[]>();
  const add = (market: string, outcome: string, v: number) => groups.set(market, [...(groups.get(market) ?? []), { outcome: humanize(outcome), probability: v }]);
  if (!p || typeof p !== 'object') return [];
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (typeof v === 'number') add('', k, v);
    else if (v && typeof v === 'object') {
      for (const [o, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === 'number') add(humanize(k), o, x);
    }
  }
  return [...groups].map(([market, rows]) => ({ market, rows }));
}
