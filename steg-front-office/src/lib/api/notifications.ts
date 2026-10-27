/**
 * Typed backend DTOs and server-side calls for the notification module
 * (contract: backend NotificationController — NotificationResponse, Spring
 * Page envelope). Every query is scoped to the caller's own IN_APP
 * deliveries server-side; a user can never see another user's items.
 */
import {backendFetch} from '../api-client';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface NotificationResponse {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  read: boolean;
  readAt: string | null;
}

export interface NotificationPage {
  content: NotificationResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export function listNotifications(
  token: string,
  options: {unreadOnly?: boolean; page?: number; size?: number} = {},
) {
  const params = new URLSearchParams();
  if (options.unreadOnly) params.set('unreadOnly', 'true');
  params.set('page', String(options.page ?? 0));
  params.set('size', String(Math.min(options.size ?? 20, 50)));
  params.set('sort', 'createdAt,desc');
  return backendFetch<NotificationPage>(`/api/notifications?${params.toString()}`, {
    method: 'GET',
    token,
  });
}

export function getUnreadCount(token: string) {
  return backendFetch<{unreadCount: number}>('/api/notifications/unread-count', {
    method: 'GET',
    token,
  });
}

export function markNotificationRead(token: string, id: string) {
  return backendFetch<NotificationResponse>(`/api/notifications/${id}/read`, {
    method: 'POST',
    token,
  });
}

export function markAllNotificationsRead(token: string) {
  return backendFetch<{markedRead: number}>('/api/notifications/read-all', {
    method: 'POST',
    token,
  });
}
