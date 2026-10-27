import Image from 'next/image';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {
  IconArrowRight,
  IconBuilding,
  IconTrendingUp,
  IconCheckSquare,
} from '@/components/ui/icons';
import type {AppLocale} from '@/i18n/routing';

/**
 * Rebuilt STEG History Page (Phase B7):
 * - Foundation on April 3, 1962 (Law 62-8), consolidating 7 concessionary companies
 * - 61-year historical statistics evolution (1962 → 2023)
 * - Three strategic business pillars (Generation, Transmission, Distribution)
 * - Green energy transition & renewables
 * - Trilingual Organizational Chart (Organigramme) matching the active locale
 */
export default async function HistoryPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('history');

  const stats = [
    {label: t('stat1Label'), detail: t('stat1Detail'), value: '99.8%'},
    {label: t('stat2Label'), detail: t('stat2Detail'), value: '99.5%'},
    {label: t('stat3Label'), detail: t('stat3Detail'), value: '5 982 MW'},
    {label: t('stat4Label'), detail: t('stat4Detail'), value: '19 313 GWh'},
    {label: t('stat5Label'), detail: t('stat5Detail'), value: '4.49 M'},
    {label: t('stat6Label'), detail: t('stat6Detail'), value: '1.04 M'},
  ];

  const missions = [
    {
      title: t('mission1Title'),
      desc: t('mission1Desc'),
      icon: <IconTrendingUp className="h-6 w-6 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('mission2Title'),
      desc: t('mission2Desc'),
      icon: <IconBuilding className="h-6 w-6 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('mission3Title'),
      desc: t('mission3Desc'),
      icon: <IconCheckSquare className="h-6 w-6 text-brand-600 dark:text-brand-300" />,
    },
  ];

  // Pick the localized organigramme
  const organigrammeSrc =
    locale === 'ar'
      ? '/components/history/organizational-chart/org_ar_1024x1536.png'
      : locale === 'en'
        ? '/components/history/organizational-chart/org_eng_1024x1536.png'
        : '/components/history/organizational-chart/org_fr_1024x1536.png';

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-zinc-50/40 dark:bg-navy-950">
      {/* Ambient Institutional Lighting */}
      <div className="pointer-events-none absolute -top-40 end-0 h-96 w-96 rounded-full bg-brand-500/5 blur-3xl dark:bg-brand-400/10" />
      <div className="pointer-events-none absolute bottom-1/3 start-0 h-96 w-96 rounded-full bg-navy-600/5 blur-3xl dark:bg-navy-700/10" />

      {/* ------------------------------------------------------------------ */}
      {/*  HEADER BANNER                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white py-16 sm:py-24 dark:border-navy-800 dark:bg-navy-900/60">
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 text-center sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 shadow-xs backdrop-blur-xs dark:border-brand-800/60 dark:bg-brand-950/40">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400"></span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-brand-800 dark:text-brand-300">
              {t('badge')}
            </span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-navy-950 sm:text-5xl lg:text-6xl dark:text-white">
            {t('title')}
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-300">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  SECTION 1: THE FOUNDATION OF STEG (1962)                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-7">
            <Badge tone="brand" className="w-fit font-semibold">{t('lawBadge')}</Badge>
            <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
              {t('foundationTitle')}
            </h2>
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 sm:text-base dark:text-zinc-300">
              <p>{t('foundationP1')}</p>
              <p>{t('foundationP2')}</p>
              <p>{t('foundationP3')}</p>
            </div>
          </div>

          <div className="surface-card relative flex flex-col gap-4 rounded-3xl p-6 shadow-sm lg:col-span-5">
            <div className="flex items-center gap-4">
              <Image
                src="/components/history/Engineer_working_with_wind_turbines_producing_green_energy_225x150.svg"
                alt={t('energyAlt')}
                width={120}
                height={80}
                className="h-20 w-auto shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-brand-800 dark:text-brand-300">
                  {t('energyTitle')}
                </span>
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t('energyDesc')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 border-t border-zinc-100 pt-4 dark:border-navy-800">
              <Image
                src="/components/history/Geothermal_energy_renewable_sources_illustration_225x150.svg"
                alt={t('geoAlt')}
                width={120}
                height={80}
                className="h-20 w-auto shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-navy-950 dark:text-zinc-100">
                  {t('geoTitle')}
                </span>
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t('geoDesc')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  SECTION 2: 61 YEARS OF EVOLUTION (TELEMETRY HUD METRICS)          */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative border-y border-zinc-200/80 bg-white py-16 sm:py-20 dark:border-navy-800 dark:bg-navy-900/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
          <div className="flex flex-col items-start gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
              {t('statsEyebrow')}
            </span>
            <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
              {t('statsTitle')}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
              {t('statsLead')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="surface-card hover-lift flex flex-col gap-2 rounded-2xl p-6 shadow-xs transition-all"
              >
                <span className="font-mono text-3xl font-black text-brand-700 sm:text-4xl dark:text-brand-300">
                  {s.value}
                </span>
                <h3 className="text-sm font-bold text-navy-950 dark:text-zinc-100">{s.label}</h3>
                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  SECTION 3: MISSIONS & CORE ACTIVITIES                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col items-start gap-2">
          <Badge tone="brand" className="w-fit font-semibold">{t('missionsBadge')}</Badge>
          <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
            {t('missionsTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {missions.map((m) => (
            <div
              key={m.title}
              className="surface-card hover-lift flex flex-col gap-3 rounded-2xl p-6 shadow-xs"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-xs dark:bg-brand-950/60 dark:text-brand-300">
                {m.icon}
              </span>
              <h3 className="text-base font-bold text-navy-950 dark:text-white">{m.title}</h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  SECTION 4: ORGANIZATIONAL CHART (ORGANIGRAMME)                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative border-t border-zinc-200/80 bg-zinc-50/50 py-16 sm:py-20 dark:border-navy-800 dark:bg-navy-900/30">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 sm:px-6">
          <div className="flex flex-col items-start gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
              {t('govEyebrow')}
            </span>
            <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
              {t('organigrammeTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
              {t('organigrammeDesc')}
            </p>
          </div>

          <div className="surface-card overflow-hidden rounded-3xl p-6 shadow-md">
            <div className="relative aspect-[3/4] w-full max-w-2xl mx-auto overflow-hidden rounded-2xl bg-zinc-50 dark:bg-navy-900/50">
              <Image
                src={organigrammeSrc}
                alt={t('organigrammeCaption')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
            <p className="mt-4 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t('organigrammeCaption')}
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Link href="/apply">
              <Button size="lg" variant="primary" className="rounded-xl px-6 py-3.5 shadow-sm">
                <span>{t('joinCta')}</span>
                <IconArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}