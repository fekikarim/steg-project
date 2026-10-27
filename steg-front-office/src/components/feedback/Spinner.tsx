'use client';

import {useTranslations} from 'next-intl';
import {cx} from '@/lib/cx';

/** Inline spinner for short actions (UI_UX §6.3). */
export function Spinner({className, label}: {className?: string; label?: string}) {
  const t = useTranslations('common');
  return (
    <span role="status" aria-label={label ?? t('loading')} className={cx('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent dark:border-brand-300"
      />
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label ?? t('loading')}</span>
    </span>
  );
}
