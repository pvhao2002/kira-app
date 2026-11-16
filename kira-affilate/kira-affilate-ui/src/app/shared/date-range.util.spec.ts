import {addDays, presetRange, vnDate} from './date-range.util';

describe('date-range presets (Asia/Ho_Chi_Minh)', () => {
  // 2026-11-16 18:30 UTC is already 2026-11-17 01:30 in Vietnam.
  const now = new Date('2026-11-16T18:30:00Z');

  it('uses the Vietnam calendar day, not UTC', () => {
    expect(vnDate(now)).toBe('2026-11-17');
    expect(vnDate(new Date('2026-11-16T16:59:59Z'))).toBe('2026-11-16');
  });

  it('computes inclusive presets', () => {
    expect(presetRange('today', now)).toEqual({from: '2026-11-17', to: '2026-11-17'});
    expect(presetRange('7d', now)).toEqual({from: '2026-11-11', to: '2026-11-17'});
    expect(presetRange('30d', now)).toEqual({from: '2026-10-19', to: '2026-11-17'});
    expect(presetRange('month', now)).toEqual({from: '2026-11-01', to: '2026-11-17'});
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(presetRange('7d', new Date('2027-01-02T05:00:00Z'))).toEqual({from: '2026-12-27', to: '2027-01-02'});
  });
});
