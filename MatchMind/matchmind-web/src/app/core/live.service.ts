import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable, Subject, auditTime } from 'rxjs';
import { ToastService } from '../shared/kit';
import { API } from './api.service';
import { AuthService } from './auth.service';

/** What the server announces when an AI agent has stored a new prediction. */
export interface NewPrediction {
  predictionId: string; matchId: string; homeTeam: string; awayTeam: string; model: string; predictionType: string;
}

interface SseEvent { event: string; data: string; }

const RETRY_MS = 3000;
const MAX_RETRY_MS = 60_000;
/** A stream that lived this long and then ended was closed on purpose (30 min server lifetime): reconnect at once. */
const HEALTHY_STREAM_MS = 60_000;
/** Reloads and toasts wait this long after an event, so a burst of agent imports costs one reload and one toast. */
const COALESCE_MS = 1500;

/** Splits a Server-Sent Events buffer into complete events; `rest` is the unfinished tail to prepend to the next chunk. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (data.length) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

/** Waits `ms`, or less when the browser reports it is back online. */
function pause(ms: number): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); removeEventListener('online', done); resolve(); };
    const timer = setTimeout(done, ms);
    addEventListener('online', done, { once: true });
  });
}

/**
 * Listens to the server's prediction stream while someone is signed in. Uses fetch rather than EventSource so the JWT
 * goes in the Authorization header, never in a URL that proxies log. Reconnects after a drop or the server's timeout.
 * The stream is closed while the tab is hidden (no idle connection, no toast pile-up) and pages reload when it is back.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  /** Emits once per new prediction; pages reload their data from it. */
  readonly predictions = new Subject<NewPrediction>();
  private readonly reload = new Subject<void>();
  /**
   * Emits when pages should reload: after new predictions, and after the stream reconnects (events may have been missed).
   * At most once per COALESCE_MS (trailing), so a burst of events costs one /dashboard or /predictions fetch.
   */
  readonly refresh: Observable<void> = this.reload.pipe(auditTime(COALESCE_MS));
  /** Predictions announced but not yet toasted; flushed as one toast after COALESCE_MS. */
  private unannounced: NewPrediction[] = [];

  private readonly visible = signal(!document.hidden);
  /** True once events may have been missed (tab was hidden), so the next connect asks pages to reload. */
  private missed = false;

  constructor() {
    // This service lives as long as the app, so these listeners need no removal.
    document.addEventListener('visibilitychange', () => this.visible.set(!document.hidden));
    addEventListener('offline', () => this.toasts.add({ severity: 'warn', summary: 'You are offline', detail: 'Live updates resume when the connection returns.' }));
    addEventListener('online', () => this.toasts.add({ severity: 'success', summary: 'Back online' }));
    effect(onCleanup => {
      const token = this.auth.token();
      if (!token) return;
      if (!this.visible()) { this.missed = true; return; }
      const stop = new AbortController();
      onCleanup(() => stop.abort()); // sign-out, a new token or a hidden tab ends this stream
      const resumed = this.missed;
      this.missed = false;
      void this.listen(token, stop.signal, resumed);
    });
  }

  private async listen(token: string, abort: AbortSignal, resumed: boolean): Promise<void> {
    let dropped = resumed;
    let backoff = RETRY_MS;
    while (!abort.aborted) {
      let wait = backoff;
      try {
        const res = await fetch(`${API}/events/predictions`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: abort,
        });
        if (res.status === 401) { this.auth.expire(); return; }
        if (res.ok && res.body) {
          const opened = Date.now();
          if (dropped) this.reload.next();
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
            const parsed = parseSse(buffer + chunk.value);
            buffer = parsed.rest;
            for (const e of parsed.events) if (e.event === 'prediction') this.announce(JSON.parse(e.data) as NewPrediction);
          }
          // The server ended a stream that had been healthy (its lifetime cap): reconnect now and start backoff over.
          if (Date.now() - opened >= HEALTHY_STREAM_MS) { wait = 0; backoff = RETRY_MS; }
        }
      } catch { /* network drop, bad event or sign-out: retry below unless aborted */ }
      dropped = true;
      // 429 TOO_MANY_STREAMS, 5xx or repeated drops: wait longer each time, up to a minute.
      if (wait) backoff = Math.min(backoff * 2, MAX_RETRY_MS);
      await pause(wait);
    }
  }

  private announce(p: NewPrediction): void {
    this.predictions.next(p);
    this.reload.next();
    if (this.unannounced.push(p) === 1) setTimeout(() => this.toastUnannounced(), COALESCE_MS);
  }

  private toastUnannounced(): void {
    const list = this.unannounced;
    this.unannounced = [];
    const last = list[list.length - 1];
    const detail = `${last.homeTeam} – ${last.awayTeam}, by ${last.model}`;
    this.toasts.add(list.length === 1
      ? { severity: 'info', summary: 'New prediction', detail }
      : { severity: 'info', summary: `${list.length} new predictions`, detail: `Latest: ${detail}` });
  }
}
