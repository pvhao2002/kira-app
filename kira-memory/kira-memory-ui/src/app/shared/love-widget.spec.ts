import {Message} from '../core/api';
import {byDay} from './love-widget';

/** Local device time, like the widget shows it. */
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString();
const msg = (id: number, createdAt: string): Message => ({id, author: 'love', authorName: 'Em', body: 'hi', createdAt});
const NOW = new Date(2026, 10, 26, 20, 0).getTime();

describe('byDay', () => {
  it('labels only the first message of each day', () => {
    const rows = byDay([msg(1, at(24, 9)), msg(2, at(24, 22)), msg(3, at(25, 8)), msg(4, at(26, 7)), msg(5, at(26, 19))], NOW);
    expect(rows.map(r => r.day !== null)).toEqual([true, false, true, true, false]);
  });

  it('says today and yesterday in words, other days as a date', () => {
    const [older, yesterday, today] = byDay([msg(1, at(24, 9)), msg(2, at(25, 9)), msg(3, at(26, 9))], NOW);
    expect(today.day).toBe('Hôm nay');
    expect(yesterday.day).toBe('Hôm qua');
    expect(older.day).toContain('24/11/2026');
  });

  it('handles an empty list', () => {
    expect(byDay([], NOW)).toEqual([]);
  });
});
