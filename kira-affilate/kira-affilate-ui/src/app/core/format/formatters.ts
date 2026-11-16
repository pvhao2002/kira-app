/**
 * Intl constructors are expensive and these formatters run from templates, once per
 * row per change-detection pass. Options objects are small and repeat, so cache on them.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

export const LOCALE = 'vi-VN';
export const VN_TZ = 'Asia/Ho_Chi_Minh';
const NONE = '—';

export function numberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${options ? JSON.stringify(options) : ''}`;
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, format = new Intl.NumberFormat(locale, options));
  return format;
}

export function dateFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${options ? JSON.stringify(options) : ''}`;
  let format = dateFormats.get(key);
  if (!format) dateFormats.set(key, format = new Intl.DateTimeFormat(locale, options));
  return format;
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return NONE;
  return numberFormat(LOCALE, {style: 'currency', currency: 'VND', maximumFractionDigits: 0}).format(Number(amount));
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return NONE;
  return numberFormat(LOCALE, {maximumFractionDigits: 2}).format(Number(value));
}

/** Shopee sends commission rates as a decimal fraction string ("0.05" = 5%). */
export function formatRate(rate: string | number | null | undefined): string {
  const value = rate == null || rate === '' ? NaN : Number(rate);
  if (!Number.isFinite(value)) return NONE;
  return `${numberFormat(LOCALE, {maximumFractionDigits: 2}).format(value * 100)}%`;
}

function vnParts(date: Date): Record<string, string> {
  const parts = dateFormat('en-GB', {
    timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

function toDate(value: string | number | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** dd/MM/yyyy in Vietnam time. */
export function formatDate(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return NONE;
  const p = vnParts(date);
  return `${p['day']}/${p['month']}/${p['year']}`;
}

/** dd/MM/yyyy HH:mm in Vietnam time. */
export function formatDateTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return NONE;
  const p = vnParts(date);
  return `${p['day']}/${p['month']}/${p['year']} ${p['hour']}:${p['minute']}`;
}

export function formatUnixSeconds(seconds: number | null | undefined): string {
  return seconds == null ? NONE : formatDate(new Date(seconds * 1000).toISOString());
}
