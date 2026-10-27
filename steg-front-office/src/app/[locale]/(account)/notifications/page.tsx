import {getTranslations, setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {NotificationsCenter} from '@/components/notifications/NotificationsCenter';

/**
 * Candidate notification center at `/[locale]/notifications`. Server renders
 * the translated shell; the list, read states and polling live client-side
 * against our server-side proxies.
 */
export default async function NotificationsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('notifications');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold text-navy-900 dark:text-zinc-50">{t('title')}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{t('subtitle')}</p>
      <div className="mt-6">
        <NotificationsCenter />
      </div>
    </div>
  );
}
