import Image from 'next/image';
import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {ApplyWizard} from '@/components/apply/ApplyWizard';

/**
 * B4 & Final V1 — Internship application portal at `/[locale]/apply`.
 * High-tech futuristic interface with real STEG collaboration assets,
 * video presentation modal/card, telemetry badges, and 7-step guided journey.
 */
export default async function ApplyPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('apply');

  return (
    <div className="relative overflow-hidden py-8 sm:py-12">
      {/* Ambient Institutional Lighting */}
      <div className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-96 w-[800px] rounded-full bg-brand-500/5 blur-3xl dark:bg-brand-400/10" />
      <div className="pointer-events-none absolute top-1/2 end-0 h-80 w-80 rounded-full bg-navy-600/5 blur-3xl dark:bg-navy-700/10" />

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* Institutional Hero Banner */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-navy-800 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-6 sm:p-10 shadow-xl text-white">
          <div className="absolute -top-32 -end-32 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -start-32 h-64 w-64 rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-300 shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {t('landingPortal')}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-mono text-zinc-300">
                  {t('landingSession')}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                <span className="block text-white">{t('title')}</span>
                <span className="block text-xl sm:text-2xl font-bold mt-1 text-brand-300">
                  {t('landingTagline')}
                </span>
              </h1>

              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl">
                {t('subtitle')} {t('landingSubtitleExtra')}
              </p>

              {/* Telemetry chips */}
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs">
                  <span className="block text-[10px] uppercase font-mono text-zinc-400">{t('metricSteps')}</span>
                  <span className="font-bold text-white">{t('metricStepsValue')}</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs">
                  <span className="block text-[10px] uppercase font-mono text-zinc-400">{t('metricTime')}</span>
                  <span className="font-bold text-brand-300">{t('metricTimeValue')}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs">
                  <span className="block text-[10px] uppercase font-mono text-zinc-400">{t('metricSecurity')}</span>
                  <span className="font-bold text-emerald-400">{t('metricSecurityValue')}</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Media Teaser */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="relative group overflow-hidden rounded-2xl border border-white/10 bg-navy-950/80 shadow-xl">
                <video
                  src="/components/apply/Business_Meeting_Presentation_1920x1080.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-44 sm:h-52 object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 start-3 end-3 flex items-center justify-between text-xs text-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold text-white">{t('mediaCaption')}</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-300" dir="ltr">{t('mediaQuality')}</span>
                </div>
              </div>

              {/* Mentorship highlight with teamwork preview */}
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/20">
                  <Image
                    src="/components/apply/teamwork_2000x2000.jpg"
                    alt={t('mentorAlt')}
                    width={200}
                    height={200}
                    sizes="48px"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white">{t('mentorTitle')}</p>
                  <p className="text-zinc-400 text-[11px]">{t('mentorDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The Application Wizard Shell */}
        <div className="relative">
          <ApplyWizard />
        </div>
      </div>
    </div>
  );
}

