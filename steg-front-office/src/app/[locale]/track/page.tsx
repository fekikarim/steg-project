import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {TrackForm} from '@/components/track/TrackForm';

/**
 * Public tracking page at `/[locale]/track` (E3.1): no account required.
 * Candidates paste the one-time tracking token received at anonymous submission.
 */
export default async function TrackPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('track');

  return (
    <div className="relative overflow-hidden py-12 sm:py-20">
      <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl dark:text-white">
            {t('title')}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
            {t('intro')}
          </p>
        </div>
        <TrackForm />
      </div>
    </div>
  );
}
