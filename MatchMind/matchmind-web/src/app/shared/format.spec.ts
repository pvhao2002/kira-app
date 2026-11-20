import { describe, expect, it } from 'vitest';
import { dayRange, toFilters } from './filter-bar';
import { cell, line, pct, pickLabel, resultSeverity } from './format';
import { sortParam, sortRows } from './kit';

describe('format helpers', () => {
  it('formats probabilities and keeps missing values as a dash', () => {
    expect(pct(0.5234)).toBe('52.3%');
    expect(pct(null)).toBe('—');
    expect(pct(0)).toBe('0.0%');
  });

  it('quotes AH lines for the home side with an explicit plus sign', () => {
    expect(line('AH', 0.25)).toBe('+0.25');
    expect(line('AH', -0.75)).toBe('-0.75');
    expect(line('CORNER_AH', 1)).toBe('+1');
    expect(line('OU', 2.5)).toBe('2.5');
    expect(line('AH', 0.25, '0/0.5')).toBe('0/0.5');
    expect(pickLabel('OU', 'OVER', 2.25)).toBe('OU OVER 2.25');
    expect(pickLabel('1X2', 'HOME')).toBe('1X2 · HOME');
  });

  it('maps half results to the same colour family as full results', () => {
    expect(resultSeverity('HALF_WIN')).toBe('success');
    expect(resultSeverity('HALF_LOSS')).toBe('danger');
    expect(resultSeverity('PENDING')).toBe('warn');
  });

  it('turns a table sort into the backend sort parameter', () => {
    expect(sortParam({ field: 'predictedAt', dir: 'desc' })).toBe('predictedAt,desc');
    expect(sortParam({ field: 'league', dir: 'asc' })).toBe('league,asc');
    expect(sortParam(null)).toBeUndefined();
  });

  it('sorts small report tables in memory with missing values last', () => {
    const rows = [{ k: 'b', v: 0.2 }, { k: 'a', v: null }, { k: 'c', v: 0.9 }];
    expect(sortRows(rows, { field: 'v', dir: 'desc' }).map(r => r.k)).toEqual(['c', 'b', 'a']);
    expect(sortRows(rows, { field: 'v', dir: 'asc' }).map(r => r.k)).toEqual(['b', 'c', 'a']);
    expect(sortRows(rows, { field: 'k', dir: 'asc' }).map(r => r.k)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, null)).toBe(rows);
  });

  it('renders report cells by column kind', () => {
    expect(cell({ winRate: 0.5 }, { field: 'winRate', header: '', kind: 'pct' })).toBe('50.0%');
    expect(cell({ wins: 0 }, { field: 'wins', header: '', kind: 'int' })).toBe('0');
    expect(cell({ key: null }, { field: 'key', header: '' })).toBe('—');
  });
});

describe('report filters', () => {
  it('drops empty values and makes the date range end exclusive (start of the next local day)', () => {
    const f = toFilters({ from: '2026-01-10', to: '2026-01-12', league: '', modelId: null, search: '  Arsenal ', result: 'WIN' });
    expect(f.from).toBe(new Date(2026, 0, 10).toISOString());
    expect(f.to).toBe(new Date(2026, 0, 13).toISOString());
    expect(f.league).toBeUndefined();
    expect(f.modelId).toBeUndefined();
    expect(f.search).toBe('Arsenal');
    expect(f.result).toBe('WIN');
  });

  it('leaves the other end open when only From or only To is set (UX-110)', () => {
    expect(toFilters({ from: '2026-05-01' })).toMatchObject({ from: new Date(2026, 4, 1).toISOString(), to: undefined });
    expect(toFilters({ to: '2026-05-01' })).toMatchObject({ from: undefined, to: new Date(2026, 4, 2).toISOString() });
    expect(toFilters({ from: 'not-a-date' }).from).toBeUndefined();
  });

  it('rejects From after To and accepts a single day (UX-110)', () => {
    expect(dayRange('2026-12-31', '2026-12-01').error).toBe('From must be on or before To.');
    expect(dayRange('2026-12-01', '2026-12-01')).toEqual({
      from: new Date(2026, 11, 1).toISOString(), to: new Date(2026, 11, 2).toISOString() });
  });
});

describe('changedFields', () => {
  it('lists only changed fields, with readable labels and values', async () => {
    const { changedFields } = await import('./format');
    expect(changedFields({ status: 'LIVE', htHomeScore: null, same: 1 }, { status: 'FINISHED', htHomeScore: 1, same: 1 })).toEqual([
      { field: 'Status', before: 'Live', after: 'Finished' },
      { field: 'HT home score', before: '—', after: '1' },
    ]);
  });
});
