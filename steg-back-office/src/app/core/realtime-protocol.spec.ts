import { describe, it, expect } from 'vitest';
import {
  classifyClose,
  computeReconnectDelay,
  fallbackEvent,
  inferTypeFromDestination,
  mapNotificationToEvent,
  parseNotificationPayload,
} from './realtime-protocol';
import type { RealtimeNotificationPayload } from './realtime.service';

const payload = (overrides: Partial<RealtimeNotificationPayload> = {}): RealtimeNotificationPayload => ({
  notificationId: 'n1',
  title: 'T',
  message: 'M',
  priority: 'HIGH',
  relatedEntityType: 'Internship',
  relatedEntityId: 'int-1',
  createdAt: '2026-10-01T00:00:00Z',
  ...overrides,
});

/**
 * S9 realtime protocol (§8.1): entity→stream mapping, malformed-frame
 * survival, backoff math and the socket-drop policy — all without sockets.
 */
describe('realtime protocol', () => {
  it('maps every backend entity vocabulary to its stream', () => {
    const cases: [string, string][] = [
      ['InternshipApplication', 'application'],
      ['ApplicationDocument', 'application'],
      ['Candidate', 'candidate'],
      ['Internship', 'internship'],
      ['InternshipAssignment', 'internship'],
      ['FinanceCase', 'finance'],
      ['PaymentApproval', 'finance'],
      ['AuditLog', 'audit'],
      ['Department', 'department'],
      ['Employee', 'employee'],
      ['Notification', 'notification'],
    ];
    for (const [entity, stream] of cases) {
      const event = mapNotificationToEvent(payload({ relatedEntityType: entity }));
      expect(event.type).toBe(stream);
      expect(event.action).toBe('notification');
      expect(event.entityId).toBe('int-1');
    }
  });

  it('maps unknown entities to the unknown stream instead of crashing', () => {
    expect(mapNotificationToEvent(payload({ relatedEntityType: 'Weird' })).type).toBe('unknown');
    expect(mapNotificationToEvent(payload({ relatedEntityType: '' })).type).toBe('unknown');
  });

  it('infers the stream from the destination first, then the entity', () => {
    expect(inferTypeFromDestination('/topic/backoffice/candidates', 'Whatever')).toBe('candidate');
    expect(inferTypeFromDestination('/topic/backoffice', 'FinanceCase')).toBe('finance');
    expect(inferTypeFromDestination('/topic/backoffice', 'Nope')).toBe('unknown');
    expect(inferTypeFromDestination('/topic/backoffice/dashboard', 'Internship')).toBe('unknown');
  });

  it('parses typed payloads and survives malformed frames without throwing', () => {
    const parsed = parseNotificationPayload(JSON.stringify(payload({ title: 'Hi' })));
    expect(parsed?.title).toBe('Hi');
    expect(parseNotificationPayload('not json{{{')).toBeNull();
    expect(parseNotificationPayload('')).toBeNull();
    expect(parseNotificationPayload('42')).toBeNull();
    const fallback = fallbackEvent('not json{{{');
    expect(fallback.type).toBe('notification');
    expect(fallback.payload.message).toBe('not json{{{');
  });

  it('backs off exponentially with jitter, capped at 30s', () => {
    expect(computeReconnectDelay(0, 0)).toBe(1000);
    expect(computeReconnectDelay(1, 0)).toBe(2000);
    expect(computeReconnectDelay(2, 0)).toBe(4000);
    expect(computeReconnectDelay(0, 0.5)).toBe(1150);
    expect(computeReconnectDelay(10, 0.999)).toBe(30000);
    expect(computeReconnectDelay(100, 0)).toBe(30000);
  });

  it('simulates socket drops: auth causes go down the refresh path, plain drops back off', () => {
    // Expired token on any close → refresh, never backoff with a stale token.
    expect(classifyClose(1006, true)).toBe('auth');
    expect(classifyClose(undefined, true)).toBe('auth');
    // Auth close codes → refresh path.
    expect(classifyClose(1008, false)).toBe('auth');
    expect(classifyClose(4401, false)).toBe('auth');
    expect(classifyClose(4403, false)).toBe('auth');
    // Abnormal plain drops (1006, no code at all) → backoff and retry.
    expect(classifyClose(1006, false)).toBe('backoff');
    expect(classifyClose(undefined, false)).toBe('backoff');
    // Clean close → backoff is harmless (client reconnects on demand).
    expect(classifyClose(1000, false)).toBe('backoff');
  });
});
