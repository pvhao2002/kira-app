import Decimal from 'decimal.js';

/**
 * OddConverter.convertLine: "+0.5", "-1/1.5", "2.5" -> Decimal (average of the two halves for split lines).
 * Decimal keeps quarter lines exact, so push detection never depends on float rounding. Throws on bad input.
 */
export function convertLine(line) {
  let s = line.trim();
  let sign = 1;
  if (s.startsWith('+')) {
    s = s.slice(1);
  } else if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 2) return new Decimal(parts[0]).plus(new Decimal(parts[1])).div(2).times(sign);
    throw new Error(`Invalid line format: ${s}`);
  }
  return new Decimal(s).times(sign);
}
