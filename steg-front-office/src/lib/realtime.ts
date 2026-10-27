'use client';

import {Client} from '@stomp/stompjs';
import {startNotificationPolling} from '@/lib/notifications';

export type RealtimeState = 'connected' | 'connecting' | 'disconnected';

/**
 * Front Office realtime client (E4): STOMP over the backend `/ws` endpoint,
 * authenticated with the caller's own short-lived token from the same-origin
 * `/api/realtime/token` bootstrap. Falls back to the polling seam when the
 * socket is unavailable, so the UI never goes stale silently.
 *
 * Guarantees: exponential backoff with jitter (1s → 30s), heartbeat 10s,
 * per-message dedupe by notification id, REST reconciliation on reconnect
 * (caller re-fetches via onUpdate), no full-list refetch per event by design
 * (the bell only needs the unread count).
 */
export function startRealtimeNotifications(
  onUpdate: () => void,
  onState?: (state: RealtimeState) => void,
): () => void {
  let stopped = false;
  let client: Client | null = null;
  let fallbackStop: (() => void) | null = null;
  let attempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const seen = new Set<string>();
  const setState = (s: RealtimeState) => {
    try {
      onState?.(s);
    } catch {
      /* listener errors must not kill the socket */
    }
  };

  const startFallback = () => {
    if (stopped || fallbackStop) return;
    fallbackStop = startNotificationPolling(onUpdate);
  };

  const scheduleRetry = () => {
    if (stopped) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5)) + Math.random() * 500;
    attempts += 1;
    setState('disconnected');
    retryTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async () => {
    if (stopped) return;
    setState('connecting');
    let creds: {wsUrl: string; token: string};
    try {
      const res = await fetch('/api/realtime/token', {credentials: 'same-origin'});
      if (!res.ok) throw new Error(`token ${res.status}`);
      creds = (await res.json()) as {wsUrl: string; token: string};
    } catch {
      startFallback();
      return;
    }

    try {
      client = new Client({
        webSocketFactory: () =>
          new WebSocket(`${creds.wsUrl}/ws?token=${encodeURIComponent(creds.token)}`),
        reconnectDelay: 0, // manual backoff above (jittered, bounded)
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          attempts = 0;
          setState('connected');
          // REST is authoritative: reconcile immediately (missed events while offline).
          onUpdate();
          try {
            client?.subscribe('/user/queue/notifications', (msg) => {
              try {
                const body = JSON.parse(msg.body as string) as {notificationId?: string};
                const id = body.notificationId ?? msg.headers['message-id'] ?? msg.body.slice(0, 64);
                if (seen.has(id)) return; // duplicate-event protection
                seen.add(id);
                if (seen.size > 500) seen.clear();
              } catch {
                /* malformed frame: still refresh, never crash */
              }
              onUpdate();
            });
            client?.subscribe('/user/queue/errors', () => onUpdate());
          } catch {
            scheduleRetry();
          }
        },
        onStompError: () => {
          try {
            client?.deactivate();
          } catch {
            /* ignore */
          }
          scheduleRetry();
        },
        onWebSocketClose: () => {
          if (!stopped) scheduleRetry();
        },
      });
      client.activate();
    } catch {
      scheduleRetry();
    }
  };

  const onVisible = () => {
    if (!stopped && document.visibilityState === 'visible') {
      if (!client || !client.active) void connect();
      else onUpdate();
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  void connect();
  // Safety net: if the socket never connects within 8s, poll meanwhile.
  const safety = setTimeout(() => {
    if (!stopped && !client?.active) startFallback();
  }, 8000);

  return () => {
    stopped = true;
    clearTimeout(safety);
    if (retryTimer) clearTimeout(retryTimer);
    document.removeEventListener('visibilitychange', onVisible);
    try {
      void client?.deactivate();
    } catch {
      /* ignore */
    }
    fallbackStop?.();
  };
}
