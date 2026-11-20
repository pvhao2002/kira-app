import { describe, expect, it } from 'vitest';
import {
  basisNote, extraStatRows, humanize, lineSplit, lineText, pickText, probabilityTables, resultChanges, settlementSentence,
} from './format';

describe('one AH line convention (UX-008)', () => {
  it('prints the decimal line even when the agent sent a split display', () => {
    expect(lineText('AH', -0.25, '0/-0.5')).toBe('-0.25');
    expect(lineText('AH', 0.25)).toBe('+0.25');
    expect(lineText('OU', 2.5, '2.5')).toBe('2.5');
    expect(lineText('AH', null, '0/-0.5')).toBe('0/-0.5');   // no number: the display is all there is
    expect(lineText('AH', null)).toBe('—');
    expect(pickText('AH', 'HOME', -0.25, '0/-0.5')).toBe('AH HOME -0.25');
    expect(pickText('1X2', 'DRAW', null)).toBe('1X2 · DRAW');
  });

  it('explains quarter lines as their two halves in the tooltip', () => {
    expect(lineSplit('AH', -0.25)).toBe('0/-0.5');
    expect(lineSplit('AH', 0.75)).toBe('+0.5/+1');
    expect(lineSplit('CORNER_AH', -1.25)).toBe('-1/-1.5');
    expect(lineSplit('OU', 2.25)).toBe('2/2.5');
    expect(lineSplit('AH', -0.5)).toBe('');
    expect(lineSplit('AH', null)).toBe('');
  });
});

describe('remaining-match note (UX-095)', () => {
  it('says the pick counts goals after the capture minute and score', () => {
    expect(basisNote('REMAINING_MATCH', 'OU', 1, 0, 55)).toBe("Goals after 55' from 1–0");
    expect(basisNote('REMAINING_MATCH', 'CORNER_OU', 3, 2, null)).toBe('Corners after capture from 3–2');
    expect(basisNote('FULL_MATCH', 'OU', 1, 0, 55)).toBe('');
    expect(basisNote(null, 'OU', null, null, null)).toBe('');
  });
});

describe('settlement sentence (UX-004)', () => {
  it('explains a quarter-line AH on the remaining match', () => {
    const d = { market: 'AH', pick: 'HOME', line: -0.25, settlementBasis: 'REMAINING_MATCH', matchStatus: 'FINISHED',
      finalScore: '2-1', atCapture: '1-0', basisScore: '1-1',
      legs: [{ line: 0, margin: 0, result: 'PUSH' }, { line: -0.5, margin: -0.5, result: 'LOSS' }] };
    expect(settlementSentence(d, 'HALF_LOSS')).toBe(
      'AH HOME -0.25 on the remaining match from 1–0: final 2–1, so 1–1 counts. '
      + 'Quarter line split: 0 (margin 0, push) and -0.5 (margin -0.5, loss) → Half loss.');
  });

  it('explains a full-match line, a 1X2 pick, a cancelled match and an override', () => {
    expect(settlementSentence({ market: 'OU', pick: 'OVER', line: 2.5, settlementBasis: 'FULL_MATCH', matchStatus: 'FINISHED',
      finalScore: '2-1', basisScore: '2-1', legs: [{ line: 2.5, margin: 0.5, result: 'WIN' }] }, 'WIN'))
      .toBe('OU OVER 2.5 on the full match: final 2–1. Margin 0.5 → Win.');
    expect(settlementSentence({ market: '1X2', pick: 'HOME', settlementBasis: 'FULL_MATCH', matchStatus: 'FINISHED',
      finalScore: '0-1', basisScore: '0-1', outcome1x2: 'AWAY' }, 'LOSS'))
      .toBe('1X2 · HOME on the full match: final 0–1. Outcome Away → Loss.');
    expect(settlementSentence({ market: 'OU', pick: 'OVER', line: 2.5, matchStatus: 'CANCELLED' }, 'VOID'))
      .toBe('OU OVER 2.5: match cancelled → Void.');
    expect(settlementSentence({ market: 'OU', pick: 'OVER', line: 2.5, settlementBasis: 'FULL_MATCH', matchStatus: 'FINISHED',
      finalScore: '1-1', basisScore: '1-1', legs: [{ line: 2.5, margin: -0.5, result: 'LOSS' }], engineResult: 'LOSS', overriddenTo: 'WIN' }, 'WIN'))
      .toBe('OU OVER 2.5 on the full match: final 1–1. Margin -0.5 → Loss. Admin override: Loss set to Win.');
  });

  it('explains a pick that went back to pending', () => {
    expect(settlementSentence({ market: 'OU', pick: 'OVER', line: 2.5, matchStatus: 'LIVE', previousResult: 'WIN' }, 'PENDING'))
      .toBe('OU OVER 2.5: match is Live again → Pending (was Win).');
  });
});

