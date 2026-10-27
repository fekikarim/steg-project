'use client';

import {useTranslations} from 'next-intl';
import {useLocale} from 'next-intl';
import type {CandidateProfile} from '@/lib/api/candidate';
import {cx} from '@/lib/cx';

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Profile summary banner (B3 task 2): identity, university, verification state
 * and the last-updated timestamp from the backend — a read-only snapshot.
 */
export function ProfileSummary({profile}: {profile: CandidateProfile}) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6 dark:border-zinc-800 dark:bg-navy-900 dark:shadow-none">
      <div
        aria-hidden="true"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white"
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t('summaryType')}</p>
        <h2 className="truncate text-xl font-bold text-navy-900 dark:text-zinc-50">
          {profile.firstName} {profile.lastName}
        </h2>
        <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">{profile.email}</p>
        {profile.universityName && (
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{profile.universityName}</p>
        )}
      </div>
      <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-1">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('summaryLastUpdated')}</dt>
          <dd className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{formatDateTime(profile.updatedAt, locale)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t('summaryMemberSince')}</dt>
          <dd className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{formatDate(profile.createdAt, locale)}</dd>
        </div>
      </dl>
      <span
        className={cx(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
          profile.nationalId
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300',
        )}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
        {profile.nationalId ? t('summaryVerified') : t('summaryNotVerified')}
      </span>
    </div>
  );
}