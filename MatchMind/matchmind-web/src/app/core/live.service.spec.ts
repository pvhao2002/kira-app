import { describe, expect, it } from 'vitest';
import { parseSse } from './live.service';

describe('parseSse', () => {
  it('returns complete events and keeps an unfinished tail for the next chunk', () => {
    const first = parseSse(':connected\n\nevent:prediction\ndata:{"predictionId":"p1"}\n\nevent:predic');
    expect(first.events).toEqual([{ event: 'prediction', data: '{"predictionId":"p1"}' }]);
    expect(first.rest).toBe('event:predic');

    const second = parseSse(first.rest + 'tion\r\ndata: {"a":1}\r\ndata: {"b":2}\r\n\r\n');
    expect(second.events).toEqual([{ event: 'prediction', data: '{"a":1}\n{"b":2}' }]);
    expect(second.rest).toBe('');
  });

  it('skips comment-only heartbeats', () => {
    expect(parseSse(':ping\n\n').events).toEqual([]);
  });
});
