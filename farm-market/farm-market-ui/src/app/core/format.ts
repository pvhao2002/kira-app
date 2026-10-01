/** Format an integer VND amount as "₫45.000". Money is always integer VND. */
export const vnd = (n: number): string => '₫' + Math.round(n).toLocaleString('vi-VN');

/** Compact millions, e.g. 18_400_000 -> "₫18,4tr". */
export const vndMillions = (n: number): string =>
  '₫' + (n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '') + 'tr';

export const num = (n: number): string => n.toLocaleString('vi-VN');
