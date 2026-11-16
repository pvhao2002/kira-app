import {formatDate, formatDateTime, formatNumber, formatRate, formatUnixSeconds, formatVnd} from './formatters';

const plain = (s: string) => s.replace(/\s/g, ' ');

describe('formatters', () => {
  it('formats VND with dot grouping and no decimals', () => {
    expect(plain(formatVnd(1234567))).toBe('1.234.567 ₫');
    expect(plain(formatVnd(1999.6))).toBe('2.000 ₫');
    expect(plain(formatVnd(0))).toBe('0 ₫');
  });

  it('shows a dash for missing values instead of a fake zero', () => {
    expect(formatVnd(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatDateTime(null)).toBe('—');
    expect(formatRate('abc')).toBe('—');
  });

  it('formats instants in Vietnam time, also across the UTC day boundary', () => {
    expect(formatDateTime('2026-11-16T18:30:00Z')).toBe('17/11/2026 01:30');
    expect(formatDate('2026-12-31T17:00:00Z')).toBe('01/01/2027');
    expect(formatDateTime('2026-03-05T02:04:00Z')).toBe('05/03/2026 09:04');
  });

  it('formats Unix seconds in Vietnam time', () => {
    expect(formatUnixSeconds(Date.UTC(2026, 0, 1, 17, 0, 0) / 1000)).toBe('02/01/2026');
    expect(formatUnixSeconds(null)).toBe('—');
  });

  it('formats Shopee commission fractions as percent', () => {
    expect(formatRate('0.05')).toBe('5%');
    expect(formatRate('0.125')).toBe('12,5%');
    expect(formatRate(0.07)).toBe('7%');
  });
});
