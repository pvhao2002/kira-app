import {ApiError, useAuth} from './auth';
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
