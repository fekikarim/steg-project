import Image from 'next/image';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {
  IconArrowRight,
  IconCheckSquare,
  IconEye,
  IconGraduationCap,
  IconWrench,
  IconTrendingUp,
  IconBook,
  IconMessage,
  IconLayers,
} from '@/components/ui/icons';
import type {AppLocale} from '@/i18n/routing';

/**
 * Institutional Home Page — STEG Front Office:
 * Redesigned according to UIUX_REDESIGN.md with:
 * - Product Launch Hero with authoritative national identity & authentic visual anchor
 * - Candidate Journey (6-Step Stepped Workflow)
 * - 3 Distinct Internship Pathways (Observation, Perfectionnement, PFE) with contextual CTAs
 * - Administrative Modernization Storytelling (Paper bottleneck vs Digital validation)
 * - Energy Infrastructure & 1962 Heritage highlight
 * - Mobile Internship Companion App Showcase with device framing
 * - Official Attestation & Career Recognition Showcase
 * - High-impact final conversion call-to-action
 */
export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('home');
  const ttypes = await getTranslations('internships');
  const tcomp = await getTranslations('companion');
  const productName = tcomp('productName');

  const roadmapSteps = [
    {title: t('road1Title'), desc: t('road1Desc'), number: '01'},
    {title: t('road2Title'), desc: t('road2Desc'), number: '02'},
    {title: t('road3Title'), desc: t('road3Desc'), number: '03'},
    {title: t('road4Title'), desc: t('road4Desc'), number: '04'},
    {title: t('road5Title'), desc: t('road5Desc'), number: '05'},
    {title: t('road6Title'), desc: t('road6Desc'), number: '06'},
  ];

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-slate-50/50 dark:bg-navy-950">
      {/* ------------------------------------------------------------------ */}
      {/*  HERO SECTION                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white py-16 sm:py-24 lg:py-28 dark:border-slate-800 dark:bg-navy-950">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Hero Content */}
          <div className="relative z-10 flex flex-col items-start gap-6 lg:col-span-7">
            {/* National Status Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 shadow-xs dark:border-slate-700 dark:bg-navy-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                {t('heroBadge')} • {t('heroSession')}
              </span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {t('portalBadge')}
              </span>
            </div>

            {/* Institutional Headline */}
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.15] lg:text-6xl dark:text-white">
              {t('heroTitle')}{' '}
              <span className="gradient-energy block sm:inline font-black">
                STEG
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t('heroSubtitle')}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link href="/apply">
                <Button size="lg" variant="primary">
                  <span>{t('heroCtaApply')}</span>
                  <IconArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
              <Link href="/internships">
                <Button variant="secondary" size="lg">
                  {t('heroCtaTypes')}
                </Button>
              </Link>
              <Link href="/companion">
                <Button variant="tertiary" size="lg">
                  {t('heroCtaCompanion')}
                </Button>
              </Link>
            </div>

            {/* Micro stats banner */}
            <div className="mt-4 grid w-full grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs sm:gap-6 dark:border-slate-800 dark:bg-navy-900/60">
              <div className="flex flex-col">
                <span className="font-mono text-xl font-bold text-brand-600 sm:text-3xl dark:text-brand-400">
                  {t('statsElectrification')}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('statsElectrificationLabel')}
                </span>
              </div>
              <div className="flex flex-col border-x border-slate-200 px-2 sm:px-4 dark:border-slate-800">
                <span className="font-mono text-xl font-bold text-navy-900 sm:text-3xl dark:text-slate-100">
                  {t('statsCapacity')}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('statsCapacityLabel')}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xl font-bold text-accent-600 sm:text-3xl dark:text-accent-100">
                  {t('statsExperience')}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('statsExperienceLabel')}
                </span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual — Architectural Frame */}
          <div className="relative z-10 flex justify-center lg:col-span-5">
            <div className="relative w-full max-w-md">
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-md dark:border-slate-800 dark:bg-navy-900">
                <Image
                  src="/components/home/internship_opportunity_2000x2000.png"
                  alt={t('heroImageAlt')}
                  width={800}
                  height={800}
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 450px"
                  className="h-auto w-full rounded-2xl object-cover"
                />

                {/* Floating telemetry chip: Top Right */}
                <div className="absolute top-5 end-5 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-navy-950/90">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t('coverageChip')}
                  </span>
                </div>

                {/* Floating badge: Bottom Bar */}
                <div className="absolute bottom-5 start-5 end-5 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-navy-950/95">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-sm">
                      ⚡
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {t('heroCardTitle')}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {t('heroCardSub')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  CANDIDATE JOURNEY ROADMAP                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <header className="flex flex-col items-start gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300">
            {t('roadmapEyebrow')}
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {t('roadmapTitle')}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
            {t('roadmapLead')}
          </p>
        </header>

        {/* Stepped Roadmap Grid */}
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {roadmapSteps.map((step) => (
            <div
              key={step.number}
              className="surface-card hover-lift flex flex-col justify-between gap-5 p-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-mono text-sm font-bold text-slate-700 dark:bg-navy-800 dark:text-slate-200">
                  {step.number}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  INTERNSHIP TYPES SHOWCASE (DISTINCT COMPOSITIONS)                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative border-y border-slate-200 bg-white py-16 sm:py-20 lg:py-24 dark:border-slate-800 dark:bg-navy-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                {t('typesEyebrow')}
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                {t('typesTitle')}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
                {t('typesLead')}
              </p>
            </div>
            <Link href="/internships" className="shrink-0">
              <Button variant="secondary" size="md">
                {t('typesCta')}
                <IconArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* 1. Observation Card */}
            <div className="surface-card hover-lift group overflow-hidden rounded-2xl">
              <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-navy-900">
                <Image
                  src="/components/intern-types/observation_internship_illustration_2000x1667.png"
                  alt={t('obsImageAlt')}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 380px"
                  className="object-cover transition-transform duration-300 group-hover:scale-102"
                />
                <div className="absolute top-3 start-3">
                  <Badge tone="info">{ttypes('obsDurationBadge')}</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                    <IconEye className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{ttypes('obsTitle')}</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {ttypes('obsPurpose')}
                </p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link href="/apply" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    <span>{t('ctaApply')}</span>
                    <IconArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>

            {/* 2. Perfectionnement Card */}
            <div className="surface-card hover-lift group overflow-hidden rounded-2xl border-brand-200 dark:border-brand-900">
              <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-navy-900">
                <Image
                  src="/components/intern-types/Advanced_training_internship_illustraton_626x396.png"
                  alt={t('perfImageAlt')}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 380px"
                  className="object-cover transition-transform duration-300 group-hover:scale-102"
                />
                <div className="absolute top-3 start-3">
                  <Badge tone="brand">{ttypes('perfDurationBadge')}</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                    <IconWrench className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{ttypes('perfTitle')}</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {ttypes('perfPurpose')}
                </p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link href="/apply" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    <span>{t('ctaApply')}</span>
                    <IconArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>

            {/* 3. PFE Card */}
            <div className="surface-card hover-lift group overflow-hidden rounded-2xl">
              <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-navy-900">
                <Image
                  src="/components/intern-types/PFE_internship_illustration_2000x1334.png"
                  alt={t('pfeImageAlt')}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 380px"
                  className="object-cover transition-transform duration-300 group-hover:scale-102"
                />
                <div className="absolute top-3 start-3">
                  <Badge tone="success">{ttypes('pfeDurationBadge')}</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <IconGraduationCap className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{ttypes('pfeTitle')}</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {ttypes('pfePurpose')}
                </p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link href="/apply" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    <span>{t('ctaApply')}</span>
                    <IconArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  ABOUT TEASER — WHY THIS PLATFORM EXISTS                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="flex flex-col items-start gap-4 lg:col-span-7">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {t('aboutTeaserEyebrow')}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t('aboutTeaserTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
              {t('aboutTeaserDesc')}
            </p>

            <ul className="mt-2 flex flex-col gap-3">
              {[t('aboutTeaserPoint1'), t('aboutTeaserPoint2'), t('aboutTeaserPoint3')].map((pt) => (
                <li key={pt} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <IconCheckSquare className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{pt}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4">
              <Link href="/about">
                <Button variant="secondary">
                  {t('aboutTeaserCta')}
                  <IconArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:col-span-5">
            <div className="surface-card overflow-hidden rounded-2xl p-4 shadow-sm">
              <Image
                src="/components/about/paper_usage_problem_7438x5000.jpg"
                alt={t('paperlessAlt')}
                width={700}
                height={500}
                sizes="(max-width: 1024px) 100vw, 450px"
                className="h-56 w-full rounded-xl object-cover"
              />
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-navy-900">
                <Image
                  src="/components/about/digitalize_paper_usage_solution_150x150.svg"
                  alt={t('digitalAlt')}
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('digitalText')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  STEG HISTORY TEASER — ENERGY INFRASTRUCTURE                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative border-y border-slate-200 bg-navy-900 py-16 text-white sm:py-20 dark:border-slate-800 dark:bg-navy-950">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12">
          <div className="relative z-10 flex flex-col items-start gap-4 lg:col-span-7">
            <Badge tone="brand" className="bg-brand-500/20 text-white border-brand-400/30">
              {t('historyTeaserEyebrow')}
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl text-white">
              {t('historyTeaserTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
              {t('historyTeaserDesc')}
            </p>

            <ul className="flex flex-col gap-2.5 pt-2">
              {[t('historyTeaserPoint1'), t('historyTeaserPoint2'), t('historyTeaserPoint3')].map((pt) => (
                <li key={pt} className="flex items-center gap-3 text-sm text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4">
              <Link href="/history">
                <Button
                  variant="secondary"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                >
                  {t('historyTeaserCta')}
                  <IconArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative z-10 flex justify-center lg:col-span-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-md">
              <div className="flex items-center gap-4">
                <Image
                  src="/components/history/Engineer_working_with_wind_turbines_producing_green_energy_225x150.svg"
                  alt={t('energyWindAlt')}
                  width={100}
                  height={70}
                  className="h-16 w-auto shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{t('energyWindTitle')}</span>
                  <span className="text-xs text-slate-300">
                    {t('energyWindDesc')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-white/10 pt-4">
                <Image
                  src="/components/history/Geothermal_energy_renewable_sources_illustration_225x150.svg"
                  alt={t('energyGeoAlt')}
                  width={100}
                  height={70}
                  className="h-16 w-auto shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{t('energyGasTitle')}</span>
                  <span className="text-xs text-slate-300">
                    {t('energyGasDesc')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  INTERNSHIP COMPANION MOBILE APP PREVIEW                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Phone Frame Mockup */}
          <div className="relative flex justify-center lg:col-span-5">
            <div className="relative w-64">
              <div className="relative overflow-hidden rounded-[2.2rem] border-4 border-slate-800 bg-slate-900 shadow-xl dark:border-slate-700">
                {/* Phone speaker notch */}
                <div className="absolute top-2 start-1/2 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-slate-800" />
                <Image
                  src="/components/intern-mobile-app/mobile_app_intern_1335x2000.jpg"
                  alt={t('mobileAppAlt', {productName})}
                  width={500}
                  height={750}
                  sizes="256px"
                  className="h-auto w-full object-cover"
                />
              </div>

              {/* Status Chip */}
              <div className="absolute -bottom-3 -end-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-navy-900">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t('syncChip')}
                </span>
              </div>
            </div>
          </div>

          {/* Text & Points */}
          <div className="flex flex-col items-start gap-4 lg:col-span-7">
            <Badge tone="brand">{t('compTeaserEyebrow')}</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t('compTeaserTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
              {t('compTeaserDesc', {productName})}
            </p>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
              {[
                {title: t('compPoint1'), icon: <IconTrendingUp className="h-4 w-4" />},
                {title: t('compPoint2'), icon: <IconCheckSquare className="h-4 w-4" />},
                {title: t('compPoint3'), icon: <IconBook className="h-4 w-4" />},
                {title: t('compPoint4'), icon: <IconMessage className="h-4 w-4" />},
                {title: t('compPoint5'), icon: <IconLayers className="h-4 w-4" />},
              ].map((pt) => (
                <div
                  key={pt.title}
                  className="surface-card flex items-center gap-3 rounded-xl p-3 shadow-2xs"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-navy-800 dark:text-brand-300">
                    {pt.icon}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{pt.title}</span>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <Link href="/companion">
                <Button size="md">
                  {t('compTeaserCta')}
                  <IconArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  CERTIFICATION & ATTESTATION SHOWCASE                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="surface-card relative flex w-full flex-col items-center justify-between gap-8 overflow-hidden rounded-2xl p-8 shadow-xs md:flex-row">
          <div className="flex flex-col gap-3 max-w-xl">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t('certEyebrow')}
            </span>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('certTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t('certDesc')}
            </p>
          </div>
          <div className="shrink-0">
            <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-slate-200 shadow-xs dark:border-slate-700">
              <Image
                src="/components/home/internship_certificate_award_illustration_2000x2000.jpg"
                alt={t('certAlt')}
                fill
                sizes="160px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  FINAL CALL TO ACTION                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-7xl px-4 pb-20 sm:px-6 lg:pb-28">
        <div className="relative flex w-full flex-col items-center justify-between gap-8 overflow-hidden rounded-2xl bg-brand-700 p-8 shadow-md sm:p-12 md:flex-row md:text-start dark:bg-navy-900">
          <div className="flex max-w-xl flex-col gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">{t('finalCtaTitle')}</h2>
            <p className="text-sm leading-relaxed text-brand-100 sm:text-base">{t('finalCtaDesc')}</p>
            <div className="pt-2">
              <Link
                href="/apply"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-brand-900 shadow-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{backgroundColor: '#ffffff', color: '#0f3657'}}
              >
                <span>{t('finalCtaButton')}</span>
                <IconArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>

          <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-md">
            <Image
              src="/components/home/apply_now_1024x1024.jpeg"
              alt={t('applyNowAlt')}
              fill
              sizes="176px"
              className="object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}