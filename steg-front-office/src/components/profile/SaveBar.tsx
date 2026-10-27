'use client';

import {useTranslations} from 'next-intl';
import {useLocale} from 'next-intl';
import {Button} from '@/components/ui/Button';

interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  savedAt: Date | null;
  onSave: () => void;
  onDiscard: () => void;
}

function formatTime(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(date);
  } catch {
    return String(date);
  }
}

/**
 * Sticky action bar (B3 tasks 7–8): persistent unsaved-changes signal, last
 * save feedback and the Save / Discard controls. The page-level `beforeunload`
 * guard complements this for full-page navigations.
 */
export function SaveBar({dirty, saving, savedAt, onSave, onDiscard}: SaveBarProps) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const locale = useLocale();

  return (
    <div
      aria-live="polite"
      className="sticky bottom-0 z-30 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-800 dark:bg-navy-950/95"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm">
          {dirty ? (
            <>
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="font-semibold text-amber-700 dark:text-amber-300">{t('dirtyNotice')}</span>
              <span className="hidden text-zinc-500 sm:inline dark:text-zinc-400">{t('dirtyNoticeDetail')}</span>
            </>
          ) : savedAt ? (
            <span className="text-zinc-500 dark:text-zinc-400">{t('savedAt', {time: formatTime(savedAt, locale)})}</span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" disabled={!dirty || saving} onClick={onDiscard}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" size="md" disabled={!dirty || saving} loading={saving} loadingLabel={t('saving')} onClick={onSave}>
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}