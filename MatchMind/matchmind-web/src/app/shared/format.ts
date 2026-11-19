import { PredictionStatsView, SettlementResult } from '../core/models';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const shortDateTime = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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

export function pickLabel(market: string | null | undefined, pick: string | null | undefined, l?: number | null, display?: string | null): string {
  if (!market || !pick) return '—';
  if (market === '1X2') return `1X2 · ${pick}`;
  return `${market.replace('_', ' ')} ${pick} ${line(market, l, display)}`;
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

export function humanize(v: string | null | undefined): string {
  return v ? v.replaceAll('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : '—';
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

export interface Col { field: string; header: string; kind?: 'pct' | 'num' | 'int' | 'date' | 'text'; }

export function cell(row: Record<string, unknown>, c: Col): string {
  const v = row[c.field] as number | string | null | undefined;
  switch (c.kind) {
    case 'pct': return pct(v as number | null);
    case 'num': return num(v as number | null);
    case 'date': return fmtDateTime(v as string | null);
    case 'int': return v === null || v === undefined ? '—' : String(v);
    default: return v === null || v === undefined || v === '' ? '—' : String(v);
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
