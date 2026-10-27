'use client';

import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {Button} from '@/components/ui/Button';
import {StatusPill} from '@/components/ui/Badge';
import type {ApplicationResponse} from '@/lib/api/application';
import {IconArrowRight, IconCheckSquare} from '@/components/ui/icons';

interface ActiveSituationBannerProps {
  application: ApplicationResponse | null;
}

export function ActiveSituationBanner({application}: ActiveSituationBannerProps) {
  const t = useTranslations('profile');
  const locale = useLocale();

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  if (!application) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-navy-800 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-6 sm:p-8 shadow-xl text-white">
        <div className="absolute -top-24 -end-24 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left relative z-10">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-500/15 text-2xl text-brand-300 shadow-sm">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-brand-300">
                  {t('bannerEyebrow')}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                {t('noActiveAppTitle')}
              </h2>
              <p className="mt-1 text-xs text-zinc-300 max-w-md">
                {t('noActiveAppDesc')}
              </p>
            </div>
          </div>
          <Link href="/apply">
            <Button variant="primary" size="md" className="whitespace-nowrap rounded-xl shadow-sm">
              {t('noActiveAppCta')}
              <IconArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // V39 migrated the legacy ACCEPTED status to APPROVED; V43 re-asserted it and S1b
  // removed the value from the contract.
  const isAccepted = application.status === 'APPROVED';
  const hasSupervisor = Boolean(application.reviewerId);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-navy-800 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-6 sm:p-8 shadow-xl text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-32 -end-32 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -start-32 h-64 w-64 rounded-full bg-navy-600/15 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        {/* Left info column */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/15 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-300 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t('activeSituationTitle')}
            </span>
            <StatusPill code={application.status} />
            {isAccepted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-0.5 text-[11px] font-semibold text-emerald-300 shadow-xs">
                <IconCheckSquare className="h-3.5 w-3.5" />
                {t('assignedBadge')}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-mono uppercase text-zinc-400">
                {t('activeAppRef')}:
              </span>
              <span className="font-mono text-xl font-extrabold text-brand-300 tracking-wider">
                #{application.reference}
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-300 max-w-xl">
              {t('activeSituationLead')}
            </p>
          </div>

          {/* Key metadata grid */}
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Internship Type */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <span className="block font-mono text-[10px] uppercase text-zinc-400">
                {t('activeAppType')}
              </span>
              <span className="mt-1 block text-sm font-bold text-white">
                {application.calculatedType ?? t('typeFallback')}
              </span>
            </div>

            {/* Dates */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <span className="block font-mono text-[10px] uppercase text-zinc-400">
                {t('activeAppDates')}
              </span>
              <span className="mt-1 block font-mono text-xs font-bold text-brand-300" dir="ltr">
                {application.desiredStartDate && application.desiredEndDate
                  ? `${application.desiredStartDate} → ${application.desiredEndDate}`
                  : t('datesPending')}
              </span>
            </div>

            {/* Supervisor */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <span className="block font-mono text-[10px] uppercase text-zinc-400">
                {t('activeAppSupervisor')}
              </span>
              <span className="mt-1 block text-xs font-bold text-zinc-200">
                {hasSupervisor ? t('supervisorFallback') : t('activeAppSupervisorNone')}
              </span>
            </div>
          </div>
        </div>

        {/* Right CTA */}
        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <Link href={`/applications/${application.id}`}>
            <Button variant="primary" size="md" className="rounded-xl shadow-sm">
              <span>{t('activeAppTrackBtn')}</span>
              <IconArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
          <span className="font-mono text-[11px] text-zinc-400">
            {t('updatedLabel')} : {formatDate(application.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
