import { Injectable, effect, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { ToastService } from '../shared/kit';
import { API } from './api.service';
import { AuthService } from './auth.service';

/** What the server announces when an AI agent has stored a new prediction. */
export interface NewPrediction {
  predictionId: string; matchId: string; homeTeam: string; awayTeam: string; model: string; predictionType: string;
}

interface SseEvent { event: string; data: string; }

const RETRY_MS = 3000;

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

/**
 * Listens to the server's prediction stream while someone is signed in. Uses fetch rather than EventSource so the JWT
 * goes in the Authorization header, never in a URL that proxies log. Reconnects after a drop or the server's timeout.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  /** Emits once per new prediction; pages reload their data from it. */
  readonly predictions = new Subject<NewPrediction>();

  constructor() {
    effect(onCleanup => {
      const token = this.auth.token();
      if (!token) return;
      const stop = new AbortController();
      onCleanup(() => stop.abort()); // sign-out or a new token ends this stream
      void this.listen(token, stop.signal);
    });
  }

  private async listen(token: string, abort: AbortSignal): Promise<void> {
    while (!abort.aborted) {
      try {
        const res = await fetch(`${API}/events/predictions`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: abort,
        });
        if (res.status === 401) { this.auth.expire(); return; }
        if (res.ok && res.body) {
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
            const parsed = parseSse(buffer + chunk.value);
            buffer = parsed.rest;
            for (const e of parsed.events) if (e.event === 'prediction') this.announce(JSON.parse(e.data) as NewPrediction);
          }
        }
      } catch { /* network drop, bad event or sign-out: retry below unless aborted */ }
      await new Promise(resolve => setTimeout(resolve, RETRY_MS));
    }
  }

  private announce(p: NewPrediction): void {
    this.predictions.next(p);
    this.toasts.add({ severity: 'info', summary: 'New prediction', detail: `${p.homeTeam} – ${p.awayTeam}, by ${p.model}` });
  }
}
