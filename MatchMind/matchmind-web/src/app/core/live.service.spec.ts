import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '../shared/kit';
import { LiveService, parseSse } from './live.service';

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

const user = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const event = (n: number) =>
  `event:prediction\ndata:${JSON.stringify({ predictionId: `p${n}`, matchId: 'm', homeTeam: 'A', awayTeam: 'B', model: 'gpt', predictionType: 'LIVE' })}\n\n`;

/** An SSE response that sends `chunks`, then stays open, or ends after `closeAfterMs` like a server-side close. */
function sse(chunks: string[], closeAfterMs?: number): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(c) {
      for (const x of chunks) c.enqueue(new TextEncoder().encode(x));
      if (closeAfterMs !== undefined) setTimeout(() => c.close(), closeAfterMs);
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('LiveService (UX-049)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.setItem('matchmind.session',
      JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user }));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => {
    TestBed.resetTestingModule(); // aborts the stream
    vi.unstubAllGlobals();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  function start() {
    const live = TestBed.inject(LiveService);
    let refreshes = 0;
    live.refresh.subscribe(() => refreshes++);
    TestBed.tick();
    return { live, refreshes: () => refreshes, toasts: TestBed.inject(ToastService).toasts };
  }

  it('coalesces a burst of new predictions into one reload and one toast', async () => {
    fetchMock.mockResolvedValue(sse([event(1), event(2), event(3)]));
    const s = start();
    await vi.advanceTimersByTimeAsync(100);
    expect(s.refreshes()).toBe(0); // trailing: waits for the burst to settle
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.refreshes()).toBe(1);
    expect(s.toasts().map(t => t.summary)).toEqual(['3 new predictions']);
  });

  it('keeps the single-prediction toast for one event', async () => {
    fetchMock.mockResolvedValue(sse([event(1)]));
    const s = start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.toasts().map(t => [t.summary, t.detail])).toEqual([['New prediction', 'A – B, by gpt']]);
  });

  it('reconnects at once when the server ends the stream (30 min lifetime), then reloads once', async () => {
    fetchMock.mockResolvedValueOnce(sse([], 30 * 60_000)).mockResolvedValue(sse([]));
    const s = start();
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.refreshes()).toBe(1);
  });

  it('backs off when a stream ends right after opening (no tight reconnect loop)', async () => {
    fetchMock.mockResolvedValueOnce(sse([], 0)).mockResolvedValue(sse([]));
    start();
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('backs off after failures instead of hammering the server', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    start();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2); // second wait is longer
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
