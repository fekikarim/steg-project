import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {ProfileWorkspace} from '@/components/profile/ProfileWorkspace';

/**
 * Candidate profile workspace (B3) at `/[locale]/profile`. The server renders
 * the shell and translated title; the authenticated workspace itself is
 * client-rendered against `/api/profile` so no session data ever reaches the
 * server-rendered HTML.
 */
export default async function ProfilePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('profile');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold text-navy-900 dark:text-zinc-50">{t('title')}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{t('subtitle')}</p>
      <div className="mt-6">
        <ProfileWorkspace />
      </div>
    </div>
  );
}