'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {useAuth} from '@/lib/auth';
import {getUnreadCount} from '@/lib/api/notifications-client';
import {startRealtimeNotifications, type RealtimeState} from '@/lib/realtime';
import {cx} from '@/lib/cx';

interface NotificationBellProps {
  className?: string;
}

/**
 * Header notification bell (B6). Labels resolve client-side (the header
 * server shell only passes layout-agnostic props). Shows the unread count
 * badge, polling on an interval plus tab-focus (see the realtime seam in
 * lib/notifications.ts), and refreshes immediately when the center
 * broadcasts `notifications:changed`. Hidden while anonymous; silent on
 * 401 (the session simply lapsed).
 */
export function NotificationBell({className}: NotificationBellProps) {
  const t = useTranslations('notifications');
  const {status} = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [seenStatus, setSeenStatus] = useState(status);
  const [live, setLive] = useState(false);

  // Reset the badge when the session changes (render-time adjustment, not an effect).
  if (seenStatus !== status) {
    setSeenStatus(status);
    setCount(null);
  }

  const refresh = useCallback(async () => {
    try {
      const {unreadCount} = await getUnreadCount();
      setCount(unreadCount);
    } catch {
      // 401 (lapsed session) or network blip: keep the last known badge.
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // async bootstrap on sign-in
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Realtime first (STOMP), polling fallback inside — REST stays authoritative.
    const stopLive = startRealtimeNotifications(() => void refresh(), (s: RealtimeState) => {
      if (s === 'connected') setLive(true);
      else setLive(false);
    });
    const onChanged = () => void refresh();
    window.addEventListener('notifications:changed', onChanged);
    return () => {
      stopLive();
      window.removeEventListener('notifications:changed', onChanged);
    };
  }, [status, refresh]);

  if (status !== 'authenticated') return null;

  const ariaLabel = count ? t('bellUnread', {count}) : t('bell');

  return (
    <Link
      href="/notifications"
      aria-label={ariaLabel}
      className={cx(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
        />
      </svg>
      {live && (
        <span
          aria-hidden="true"
          title={t('live')}
          className="absolute bottom-0.5 end-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-navy-900"
        />
      )}
      {count !== null && count > 0 && (
        <span
          aria-hidden="true"
          className="absolute end-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-[11px] font-bold text-white dark:bg-accent-500"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
