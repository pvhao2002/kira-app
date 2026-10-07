import {effect, inject, Injectable, signal} from '@angular/core';
import {AuthStore} from '../auth/auth.store';
import {ToastService} from './toast.service';

interface NotificationPush {
  unreadCount: number;
  notification: {title: string} | null;
}

/** Server closes with this code when the first frame is not a valid access token. */
const UNAUTHORIZED = 4401;

/**
 * Live unread count and a toast for new notifications. The access token is sent as the first frame because a
 * browser WebSocket cannot carry an Authorization header. Reconnects with backoff and on every token change.
 */
@Injectable({providedIn: 'root'})
export class NotificationSocketService {
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly unreadState = signal(0);
  readonly unread = this.unreadState.asReadonly();
  private socket: WebSocket | null = null;
  private retry = 0;
  private retryTimer: number | undefined;

  constructor() {
    effect(() => {
      const token = this.auth.token();
      this.disconnect();
      if (token) this.connect(token);
      else this.unreadState.set(0);
    });
  }

  private connect(token: string): void {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}/api/v1/ws/notifications`);
    this.socket = socket;
    socket.onopen = () => socket.send(token);
    socket.onmessage = event => {
      this.retry = 0;
      const push = JSON.parse(event.data) as NotificationPush;
      this.unreadState.set(push.unreadCount);
      if (push.notification) this.toast.show(push.notification.title);
    };
    socket.onclose = event => {
      if (this.socket !== socket) return; // replaced or closed on purpose
      this.socket = null;
      const delay = Math.min(30_000, 1_000 * 2 ** this.retry++);
      this.retryTimer = window.setTimeout(() => {
        // A rejected token is refreshed; the effect above reconnects with the new one.
        if (event.code === UNAUTHORIZED) this.auth.refresh().subscribe({error: () => undefined});
        else if (this.auth.token()) this.connect(this.auth.token()!);
      }, delay);
    };
  }

  private disconnect(): void {
    window.clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}
