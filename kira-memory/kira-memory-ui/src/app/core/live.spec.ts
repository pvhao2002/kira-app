import {Message} from './api';
import {mergeMessages} from './live';

const msg = (id: number, body = `m${id}`): Message =>
  ({id, author: 'admin', authorName: 'Anh', body, createdAt: '2026-11-26T01:00:00Z'});

describe('mergeMessages', () => {
  it('puts an older page in front, oldest first', () => {
    expect(mergeMessages([msg(51), msg(52)], [msg(50), msg(49)]).map(m => m.id)).toEqual([49, 50, 51, 52]);
  });

  it('keeps one copy of a message that arrives twice (page, live push, reconnect catch-up)', () => {
    const merged = mergeMessages([msg(3), msg(4), msg(5)], [msg(5, 'again'), msg(4), msg(6)]);
    expect(merged.map(m => m.id)).toEqual([3, 4, 5, 6]);
    expect(merged.filter(m => m.id === 5)).toHaveLength(1);
  });

  it('returns a new list without touching the inputs', () => {
    const list = [msg(2)];
    const merged = mergeMessages(list, []);
    expect(merged).not.toBe(list);
    expect(merged).toEqual(list);
  });
});
