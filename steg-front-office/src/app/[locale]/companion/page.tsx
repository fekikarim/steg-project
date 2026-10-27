import Image from 'next/image';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {
  IconArrowRight,
  IconBell,
  IconBook,
  IconCheckSquare,
  IconFolder,
  IconLayers,
  IconMessage,
  IconTrendingUp,
} from '@/components/ui/icons';
import type {AppLocale} from '@/i18n/routing';

/**
 * Rebuilt Internship Companion Page (Phase B7):
 * Dedicated product showcase for the Flutter mobile application used during
 * the internship period at STEG:
 * - Device mockup featuring the mobile app screenshot
 * - 7 core capabilities (tasks, planning, journal, feedback, notifications, deliverables, progress)
 * - "A Day in the Life with Internship Companion" timeline
 * - Direct Apply CTA banner
 */
export default async function CompanionPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('companion');

  const features = [
    {
      title: t('featTasksTitle'),
      desc: t('featTasksDesc'),
      icon: <IconCheckSquare className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('featPlanTitle'),
      desc: t('featPlanDesc'),
      icon: <IconLayers className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('featJournalTitle'),
      desc: t('featJournalDesc'),
      icon: <IconBook className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('featFeedbackTitle'),
      desc: t('featFeedbackDesc'),
      icon: <IconMessage className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('featNotifyTitle'),
      desc: t('featNotifyDesc'),
      icon: <IconBell className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('featDeliverablesTitle'),
      desc: t('featDeliverablesDesc'),
      icon: <IconFolder className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('featProgressTitle'),
      desc: t('featProgressDesc'),
      icon: <IconTrendingUp className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
  ];

  const dayTimeline = [
    {time: t('step1Time'), desc: t('step1Desc'), num: '1'},
    {time: t('step2Time'), desc: t('step2Desc'), num: '2'},
    {time: t('step3Time'), desc: t('step3Desc'), num: '3'},
    {time: t('step4Time'), desc: t('step4Desc'), num: '4'},
  ];

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-zinc-50/40 dark:bg-navy-950">
      {/* Ambient Institutional Lighting */}
      <div className="pointer-events-none absolute -top-40 end-0 h-96 w-96 rounded-full bg-brand-500/5 blur-3xl dark:bg-brand-400/10" />
      <div className="pointer-events-none absolute bottom-1/3 start-0 h-96 w-96 rounded-full bg-navy-600/5 blur-3xl dark:bg-navy-700/10" />

      {/* ------------------------------------------------------------------ */}
      {/*  HERO PRODUCT SHOWCASE                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white py-16 sm:py-24 dark:border-navy-800 dark:bg-navy-900/60">
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-12">
          {/* Left copy */}
          <div className="flex flex-col items-start gap-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 shadow-xs backdrop-blur-xs dark:border-brand-800/60 dark:bg-brand-950/40">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400"></span>
              </span>
              <span className="text-xs font-semibold tracking-wide text-brand-800 dark:text-brand-300">
                {t('badge')}
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-navy-950 sm:text-5xl lg:text-6xl dark:text-white">
              <span className="block" dir={locale === 'ar' ? 'auto' : 'ltr'}>
                {t('productName')}
              </span>
              <span className="block">{t('title')}</span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-300">
              {t('subtitle')}
            </p>

            <div className="pt-2">
              <Link href="/apply">
                <Button size="lg" variant="primary" className="rounded-xl px-6 py-3.5 shadow-sm">
                  <span>{t('ctaApply')}</span>
                  <IconArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Phone Frame Mockup with Clean Precision Bezel */}
          <div className="relative flex justify-center lg:col-span-5">
            <div className="relative w-64 sm:w-72">
              <div className="relative overflow-hidden rounded-[2.8rem] border-[6px] border-zinc-800 bg-zinc-900 shadow-2xl dark:border-zinc-700">
                {/* Phone speaker notch */}
                <div className="absolute top-2.5 start-1/2 z-10 h-3.5 w-20 -translate-x-1/2 rounded-full bg-zinc-800" />
                <Image
                  src="/components/intern-mobile-app/mobile_app_intern_1335x2000.jpg"
                  alt={t('heroImageAlt', {productName: t('productName')})}
                  width={600}
                  height={900}
                  priority
                  sizes="(max-width: 640px) 256px, 288px"
                  className="h-auto w-full object-cover"
                />
              </div>

              {/* Clean feature pills */}
              <div className="absolute -top-3 -start-4 rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-xs dark:border-navy-800 dark:bg-navy-900/95">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-800 dark:text-brand-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t('pillFlutter')}
                </span>
              </div>

              <div className="absolute -bottom-4 -end-4 rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-xs dark:border-navy-800 dark:bg-navy-900/95">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('pillRealtime')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  FEATURES GRID                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col items-start gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
            {t('toolsEyebrow')}
          </span>
          <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
            {t('featuresTitle')}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
            {t('featuresLead')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="surface-card hover-lift flex flex-col gap-3 rounded-2xl p-6 shadow-xs transition-all"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-xs dark:bg-brand-950/60 dark:text-brand-300">
                {feat.icon}
              </span>
              <h3 className="text-base font-bold text-navy-950 dark:text-white">{feat.title}</h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  A DAY IN THE LIFE TIMELINE                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative border-y border-zinc-200/80 bg-white py-16 sm:py-20 dark:border-navy-800 dark:bg-navy-900/40">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 sm:px-6">
          <div className="flex flex-col items-start gap-2">
            <Badge tone="brand" className="w-fit font-semibold">{t('scenarioBadge')}</Badge>
            <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
              {t('dayInLifeTitle')} <bdi dir={locale === 'ar' ? 'auto' : 'ltr'}>{t('productName')}</bdi>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dayTimeline.map((step) => (
              <div
                key={step.num}
                className="surface-card hover-lift flex flex-col gap-3 rounded-2xl p-5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white shadow-xs dark:bg-brand-600">
                    {step.num}
                  </span>
                  <span className="font-mono text-xs font-bold text-brand-800 dark:text-brand-300">{step.time}</span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  ACTIVATION CTA BANNER                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="relative flex w-full flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-brand-900 p-8 text-center text-white shadow-xl sm:p-12 md:flex-row md:text-start dark:border dark:border-navy-800">
          <div className="flex max-w-lg flex-col gap-2">
            <h2 className="text-2xl font-black sm:text-3xl">{t('bannerTitle')}</h2>
            <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">{t('bannerDesc')}</p>
          </div>
          <Link href="/apply" className="shrink-0">
            <Button size="lg" className="rounded-xl bg-white font-bold text-navy-950 shadow-md hover:bg-zinc-100 hover-lift">
              <span>{t('bannerButton')}</span>
              <IconArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}