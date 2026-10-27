'use client';

/**
 * Notification refresh seam (B6). The candidate client has no WebSocket push
 * yet, so the bell and the center poll on an interval plus tab-focus. When a
 * push channel lands, replace `startNotificationPolling` internals with a
 * socket subscription that calls the same `onUpdate` — no UI redesign needed.
 */

export const NOTIFICATION_POLL_MS = 60_000;

export function startNotificationPolling(onUpdate: () => void, ms = NOTIFICATION_POLL_MS): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (!stopped && document.visibilityState === 'visible') onUpdate();
  };
  const onFocus = () => {
    if (!stopped) onUpdate();
  };

  timer = setInterval(tick, ms);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
  };
}
