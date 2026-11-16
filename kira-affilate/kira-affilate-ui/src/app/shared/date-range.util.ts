import {dateFormat, VN_TZ} from '../core/format/formatters';

export type RangePreset = 'today' | '7d' | '30d' | 'month' | 'custom';

/** Inclusive yyyy-MM-dd bounds, interpreted by the API in Asia/Ho_Chi_Minh. */
export interface DateRange {
  from: string;
  to: string;
}

/** The calendar day in Vietnam for an instant, as yyyy-MM-dd. */
export function vnDate(now: Date = new Date()): string {
  return dateFormat('en-CA', {timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
}

export function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function presetRange(preset: Exclude<RangePreset, 'custom'>, now: Date = new Date()): DateRange {
  const to = vnDate(now);
  switch (preset) {
    case 'today':
      return {from: to, to};
    case '7d':
      return {from: addDays(to, -6), to};
    case '30d':
      return {from: addDays(to, -29), to};
    case 'month':
      return {from: `${to.slice(0, 8)}01`, to};
  }
}
