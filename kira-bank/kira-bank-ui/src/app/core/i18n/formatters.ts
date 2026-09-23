/**
 * Intl constructors are expensive and these formatters run from templates, once per
 * row per change-detection pass. Options objects are small and repeat, so cache on them.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

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
