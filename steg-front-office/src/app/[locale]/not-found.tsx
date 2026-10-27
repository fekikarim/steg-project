import Image from 'next/image';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Button} from '@/components/ui/Button';

/** Localized 404 (UI_UX §9.7, §14) with futuristic cyber styling and official illustration. */
export default async function NotFound() {
  const t = await getTranslations('states');
  return (
    <div className="relative overflow-hidden py-16 sm:py-24">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 ambient-glow-cyan blur-[120px] opacity-20" />

      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-navy-950/40 p-4 shadow-2xl backdrop-blur-xl">
          <Image
            src="/components/error/error_page_illustration_1376x768.jpeg"
            alt={t('notFoundImageAlt')}
            width={600}
            height={335}
            className="rounded-2xl object-cover"
            priority
            sizes="(max-width: 640px) 100vw, 600px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-transparent pointer-events-none" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-sm font-bold text-cyan-400">{t('notFoundCode')}</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 dark:text-zinc-50">
            {t('notFoundTitle')}
          </h1>
          <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            {t('notFoundHint')}
          </p>
        </div>

        <div className="mt-2">
          <Link href="/">
            <Button variant="primary" size="lg" className="shadow-lg shadow-brand-500/25">
              {t('notFoundAction')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
