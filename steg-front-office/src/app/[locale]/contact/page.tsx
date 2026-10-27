import {Link} from '@/i18n/navigation';
import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {IconMail, IconPhone, IconArrowRight} from '@/components/ui/icons';
import {Button} from '@/components/ui/Button';

export default async function ContactPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('contact');

  return (
    <div className="relative overflow-hidden py-12 sm:py-20">
      {/* Background cyber ambient glows */}
      <div className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-96 w-[600px] ambient-glow-cyan blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 end-10 h-72 w-72 ambient-glow-blue blur-[100px]" />

      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            {t('badge')}
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <span className="gradient-heading block">{t('title')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('description')}
          </p>
        </div>

        {/* 3 Cyber Contact Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Email Card */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-md backdrop-blur-md transition-all duration-300 hover:border-cyan-500/50 hover:shadow-cyan-500/10 hover:-translate-y-1 dark:border-white/10 dark:bg-navy-900/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mb-4">
              <IconMail className="h-6 w-6" />
            </div>
            <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              {t('contactEmailLabel')}
            </span>
            <p className="mt-1 font-semibold text-navy-900 dark:text-zinc-100 text-sm">
              {t('contactEmail')}
            </p>
            <div className="mt-4">
              <a
                href={`mailto:${t('contactEmail')}`}
                className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-500 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                {t('sendMessage')}
                <IconArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
              </a>
            </div>
          </div>

          {/* Phone Card */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-md backdrop-blur-md transition-all duration-300 hover:border-cyan-500/50 hover:shadow-cyan-500/10 hover:-translate-y-1 dark:border-white/10 dark:bg-navy-900/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-4">
              <IconPhone className="h-6 w-6" />
            </div>
            <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              {t('contactPhoneLabel')}
            </span>
            <p className="mt-1 font-semibold text-navy-900 dark:text-zinc-100 text-sm" dir="ltr">
              {t('contactPhone')}
            </p>
            <div className="mt-4">
              <a
                href={`tel:${t('contactPhone').replace(/\s+/g, '')}`}
                className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-500 dark:text-cyan-400 dark:hover:text-cyan-300"
                dir="ltr"
              >
                {t('callStandard')}
                <IconArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
              </a>
            </div>
          </div>

          {/* Address Card */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-md backdrop-blur-md transition-all duration-300 hover:border-cyan-500/50 hover:shadow-cyan-500/10 hover:-translate-y-1 dark:border-white/10 dark:bg-navy-900/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 text-xl">
              🏢
            </div>
            <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              {t('contactAddressLabel')}
            </span>
            <p className="mt-1 font-semibold text-navy-900 dark:text-zinc-100 text-sm">
              {t('contactAddress')}
            </p>
            <div className="mt-4">
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {t('hqLabel')}
              </span>
            </div>
          </div>
        </div>

        {/* SLA and Security Notice */}
        <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-950/60 via-navy-900/80 to-navy-950/90 p-6 text-white backdrop-blur-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-xs text-zinc-300">
                {t('disclaimer')}
              </p>
            </div>
            <Link href="/" className="shrink-0">
              <Button variant="secondary" size="sm">
                {t('backToHome')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}