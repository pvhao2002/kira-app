import {useEffect, useRef} from 'react';
import {API_URL, ApiError, useAuth} from './auth';
import type {PageResponse} from './investmentApi';

export type NotificationResponse = {
  id: number; type: string; module: string; title: string; message: string; severity: string;
  readAt: string | null; deepLink: string | null; createdAt: string;
};

export const notificationErrorMessage = (error: unknown) => error instanceof ApiError && error.code === 'NOTIFICATION_NOT_FOUND'
  ? 'Không tìm thấy thông báo.' : 'Không tải được thông báo. Vui lòng thử lại.';

export function useNotificationApi() {
  const {requestJson} = useAuth();
  const listAll = async () => {
    const items: NotificationResponse[] = [];
    let page = 0;
    let totalPages = 1;
    do {
      const response = await requestJson<PageResponse<NotificationResponse>>(`/api/v1/notifications?page=${page}&size=100`);
      items.push(...response.data);
      totalPages = Math.max(response.meta.totalPages, page + 1);
      page += 1;
    } while (page < totalPages);
    return items;
  };
  return {
    list: (page = 0, size = 50) => requestJson<PageResponse<NotificationResponse>>(`/api/v1/notifications?page=${page}&size=${size}`),
    listAll,
    unreadCount: () => requestJson<{ count: number }>('/api/v1/notifications/unread-count'),
    markRead: (id: number) => requestJson<NotificationResponse>(`/api/v1/notifications/${id}/read`, {method: 'PATCH'}),
    markAllRead: () => requestJson<{ updated: number }>('/api/v1/notifications/read-all', {method: 'PATCH'}),
  };
}

export type NotificationPush = { unreadCount: number; notification: NotificationResponse | null };

/** Server closes with this code when the first frame is not a valid access token. */
const SOCKET_UNAUTHORIZED = 4401;

/**
 * Live unread count over /api/v1/ws/notifications while `enabled`. The access token is the first frame (no header on a
 * WebSocket handshake); reconnects with backoff and whenever the session's token changes.
 */
export function useNotificationSocket(enabled: boolean, onPush: (push: NotificationPush) => void) {
  const {session, requestJson} = useAuth();
  const token = session?.accessToken;
  const handler = useRef(onPush);
  handler.current = onPush;
  useEffect(() => {
    if (!enabled || !token) return;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry = 0;
    let stopped = false;
    const connect = () => {
      const current = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/api/v1/ws/notifications`);
      socket = current;
      current.onopen = () => current.send(token);
      current.onmessage = event => {
        retry = 0;
        try {
          handler.current(JSON.parse(event.data));
        } catch { /* ignore malformed frames */
        }
      };
      current.onclose = event => {
        if (stopped) return;
        // A rejected token is refreshed by requestJson's 401 path; the new token re-runs this effect.
        if (event.code === SOCKET_UNAUTHORIZED) requestJson('/api/v1/notifications/unread-count').catch(() => {
        });
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [enabled, token]);
}
