'use client';

/**
 * Browser-side calls to our own `/api/notifications` proxy routes. Same
 * session-cookie pattern as the application client: tokens never reach JS.
 */
import {ApiError, type ErrorEnvelope} from '../api-client';
import type {NotificationPage, NotificationResponse} from './notifications';

async function notificationRequest<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {...init, cache: 'no-store'});
  } catch {
    throw new ApiError(0, null, 'Cannot reach the server.');
  }
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const envelope = data && typeof data === 'object' ? (data as ErrorEnvelope) : null;
    throw new ApiError(res.status, envelope, 'Notification request failed.');
  }
  return data as T;
}

export function listNotifications(options: {unreadOnly?: boolean; page?: number; size?: number} = {}) {
  const params = new URLSearchParams();
  if (options.unreadOnly) params.set('unreadOnly', 'true');
  if (options.page !== undefined) params.set('page', String(options.page));
  if (options.size !== undefined) params.set('size', String(options.size));
  const qs = params.toString();
  return notificationRequest<NotificationPage>(`/api/notifications${qs ? `?${qs}` : ''}`, {method: 'GET'});
}

export function getUnreadCount() {
  return notificationRequest<{unreadCount: number}>('/api/notifications/unread-count', {method: 'GET'});
}

export function markNotificationRead(id: string) {
  return notificationRequest<NotificationResponse>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  });
}

export function markAllNotificationsRead() {
  return notificationRequest<{markedRead: number}>('/api/notifications/read-all', {method: 'POST'});
}
