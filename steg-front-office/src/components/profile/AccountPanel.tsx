'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useLocale} from 'next-intl';
import type {CandidateProfile} from '@/lib/api/candidate';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';

interface AccountPanelProps {
  profile: CandidateProfile;
  hasUnsavedChanges: boolean;
  onSignOut: () => void;
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Sign-out with an inline confirm that acknowledges unsaved changes. */
export function AccountPanel({profile, hasUnsavedChanges, onSignOut}: AccountPanelProps) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card title={t('accountTitle')} subtitle={t('accountSubtitle')}>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('fieldEmail')}</dt>
          <dd className="font-medium text-zinc-800 dark:text-zinc-100">{profile.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('accountCreated')}</dt>
          <dd className="font-medium text-zinc-800 dark:text-zinc-100">{formatDate(profile.createdAt, locale)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('summaryType')}</dt>
          <dd className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {t('sessionAuthed')}
          </dd>
        </div>
      </dl>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent-100 bg-accent-50/60 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-accent-800 dark:bg-accent-600/10">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            {hasUnsavedChanges ? t('signOutConfirm') : `${t('signOut')}?`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={onSignOut}>
              {t('signOut')}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            {t('signOut')}
          </Button>
        </div>
      )}
    </Card>
  );
}