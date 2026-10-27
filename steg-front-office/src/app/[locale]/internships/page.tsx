import Image from 'next/image';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {
  IconArrowRight,
  IconEye,
  IconGraduationCap,
  IconSparkles,
  IconWrench,
} from '@/components/ui/icons';
import type {AppLocale} from '@/i18n/routing';

/**
 * Rebuilt Internship Types Page (Phase B7):
 * - Detailed presentation of the 3 official STEG internship types with illustrations
 * - Observation, Perfectionnement, and PFE requirements
 * - Direct feature comparison matrix table
 * - Modern modalities (onsite, hybrid, remote with motion video)
 * - Strategically positioned "Apply" action buttons
 */
export default async function InternshipsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('internships');

  const types = [
    {
      id: 'observation',
      title: t('obsTitle'),
      durationBadge: t('obsDurationBadge'),
      tone: 'info' as const,
      image: '/components/intern-types/observation_internship_illustration_2000x1667.png',
      rule: t('obsMandatoryRule'),
      purpose: t('obsPurpose'),
      theme: t('obsThemeRule'),
      deliverables: t('obsDeliverables'),
      companion: t('obsCompanionRole'),
      icon: <IconEye className="h-6 w-6 text-brand-600 dark:text-brand-300" />,
    },
    {
      id: 'perfectionnement',
      title: t('perfTitle'),
      durationBadge: t('perfDurationBadge'),
      tone: 'brand' as const,
      image: '/components/intern-types/Advanced_training_internship_illustraton_626x396.png',
      rule: t('perfMandatoryRule'),
      purpose: t('perfPurpose'),
      theme: t('perfThemeRule'),
      deliverables: t('perfDeliverables'),
      companion: t('perfCompanionRole'),
      icon: <IconWrench className="h-6 w-6 text-brand-600 dark:text-brand-300" />,
    },
    {
      id: 'pfe',
      title: t('pfeTitle'),
      durationBadge: t('pfeDurationBadge'),
      tone: 'success' as const,
      image: '/components/intern-types/PFE_internship_illustration_2000x1334.png',
      rule: t('pfeMandatoryRule'),
      purpose: t('pfePurpose'),
      theme: t('pfeThemeRule'),
      deliverables: t('pfeDeliverables'),
      companion: t('pfeCompanionRole'),
      icon: <IconGraduationCap className="h-6 w-6 text-brand-600 dark:text-brand-300" />,
    },
  ];

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-zinc-50/40 dark:bg-navy-950">
      {/* Ambient Institutional Lighting */}
      <div className="pointer-events-none absolute -top-40 start-0 h-96 w-96 rounded-full bg-brand-500/5 blur-3xl dark:bg-brand-400/10" />
      <div className="pointer-events-none absolute bottom-1/4 end-0 h-96 w-96 rounded-full bg-navy-600/5 blur-3xl dark:bg-navy-700/10" />

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
      {/*  THE THREE INTERNSHIP TYPES (DETAILED CARDS)                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6">
        {types.map((type, idx) => (
          <div
            key={type.id}
            className={`surface-card hover-lift group grid grid-cols-1 items-center gap-8 rounded-3xl p-6 shadow-sm transition-all lg:grid-cols-12 lg:p-8 ${
              idx % 2 === 1 ? 'lg:flex-row-reverse' : ''
            }`}
          >
            {/* Visual */}
            <div className={`relative h-72 w-full overflow-hidden rounded-2xl bg-zinc-100 lg:col-span-5 dark:bg-navy-900 ${
              idx % 2 === 1 ? 'lg:order-2' : 'lg:order-1'
            }`}>
              <Image
                src={type.image}
                alt={type.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 500px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute bottom-3 start-3">
                <Badge tone={type.tone} className="backdrop-blur-xs font-semibold">{type.durationBadge}</Badge>
              </div>
            </div>

            {/* Content Details */}
            <div className={`flex flex-col gap-4 lg:col-span-7 ${
              idx % 2 === 1 ? 'lg:order-1' : 'lg:order-2'
            }`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-xs dark:bg-brand-950/60 dark:text-brand-300">
                  {type.icon}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  {t('trackLabel')}
                </span>
              </div>

              <h2 className="text-2xl font-black text-navy-950 dark:text-white">{type.title}</h2>

              <div className="flex flex-col gap-2.5 text-xs leading-relaxed text-zinc-700 sm:text-sm dark:text-zinc-300">
                <p className="font-semibold text-brand-800 dark:text-brand-300">{type.rule}</p>
                <p>{type.purpose}</p>
                <p className="text-zinc-600 dark:text-zinc-400">{type.theme}</p>
                <p className="text-zinc-600 dark:text-zinc-400">{type.deliverables}</p>
                <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-navy-800 dark:bg-navy-900/60">
                  <IconSparkles className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{type.companion}</span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/apply">
                  <Button size="md" variant="primary" className="rounded-xl">
                    <span>{t('applyCtaText')}</span>
                    <IconArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Global Prominent Call to Action */}
        <div className="surface-card flex flex-col items-center justify-between gap-6 rounded-3xl p-8 shadow-sm sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 p-2 shadow-xs dark:bg-brand-950/60">
                <Image
                  src="/components/intern-types/join_us_225x150.svg"
                  alt={t('joinImageAlt')}
                width={70}
                height={50}
                className="h-12 w-auto"
              />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-black text-navy-950 dark:text-white">
                {t('joinTitle')}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t('joinDesc')}
              </p>
            </div>
          </div>
          <Link href="/apply" className="shrink-0">
            <Button size="lg" variant="primary" className="rounded-xl">
              <span>{t('applyButtonGlobal')}</span>
              <IconArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  COMPARISON MATRIX                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative border-y border-zinc-200/80 bg-white py-16 sm:py-20 dark:border-navy-800 dark:bg-navy-900/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6">
          <div className="flex flex-col items-start gap-2">
            <Badge tone="brand" className="w-fit font-semibold">{t('matrixBadge')}</Badge>
            <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
              {t('matrixTitle')}
            </h2>
          </div>

          <div className="surface-card overflow-hidden rounded-2xl p-0 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs rtl:text-right sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-navy-800 dark:bg-navy-900">
                    <th scope="col" className="px-5 py-4 font-bold text-zinc-700 dark:text-zinc-200">{t('matrixColType')}</th>
                    <th scope="col" className="px-5 py-4 font-bold text-zinc-700 dark:text-zinc-200">{t('matrixColDuration')}</th>
                    <th scope="col" className="px-5 py-4 font-bold text-zinc-700 dark:text-zinc-200">{t('matrixColRule')}</th>
                    <th scope="col" className="px-5 py-4 font-bold text-zinc-700 dark:text-zinc-200">{t('matrixColTheme')}</th>
                    <th scope="col" className="px-5 py-4 font-bold text-zinc-700 dark:text-zinc-200">{t('matrixColCompanion')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-navy-800/80">
                  <tr className="hover:bg-zinc-50/60 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-5 py-4 font-bold text-navy-950 dark:text-white">{t('obsTitle')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300 font-mono whitespace-nowrap">{t('obsDuration')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{t('obsRule')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{t('obsTheme')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{t('obsCompanion')}</td>
                  </tr>
                  <tr className="hover:bg-zinc-50/60 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-5 py-4 font-bold text-navy-950 dark:text-white">{t('perfTitle')}</td>
                    <td className="px-5 py-4 font-mono font-bold whitespace-nowrap text-brand-700 dark:text-brand-300">{t('perfDuration')}</td>
                    <td className="px-5 py-4 font-bold text-brand-700 dark:text-brand-300">{t('perfRule')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{t('perfTheme')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{t('perfCompanion')}</td>
                  </tr>
                  <tr className="hover:bg-zinc-50/60 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-5 py-4 font-bold text-navy-950 dark:text-white">{t('pfeTitle')}</td>
                    <td className="px-5 py-4 font-mono font-bold whitespace-nowrap text-emerald-700 dark:text-emerald-400">{t('pfeDuration')}</td>
                    <td className="px-5 py-4 font-bold text-emerald-700 dark:text-emerald-400">{t('pfeRule')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{t('pfeTheme')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{t('pfeCompanion')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  FLEXIBLE MODALITIES (HYBRID & REMOTE)                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col items-start gap-2">
            <Badge tone="info" className="w-fit font-semibold">{t('modesBadge')}</Badge>
          <h2 className="text-2xl font-black tracking-tight text-navy-950 sm:text-4xl dark:text-white">
            {t('modesTitle')}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
            {t('modesLead')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Onsite */}
          <div className="surface-card hover-lift flex flex-col justify-between rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-xs dark:bg-brand-950/60 dark:text-brand-300">
                🏢
              </span>
              <h3 className="text-lg font-bold text-navy-950 dark:text-white">{t('modeOnsiteTitle')}</h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{t('modeOnsiteDesc')}</p>
            </div>
          </div>

          {/* Hybrid */}
          <div className="surface-card hover-lift group overflow-hidden rounded-2xl p-0 shadow-xs">
            <div className="relative h-44 w-full bg-zinc-100 dark:bg-navy-900">
              <Image
                src="/components/intern-types/hybrid_internship_illustration_2000x2000.jpg"
                alt={t('hybridAlt')}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col gap-2 p-5">
              <h3 className="text-lg font-bold text-navy-950 dark:text-white">{t('modeHybridTitle')}</h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{t('modeHybridDesc')}</p>
            </div>
          </div>

          {/* Remote Motion Video Showcase */}
          <div className="surface-card hover-lift group overflow-hidden rounded-2xl p-0 shadow-xs">
            <div className="relative h-44 w-full bg-black">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              >
                <source src="/components/intern-types/remote_internship_motion_graphic.mp4" type="video/mp4" />
              </video>
              <div className="absolute top-2.5 end-2.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-0.5 text-[10px] font-mono font-medium text-white backdrop-blur-xs">
                {t('motionLabel')}
              </div>
            </div>
            <div className="flex flex-col gap-2 p-5">
              <h3 className="text-lg font-bold text-navy-950 dark:text-white">{t('modeRemoteTitle')}</h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{t('modeRemoteDesc')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}