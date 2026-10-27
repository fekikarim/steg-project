'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {ApiError} from '@/lib/api-client';
import type {ApplicationResponse} from '@/lib/api/application';
import {listApplications} from '@/lib/api/application-client';
import {Button} from '@/components/ui/Button';
import {CardSkeleton} from '@/components/feedback/Skeleton';
import {ErrorState} from '@/components/feedback/ErrorState';
import {EmptyState} from '@/components/feedback/EmptyState';
import {Card} from '@/components/ui/Card';
import {StatusPill} from '@/components/ui/Badge';
import {formatDateTime} from '@/lib/dates';
import {TrackingTimeline} from './TrackingTimeline';

type Phase = 'loading' | 'anonymous' | 'empty' | 'ready' | 'error';

/**
 * Secure tracking journey at `/[locale]/applications`.
 * Shows the candidate's most recent application as a single-journey
 * timeline with status history, instead of a list of cards.
 */
export function ApplicationsList() {
  const t = useTranslations('tracking');
  const ta = useTranslations('apply');
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>('loading');
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<ApplicationResponse | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listApplications();
        if (cancelled) return;
        setApps(list);
        setPhase(list.length === 0 ? 'empty' : 'ready');
        if (list.length > 0) setSelectedApp(list[0]);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) { setPhase('anonymous'); return; }
        if (err instanceof ApiError) setTraceId(err.traceId ?? null);
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [retryKey]);

  if (phase === 'loading') {
    return <CardSkeleton />;
  }

  if (phase === 'error') {
    return (
      <ErrorState
        title={ta('loadErrorTitle')}
        hint={ta('loadErrorHint')}
        traceId={traceId}
        onRetry={() => {
          setPhase('loading');
          setRetryKey((k) => k + 1);
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
    return (
      <EmptyState
        title={t('emptyTitle')}
        hint={t('emptyHint')}
        action={
          <Link href="/apply">
            <Button variant="primary" size="md">
              {ta('startButton')}
            </Button>
          </Link>
        }
      />
    );
  }

  const app = selectedApp ?? apps[0];
  if (!app) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Application selector */}
      {apps.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {apps.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedApp(a)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                a.id === app.id
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-navy-900 dark:text-zinc-400'
              }`}
            >
              {a.reference}
            </button>
          ))}
        </div>
      )}

      {/* Single-journey tracking timeline */}
      <Card>
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-navy-900 dark:text-zinc-50">
              {t('detailTitle', {reference: app.reference})}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {app.submittedOnline
                ? t('timelineStateSubmitted')
                : t('timelineStateDraft')}
            </p>
          </div>
          <StatusPill code={app.status} />
        </div>

        <div className="mt-4 space-y-4">
          <TrackingTimeline application={app} />
        </div>
      </Card>

      {/* Key facts */}
      <Card>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('sectionOverview')}</h3>
        <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">{t('fieldReference')}</dt>
            <dd className="text-sm font-mono font-medium text-zinc-800 dark:text-zinc-200">{app.reference}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">{t('fieldStatus')}</dt>
            <dd><StatusPill code={app.status} /></dd>
          </div>
          {app.desiredStartDate && app.desiredEndDate && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">{t('fieldDates')}</dt>
              <dd className="text-sm font-medium text-zinc-800 dark:text-zinc-200" dir="ltr">
                {app.desiredStartDate} → {app.desiredEndDate}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">{t('fieldSubmitted')}</dt>
            <dd className="text-sm text-zinc-800 dark:text-zinc-200">
              {app.submissionDate ? formatDateTime(app.submissionDate, locale) : t('notProvided')}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">{t('fieldUpdated')}</dt>
            <dd className="text-sm text-zinc-800 dark:text-zinc-200">{formatDateTime(app.updatedAt, locale)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">{t('fieldCreated')}</dt>
            <dd className="text-sm text-zinc-800 dark:text-zinc-200">{formatDateTime(app.createdAt, locale)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
