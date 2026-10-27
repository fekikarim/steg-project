'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {ApiError} from '@/lib/api-client';
import type {NotificationResponse} from '@/lib/api/notifications';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications-client';
import {startNotificationPolling} from '@/lib/notifications';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {StatusPill} from '@/components/ui/Badge';
import {CardSkeleton} from '@/components/feedback/Skeleton';
import {ErrorState} from '@/components/feedback/ErrorState';
import {EmptyState} from '@/components/feedback/EmptyState';

type Phase = 'loading' | 'anonymous' | 'empty' | 'ready' | 'error';

const PAGE_SIZE = 20;

/** Broadcast so the header bell refreshes immediately after mutations. */
function broadcastChange() {
  window.dispatchEvent(new Event('notifications:changed'));
}

function formatWhen(iso: string, t: (k: string, v?: Record<string, number>) => string, locale: string): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return iso;
  const diffMin = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (diffMin < 1) return t('timeJustNow');
  if (diffMin < 60) return t('timeMinutes', {count: diffMin});
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return t('timeHours', {count: hours});
  const days = Math.floor(hours / 24);
  if (days < 7) return t('timeDays', {count: days});
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Candidate notification center at `/[locale]/notifications`. Groups the
 * backend-owned deliveries into unread/read, links dossier notifications to
 * their application, and persists read state server-side (refetch proves
 * it). Polls on the shared realtime seam; only ever renders the caller's
 * own items (the backend scopes every query by recipient).
 */
export function NotificationsCenter() {
  const t = useTranslations('notifications');
  const ta = useTranslations('apply');
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    try {
      const res = await listNotifications({page: nextPage, size: PAGE_SIZE});
      setItems((prev) => {
        if (append) {
          const ids = new Set(prev.map((n) => n.id));
          return [...prev, ...res.content.filter((n) => !ids.has(n.id))];
        }
        // Background polls refresh the first window in place instead of
        // resetting already-loaded pages; brand-new items surface on top.
        const freshIds = new Set(res.content.map((n) => n.id));
        return [...res.content, ...prev.filter((n) => !freshIds.has(n.id))];
      });
      setTotal(res.totalElements);
      setPage(nextPage);
      setPhase(res.totalElements === 0 ? 'empty' : 'ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPhase('anonymous');
        return;
      }
      if (err instanceof ApiError) setTraceId(err.traceId ?? null);
      if (!append) setPhase('error');
    }
  }, []);

  useEffect(() => {
    // async bootstrap on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0, false);
    const stop = startNotificationPolling(() => void load(0, false));
    return stop;
  }, [load]);

  const unread = items.filter((n) => !n.read);
  const read = items.filter((n) => n.read);

  async function handleMarkOne(id: string) {
    setActionError(null);
    try {
      const updated = await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? updated : n)));
      broadcastChange();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('loadErrorHint'));
    }
  }

  async function handleMarkAll() {
    setActionError(null);
    try {
      await markAllNotificationsRead();
      // Re-read from the server so the UI reflects persisted state, not hope.
      await load(0, false);
      broadcastChange();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('loadErrorHint'));
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await load(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <ErrorState
        title={t('loadErrorTitle')}
        hint={t('loadErrorHint')}
        traceId={traceId}
        onRetry={() => {
          setPhase('loading');
          void load(0, false);
        }}
      />
    );
  }

  if (phase === 'anonymous') {
    return (
      <Card className="mx-auto max-w-md items-center text-center">
        <h2 className="text-lg font-bold text-navy-900 dark:text-zinc-50">{ta('authRequiredTitle')}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{ta('authRequiredBody')}</p>
        <div className="flex w-full justify-center">
          <Link href="/login">
            <Button variant="primary" size="md">
              {ta('authSignIn')}
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (phase === 'empty') {
    return <EmptyState title={t('emptyTitle')} hint={t('emptyHint')} />;
  }

  const when = (iso: string) =>
    formatWhen(iso, (k, v) => (t as (key: string, vars?: Record<string, number>) => string)(k, v), locale);

  const renderItem = (n: NotificationResponse) => {
    const appLink =
      n.relatedEntityType === 'InternshipApplication' && n.relatedEntityId ? (
        <Link
          href={`/applications/${n.relatedEntityId}`}
          className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          {t('openApplication')}
        </Link>
      ) : null;
    return (
      <li key={n.id}>
        <Card className={n.read ? 'opacity-80' : ''}>
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-navy-900 dark:text-zinc-50">
                {!n.read && (
                  <span aria-hidden="true" className="me-1.5 inline-block h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400" />
                )}
                <span dir="auto">{n.title}</span>
              </p>
              <StatusPill code={n.priority} />
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300" dir="auto">
              {n.message}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                <time dateTime={n.createdAt}>{when(n.createdAt)}</time>
              </p>
              <div className="flex items-center gap-3">
                {appLink}
                {!n.read && (
                  <Button variant="tertiary" size="sm" onClick={() => void handleMarkOne(n.id)}>
                    {t('markRead')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={() => void handleMarkAll()} disabled={unread.length === 0}>
          {t('markAllRead')}
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-accent-200 bg-accent-50/60 px-4 py-3 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-600/10 dark:text-accent-100"
        >
          {actionError}
        </div>
      )}

      {unread.length > 0 && (
        <section aria-labelledby="notif-unread">
          <h2 id="notif-unread" className="mb-2 text-sm font-bold text-navy-900 dark:text-zinc-50">
            {t('unreadSection')} ({unread.length})
          </h2>
          <ul className="flex flex-col gap-3">{unread.map(renderItem)}</ul>
        </section>
      )}

      {read.length > 0 && (
        <section aria-labelledby="notif-read">
          <h2 id="notif-read" className="mb-2 text-sm font-bold text-navy-900 dark:text-zinc-50">
            {t('readSection')} ({read.length})
          </h2>
          <ul className="flex flex-col gap-3">{read.map(renderItem)}</ul>
        </section>
      )}

      {items.length < total && (
        <div className="flex justify-center">
          <Button variant="secondary" size="md" onClick={() => void handleLoadMore()} disabled={loadingMore}>
            {loadingMore ? '…' : t('showMore', {remaining: total - items.length})}
          </Button>
        </div>
      )}

      {items.length === 0 && <EmptyState title={t('emptyTitle')} hint={t('emptyHint')} />}
    </div>
  );
}
