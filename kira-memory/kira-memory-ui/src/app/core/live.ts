import {DestroyRef, inject, Injectable, signal} from '@angular/core';
import {tap} from 'rxjs';
import {Api, Message, WidgetShape} from './api';
import {AuthStore} from './auth';

/** The server's page size for GET /api/messages. */
const PAGE = 50;

/** Both lists by id, oldest first; a message that arrives twice (page, live push, catch-up) is kept once. */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map(m => [m.id, m]));
  for (const m of incoming) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * The realtime side: one EventSource per tab for new messages and settings changes,
 * plus the "ting ting" and the unread count in the tab title while the tab is hidden.
 */
@Injectable({providedIn: 'root'})
export class Live {
  private api = inject(Api);
  private auth = inject(AuthStore);
  readonly messages = signal<Message[]>([]);
  readonly shape = signal<WidgetShape>('heart');
  readonly unread = signal(0);
  /** The last page was full, so older messages may exist. */
  readonly hasOlder = signal(false);
  readonly panelOpen = signal(false);
  private source: EventSource | null = null;
  private audio: AudioContext | null = null;
  private hiddenUnread = 0;
  private readonly baseTitle = document.title;

  constructor() {
    // Browsers only allow sound after a user gesture; unlock it on the first one.
    const unlock = () => {
      this.audio ??= new AudioContext();
      void this.audio.resume();
    };
    window.addEventListener('pointerdown', unlock, {once: true});
    window.addEventListener('keydown', unlock, {once: true});
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.hiddenUnread = 0;
        document.title = this.baseTitle;
        if (this.panelOpen()) this.unread.set(0);
      }
    });
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  connect() {
    if (this.source) return;
    this.api.settings().subscribe(s => this.shape.set(s.widgetShape));
    this.api.messages().subscribe(list => {
      this.messages.update(current => mergeMessages(current, list));
      this.hasOlder.set(list.length === PAGE);
    });
    this.source = new EventSource('/api/events');
    this.source.addEventListener('message', e => this.receive(JSON.parse((e as MessageEvent).data) as Message));
    this.source.addEventListener('settings', e => this.shape.set(JSON.parse((e as MessageEvent).data).widgetShape));
    // After a reconnect, fetch what was missed while the stream was down.
    this.source.addEventListener('ready', () => {
      if (this.messages().length) this.api.messages().subscribe(list => this.messages.update(current => mergeMessages(current, list)));
    });
  }

  disconnect() {
    this.source?.close();
    this.source = null;
    this.messages.set([]);
    this.hasOlder.set(false);
    this.unread.set(0);
  }

  /** The page before the oldest message shown. */
  loadOlder() {
    return this.api.messages(this.messages()[0]?.id).pipe(tap(list => {
      this.messages.update(current => mergeMessages(current, list));
      this.hasOlder.set(list.length === PAGE);
    }));
  }

  send(body: string) {
    return this.api.sendMessage(body);
  }

  add(m: Message) {
    if (this.messages().some(x => x.id === m.id)) return false;
    this.messages.update(list => mergeMessages(list, [m]));
    return true;
  }

  open(open: boolean) {
    this.panelOpen.set(open);
    if (open) this.unread.set(0);
  }

  private receive(m: Message) {
    if (!this.add(m) || m.author === this.auth.user()?.username) return;
    if (!this.panelOpen() || document.hidden) this.unread.update(n => n + 1);
    if (document.hidden) {
      this.hiddenUnread++;
      document.title = `(${this.hiddenUnread}) 💌 Tin nhắn mới`;
      this.ting();
    }
  }

  /** Two short bell notes, synthesised so no audio file is needed. */
  private ting() {
    const ctx = this.audio;
    if (!ctx || ctx.state !== 'running') return;
    for (const at of [0, 0.22]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1568;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    }
  }
}
