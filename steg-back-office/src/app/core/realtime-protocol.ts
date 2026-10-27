import type { BackofficeEvent, RealtimeNotificationPayload } from './realtime.service';

/**
 * Pure realtime-protocol helpers (S9). Extracted from `RealtimeService` so the
 * mapping, backoff math and close-code policy are unit-testable without
 * sockets — the service keeps the identical behavior by delegating here.
 */

export function mapNotificationToEvent(payload: RealtimeNotificationPayload): BackofficeEvent {
  const typeMap: Record<string, BackofficeEvent['type']> = {
    InternshipApplication: 'application',
    ApplicationDocument: 'application',
    Candidate: 'candidate',
    Internship: 'internship',
    InternshipAssignment: 'internship',
    FinanceCase: 'finance',
    PaymentApproval: 'finance',
    AuditLog: 'audit',
    Department: 'department',
    Employee: 'employee',
    Notification: 'notification',
  };
  const t = typeMap[payload.relatedEntityType] || 'unknown';
  return {
    type: t,
    action: 'notification',
    entityId: payload.relatedEntityId,
    payload,
    receivedAt: new Date().toISOString(),
  };
}

export function inferTypeFromDestination(
  dest: string,
  entityType: string,
): BackofficeEvent['type'] {
  if (dest.includes('applications')) return 'application';
  if (dest.includes('candidates')) return 'candidate';
  if (dest.includes('internships')) return 'internship';
  if (dest.includes('finance')) return 'finance';
  if (dest.includes('audit')) return 'audit';
  if (dest.includes('departments')) return 'department';
  if (dest.includes('employees')) return 'employee';
  if (dest.includes('dashboard')) return 'unknown'; // dashboard listens to all
  const map: Record<string, BackofficeEvent['type']> = {
    InternshipApplication: 'application',
    Candidate: 'candidate',
    Internship: 'internship',
    FinanceCase: 'finance',
  };
  return map[entityType] || 'unknown';
}

/** Parsed typed payload, or null when the frame body is not JSON (never throws). */
export function parseNotificationPayload(body: string): RealtimeNotificationPayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<RealtimeNotificationPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      notificationId: String(parsed.notificationId ?? ''),
      title: String(parsed.title ?? ''),
      message: String(parsed.message ?? ''),
      priority: String(parsed.priority ?? 'NORMAL'),
      relatedEntityType: String(parsed.relatedEntityType ?? 'Unknown'),
      relatedEntityId: String(parsed.relatedEntityId ?? ''),
      createdAt: String(parsed.createdAt ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

/** Fallback event for an unparseable frame: the stream survives, UI shows raw text. */
export function fallbackEvent(body: string): BackofficeEvent {
  return {
    type: 'notification',
    action: 'new',
    payload: {
      notificationId: '',
      title: '',
      message: body,
      priority: 'NORMAL',
      relatedEntityType: 'Unknown',
      relatedEntityId: '',
      createdAt: new Date().toISOString(),
    },
    receivedAt: new Date().toISOString(),
  };
}

/** Exponential backoff with jitter: 1s · 2^n + up to 300ms, capped at 30s. */
export function computeReconnectDelay(attempts: number, random01: number): number {
  const base = Math.min(1000 * Math.pow(2, attempts), 30000);
  const jitter = Math.floor(random01 * 300);
  return Math.min(base + jitter, 30000);
}

export type CloseVerdict = 'auth' | 'backoff';

/**
 * Socket-drop policy mirroring `onWebSocketClose`: an expired token or an
 * auth close code (1008/4401/4403) goes down the refresh path; any other
 * abnormal drop backs off and retries with the same token.
 */
export function classifyClose(code: number | undefined, tokenExpired: boolean): CloseVerdict {
  if (tokenExpired) return 'auth';
  if (code === 1008 || code === 4401 || code === 4403) return 'auth';
  return 'backoff';
}
