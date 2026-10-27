'use client';

import type {ReactNode} from 'react';
import {useTranslations} from 'next-intl';

interface EmptyStateProps {
  title?: string;
  hint?: string;
  action?: ReactNode;
}

/** Meaningful empty state: what, why, what-next (UI_UX §9.7). */
export function EmptyState({title, hint, action}: EmptyStateProps) {
  const t = useTranslations('states');
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl text-zinc-400 dark:bg-white/5 dark:text-zinc-500">
        ○
      </span>
      <h2 className="text-base font-bold text-navy-900 dark:text-zinc-50">{title ?? t('emptyTitle')}</h2>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{hint ?? t('emptyHint')}</p>
      {action}
    </div>
  );
}
