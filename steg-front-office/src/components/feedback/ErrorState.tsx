'use client';

import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/Button';

interface ErrorStateProps {
  title?: string;
  hint?: string;
  traceId?: string | null;
  onRetry?: () => void;
}

/**
 * Contextual error with retry and an optional support reference (traceId from
 * the backend envelope — UI_UX §14.2). No stack traces, no raw errors.
 */
export function ErrorState({title, hint, traceId, onRetry}: ErrorStateProps) {
  const t = useTranslations('states');
  const tc = useTranslations('common');
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-accent-100 bg-accent-50/50 px-6 py-12 text-center dark:border-accent-800 dark:bg-accent-600/10"
    >
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-600/10 text-xl text-accent-700 dark:text-accent-100">
        !
      </span>
      <h2 className="text-base font-bold text-navy-900 dark:text-zinc-50">{title ?? t('errorTitle')}</h2>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-300">{hint ?? t('errorHint')}</p>
      {traceId && (
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400" dir="ltr">
          {t('errorReference')}: {traceId}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {tc('retry')}
        </Button>
      )}
    </div>
  );
}
