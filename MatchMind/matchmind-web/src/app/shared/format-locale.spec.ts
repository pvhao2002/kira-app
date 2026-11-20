import { describe, expect, it } from 'vitest';
import { bidiSafe, cell, changedFields, fmtDateTime, fmtShort, tzLabel } from './format';

describe('date format (UX-021, UX-112)', () => {
  it('uses one fixed English locale (day month year, 24-hour) whatever the browser locale', () => {
    // Midday UTC: the calendar day is the same in every time zone from UTC-11 to UTC+11.
    expect(fmtDateTime('2026-12-29T12:00:00Z')).toMatch(/^29 Dec 2026, \d\d:\d\d$/);
    expect(fmtShort('2026-12-29T12:00:00Z')).toMatch(/^29 Dec, \d\d:\d\d$/);
    expect(fmtDateTime(null)).toBe('—');
  });

  it('labels the time zone times are shown in', () => {
    expect(tzLabel(new Date('2026-12-29T12:00:00Z'), 'Asia/Bangkok')).toBe('GMT+7');
    expect(tzLabel(new Date('2026-12-29T12:00:00Z'), 'UTC')).toMatch(/^GMT(\+0)?$/);   // ICU builds differ
    expect(tzLabel()).toMatch(/^GMT/);
  });
});

describe('BiDi isolation (UX-030)', () => {
  it('wraps agent text that carries BiDi controls in an isolate; plain text is untouched', () => {
    expect(bidiSafe('Arsenal')).toBe('Arsenal');
    expect(bidiSafe('\u202Elanesra')).toBe('\u2068\u202Elanesra\u2069');
    expect(bidiSafe(null)).toBe('—');
  });

  it('report text cells and change history are isolated', () => {
    expect(cell({ team: 'A\u202EB' }, { field: 'team', header: '' })).toBe('\u2068A\u202EB\u2069');
    expect(changedFields({ name: 'x' }, { name: 'y\u202E' })[0].after).toBe('\u2068y\u202E\u2069');
  });
});