describe('match result history rows (UX-003, UX-105)', () => {
  it('shows only changed fields, with score pairs merged and audit fields left out', () => {
    const before = { status: 'LIVE', finalHomeScore: null, finalAwayScore: null, htHomeScore: 1, htAwayScore: 0,
      finalHomeCorners: null, finalAwayCorners: null, htHomeCorners: null, htAwayCorners: null };
    const after = { ...before, status: 'FINISHED', finalHomeScore: 2, finalAwayScore: 1,
      resultAt: '2026-11-20T10:00:00Z', changedBy: 'admin', reason: 'typo', requestId: 'r1' };
    expect(resultChanges(before, after)).toEqual([
      { field: 'Status', before: 'Live', after: 'Finished' },
      { field: 'Final score', before: '—', after: '2–1' },
    ]);
  });

  it('shows a kick-off move', () => {
    const rows = resultChanges({ startTime: '2026-12-01T19:00:00Z', status: 'POSTPONED' }, { startTime: '2026-12-08T19:00:00Z', status: 'SCHEDULED' });
    expect(rows.map((r: { field: string }) => r.field)).toEqual(['Kick-off', 'Status']);
    expect(rows[1]).toEqual({ field: 'Status', before: 'Postponed', after: 'Scheduled' });
  });
});

describe('stats and Monte Carlo tables (UX-025)', () => {
  it('turns home/away extras into stat rows and keeps the rest as JSON', () => {
    expect(extraStatRows({ dangerousAttacks: { home: 41, away: 22 }, bigChances: { home: 3 }, note: 'rain' })).toEqual({
      rows: [['Dangerous attacks', 41, 22], ['Big chances', 3, null]], rest: { note: 'rain' } });
    expect(extraStatRows(null)).toEqual({ rows: [], rest: null });
  });

  it('groups probabilities by market', () => {
    expect(probabilityTables({ '1X2': { HOME: 0.5, DRAW: 0.3, AWAY: 0.2 }, OU_2_5: { OVER: 0.55, UNDER: 0.45 }, bad: 'x' })).toEqual([
      { market: '1X2', rows: [{ outcome: 'Home', probability: 0.5 }, { outcome: 'Draw', probability: 0.3 }, { outcome: 'Away', probability: 0.2 }] },
      { market: 'OU 2 5', rows: [{ outcome: 'Over', probability: 0.55 }, { outcome: 'Under', probability: 0.45 }] },
    ]);
    expect(probabilityTables({ HOME: 0.5 })).toEqual([{ market: '', rows: [{ outcome: 'Home', probability: 0.5 }] }]);
    expect(probabilityTables(null)).toEqual([]);
  });

  it('labels markets as AH, OU, Corner OU, Corner AH (UX-007)', () => {
    expect(['AH', 'OU', 'CORNER_OU', 'CORNER_AH'].map(humanize)).toEqual(['AH', 'OU', 'Corner OU', 'Corner AH']);
  });
});
