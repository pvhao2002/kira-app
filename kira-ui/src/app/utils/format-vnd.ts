/** Parse display string like "50.000.000" or "50000000" to number. */
export function parseVndInput(raw: string): number {
  const s = (raw ?? '').replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '').trim();
  if (!s) {
    return 0;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 0}).format(Math.round(n));
}
