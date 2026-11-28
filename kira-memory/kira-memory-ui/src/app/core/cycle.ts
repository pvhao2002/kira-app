import {addDays, daysBetween, parseDay, Ymd} from './since';

export const PERIOD_DAYS = 5;
export const DEFAULT_CYCLE = 28;

export type CycleState =
  | {kind: 'none'}
  | {kind: 'during'; day: number; next: Ymd; length: number}
  | {kind: 'before'; daysLeft: number; next: Ymd; length: number}
  | {kind: 'late'; lateBy: number; next: Ymd; length: number};

/**
 * Where Em is in her cycle, from the logged start days (ISO, any order). The cycle length is the average of the last
 * 6 gaps between starts, leaving out gaps outside 21–45 days (usually a forgotten log), else 28 days.
 */
export function cycleState(starts: readonly string[], today: Ymd): CycleState {
  const days = [...new Set(starts)].sort().reverse().map(parseDay);
  if (!days.length) return {kind: 'none'};
  const gaps = days.slice(1, 7).map((d, i) => daysBetween(d, days[i])).filter(g => g >= 21 && g <= 45);
  const length = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : DEFAULT_CYCLE;
  const next = addDays(days[0], length);
  const since = daysBetween(days[0], today);
  if (since >= 0 && since < PERIOD_DAYS) return {kind: 'during', day: since + 1, next, length};
  const left = daysBetween(today, next);
  return left >= 0 ? {kind: 'before', daysLeft: left, next, length} : {kind: 'late', lateBy: -left, next, length};
}
