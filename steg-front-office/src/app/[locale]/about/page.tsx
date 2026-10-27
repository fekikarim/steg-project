import Image from 'next/image';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {
  IconArrowRight,
  IconBuilding,
  IconClipboardList,
  IconFolder,
  IconLayoutGrid,
  IconSparkles,
  IconUser,
  IconGraduationCap,
} from '@/components/ui/icons';
import type {AppLocale} from '@/i18n/routing';

/**
 * Rebuilt About Page (Phase B7):
 * Specifications & Digital Transformation narrative ("Cahier des charges"):
 * 1. Initial observed challenges & pain points
 * 2. Integrated 3-tier digital solution (Front Office, Back Office, Mobile App)
 * 3. Video player showcasing digital services
 * 4. Value and impact for candidates, universities, and STEG
 */
export default async function AboutPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('about');
  const tcomp = await getTranslations('companion');
  const productName = tcomp('productName');

  const painPoints = [
    {
      title: t('pain1Title'),
      desc: t('pain1Desc'),
      icon: <IconBuilding className="h-5 w-5 text-accent-600 dark:text-accent-300" />,
    },
    {
      title: t('pain2Title'),
      desc: t('pain2Desc'),
      icon: <IconClipboardList className="h-5 w-5 text-accent-600 dark:text-accent-300" />,
    },
    {
      title: t('pain3Title'),
      desc: t('pain3Desc'),
      icon: <IconFolder className="h-5 w-5 text-accent-600 dark:text-accent-300" />,
    },
    {
      title: t('pain4Title'),
      desc: t('pain4Desc'),
      icon: <IconUser className="h-5 w-5 text-accent-600 dark:text-accent-300" />,
    },
  ];

  const solutionFacets = [
    {
      title: t('facet1Title'),
      desc: t('facet1Desc'),
      badge: t('badgeWeb'),
      icon: <IconLayoutGrid className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('facet2Title'),
      desc: t('facet2Desc'),
      badge: t('badgeBackoffice'),
      icon: <IconBuilding className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('facet3Title', {productName}),
      desc: t('facet3Desc'),
      badge: t('badgeMobile'),
      icon: <IconSparkles className="h-5 w-5 text-brand-600 dark:text-brand-300" />,
    },
  ];

  const impacts = [
    {
      title: t('impactCandidateTitle'),
      desc: t('impactCandidateDesc'),
      icon: <IconUser className="h-6 w-6 text-brand-600 dark:text-brand-300" />,
    },
    {
      title: t('impactUniversityTitle'),
      desc: t('impactUniversityDesc'),
      icon: <IconGraduationCap className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />,
    },
    {
      title: t('impactStegTitle'),
      desc: t('impactStegDesc'),
      icon: <IconBuilding className="h-6 w-6 text-navy-700 dark:text-navy-300" />,
    },
  ];

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-zinc-50/40 dark:bg-navy-950">
      {/* Ambient Institutional Lighting */}
      <div className="pointer-events-none absolute -top-40 end-0 h-96 w-96 rounded-full bg-brand-500/5 blur-3xl dark:bg-brand-400/10" />
      <div className="pointer-events-none absolute top-1/3 -start-40 h-96 w-96 rounded-full bg-navy-600/5 blur-3xl dark:bg-navy-700/10" />

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
      {/*  PART 1: THE INITIAL PROBLEM STATEMENT                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-7">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {t('eyebrowProblem')}
            </span>
            <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
              {t('initialContextTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
              {t('initialContextLead')}
            </p>
          </div>

          <div className="surface-card relative overflow-hidden rounded-3xl p-3 shadow-md lg:col-span-5">
            <Image
              src="/components/about/paper_usage_problem_7438x5000.jpg"
              alt={t('imageAlt')}
              width={700}
              height={450}
              sizes="(max-width: 1024px) 100vw, 500px"
              className="h-56 w-full rounded-2xl object-cover"
            />
            <div className="mt-3 flex items-center gap-2.5 px-2 pb-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t('imageCaption')}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Pain point cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {painPoints.map((p) => (
            <div
              key={p.title}
              className="surface-card hover-lift flex flex-col gap-3 rounded-2xl p-5 shadow-xs"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {p.icon}
              </span>
              <h3 className="text-sm font-bold text-navy-950 dark:text-white">{p.title}</h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  PART 2: THE INTEGRATED SOLUTION (3 TIERS)                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative border-y border-zinc-200/80 bg-white py-16 sm:py-20 dark:border-navy-800 dark:bg-navy-900/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
          <div className="flex flex-col items-start gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {t('eyebrowSolution')}
            </span>
            <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
              {t('solutionTitle')}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
              {t('solutionLead')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {solutionFacets.map((facet) => (
              <div
                key={facet.title}
                className="surface-card hover-lift flex flex-col justify-between rounded-2xl p-6 shadow-sm"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-xs dark:bg-brand-950/60 dark:text-brand-300">
                      {facet.icon}
                    </span>
                    <Badge tone="brand">{facet.badge}</Badge>
                  </div>
                  <h3 className="text-base font-bold text-navy-950 dark:text-white">{facet.title}</h3>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{facet.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Multimedia Video Demonstration — Clean Institutional Player */}
          <div className="surface-card flex flex-col gap-4 rounded-3xl p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-navy-800">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  {t('videoSectionTitle')}
                </span>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{t('videoSectionDesc')}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-mono font-medium text-zinc-700 dark:border-navy-700 dark:bg-navy-800 dark:text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('videoMeta')}
              </span>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-inner dark:border-navy-700">
              <video
                controls
                className="h-auto max-h-[520px] w-full object-contain"
                preload="metadata"
              >
                <source src="/components/about/digital_services_1920x1080.mp4" type="video/mp4" />
                {t('videoFallback')}
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  PART 3: TRIPLE IMPACT & VALUE PROPOSITION                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col items-start gap-2">
          <Badge tone="brand" className="w-fit font-semibold">{t('badgeImpact')}</Badge>
          <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
            {t('impactTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {impacts.map((item) => (
            <div key={item.title} className="surface-card hover-lift rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-xs dark:bg-brand-950/60 dark:text-brand-300">
                  {item.icon}
                </span>
                <h3 className="text-base font-bold text-navy-950 dark:text-white">{item.title}</h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Footer — Premium Banner */}
        <div className="relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-navy-900 shadow-xl shadow-brand-900/30">
          {/* Decorative radial glows */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-8 h-64 w-64 rounded-full bg-navy-950/60 blur-2xl"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-8 px-8 py-7 sm:px-12 sm:py-9">
            {/* Left — illustration + copy */}
            <div className="flex items-center gap-6">
              {/* Illustration container */}
              <div className="relative shrink-0">
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm sm:h-32 sm:w-32">
                  <Image
                    src="/components/about/intern_have_idea_illustration_150x150.svg"
                    alt={t('ctaBannerAlt')}
                    width={120}
                    height={120}
                    className="h-24 w-24 drop-shadow-md sm:h-28 sm:w-28"
                  />
                </div>
                {/* Subtle badge dot */}
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-brand-700">
                  <span className="h-2 w-2 rounded-full bg-white" />
                </span>
              </div>

              {/* Text */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-200/80">
                  {t('badge')}
                </p>
                <h3 className="text-lg font-bold leading-snug text-white sm:text-xl">
                  {t('ctaBannerTitle')}
                </h3>
                <p className="max-w-sm text-sm leading-relaxed text-brand-100/75">
                  {t('ctaBannerDesc')}
                </p>
              </div>
            </div>

            {/* Right — action */}
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <Link href="/apply">
                <Button
                  size="lg"
                  variant="primary"
                  className="whitespace-nowrap rounded-xl border border-white/20 bg-white text-brand-800 shadow-lg transition-all hover:bg-brand-50 hover:shadow-brand-300/30 active:scale-[0.98]"
                >
                  <span>{t('ctaApply')}</span>
                  <IconArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
              <span className="flex items-center gap-1.5 text-[11px] text-brand-200/60">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                {t('ctaBannerNote')}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}