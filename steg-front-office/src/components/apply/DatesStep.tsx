'use client';

import {useMemo} from 'react';
import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';
import {DatePicker} from '@/components/ui/DatePicker';
import {Badge} from '@/components/ui/Badge';
import {StepShell} from './StepShell';
import {FieldError} from '@/components/ui/FieldError';
import type {ClassificationResult} from '@/lib/api/application';

interface DatesStepProps {
  startDate: string;
  endDate: string;
  classification: ClassificationResult | null;
  onChange: (start: string, end: string) => void;
  errorKey: string | null;
  onContinue: () => void;
}

/**
 * Step 3 — Internship Dates & Automatic Classification.
 * Computes duration, derived type, mandatory status, and plain-language reasoning
 * as an interactive live preview. Clarifies that the backend is authoritative.
 */
export function DatesStep({
  startDate,
  endDate,
  classification,
  onChange,
  errorKey,
  onContinue,
}: DatesStepProps) {
  const t = useTranslations('apply.dates');
  const ta = useTranslations('apply');
  const tn = useTranslations('apply.nav');

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  function isoToUtcMsLocal(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function isValidIsoLocal(iso: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  const startInvalid = useMemo(() => {
    if (!startDate || !endDate) return false;
    if (!isValidIsoLocal(startDate) || !isValidIsoLocal(endDate)) return false;
    return isoToUtcMsLocal(endDate) < isoToUtcMsLocal(startDate);
  }, [startDate, endDate]);

  const startInPast = useMemo(() => {
    if (!startDate || !isValidIsoLocal(startDate)) return false;
    return isoToUtcMsLocal(startDate) < isoToUtcMsLocal(todayStr);
  }, [startDate, todayStr]);

  const isBoundaryWarning = useMemo(() => {
    if (!classification) return false;
    // < 15 days or > 180 days is unusual
    return classification.durationInDays < 15 || classification.durationInDays > 180;
  }, [classification]);

  const typeLabel = useMemo(() => {
    if (!classification) return null;
    switch (classification.type) {
      case 'OBSERVATION':
        return t('typeObservation');
      case 'PERFECTIONNEMENT':
        return t('typePerfectionnement');
      case 'PFE':
        return t('typePfe');
    }
  }, [classification, t]);

  const durationText = useMemo(() => {
    if (!classification) return null;
    const days = classification.durationInDays;
    if (days < 30) return t('durationDays', {count: days});
    // Derive calendar months accurately for display (mirrors backend Period, not 30-day approximation)
    // Use actual date difference to avoid 30-day drift
    if (startDate && endDate && isValidIsoLocal(startDate) && isValidIsoLocal(endDate)) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      let y = ey - sy;
      let m = em - sm;
      let d = ed - sd;
      if (d < 0) {
        m -= 1;
        const prev = new Date(Date.UTC(ey, em - 1, 0)).getUTCDate();
        d += prev;
      }
      if (m < 0) {
        y -= 1;
        m += 12;
      }
      const totalMonths = y * 12 + m;
      return t('durationMonths', {months: totalMonths, days: d});
    }
    const months = Math.floor(days / 30);
    const remDays = days % 30;
    return t('durationMonths', {months, days: remDays});
  }, [classification, t, startDate, endDate]);

  const ruleDesc = useMemo(() => {
    if (!classification) return null;
    switch (classification.type) {
      case 'PFE':
        return t('pfeDesc');
      case 'PERFECTIONNEMENT':
        return t('perfDesc');
      default:
        return t('obsDesc');
    }
  }, [classification, t]);

  const statusLabel = useMemo(() => {
    if (!classification) return null;
    return classification.requirement === 'OBLIGATOIRE'
      ? t('requirementObligatoire')
      : t('requirementOptional');
  }, [classification, t]);

  return (
    <StepShell eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')}>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            id="apply-start-date"
            label={t('startDate')}
            hint={t('startHint')}
            value={startDate}
            min={todayStr}
            required
            error={startInPast ? t('errorStartInPast') : undefined}
            onChange={(e) => onChange(e.target.value, endDate)}
          />
          <DatePicker
            id="apply-end-date"
            label={t('endDate')}
            hint={t('endHint')}
            value={endDate}
            min={startDate && isValidIsoLocal(startDate) ? startDate : todayStr}
            error={startInvalid ? t('errorEndBeforeStart') : startInPast ? t('errorStartInPast') : undefined}
            onChange={(e) => onChange(startDate, e.target.value)}
          />
        </div>
      </Card>

      {/* Live Classification Preview Card */}
      {classification && !startInvalid && (
        <Card className="border-brand-200 bg-brand-50/40 dark:border-brand-800 dark:bg-brand-950/20">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-brand-100 pb-3 dark:border-brand-900">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                {ta('calcPreviewBadge')}
              </span>
              <Badge tone={classification.type === 'PFE' ? 'brand' : classification.type === 'PERFECTIONNEMENT' ? 'info' : 'neutral'}>
                {typeLabel}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col rounded-xl bg-white p-3 shadow-xs dark:bg-navy-900">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{ta('calcDuration')}</span>
                <span className="mt-1 text-sm font-bold text-navy-900 dark:text-zinc-100">{durationText}</span>
              </div>
              <div className="flex flex-col rounded-xl bg-white p-3 shadow-xs dark:bg-navy-900">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{ta('calcType')}</span>
                <span className="mt-1 text-sm font-bold text-brand-700 dark:text-brand-300">{typeLabel}</span>
              </div>
              <div className="flex flex-col rounded-xl bg-white p-3 shadow-xs dark:bg-navy-900">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{ta('calcStatus')}</span>
                <span className="mt-1 text-sm font-bold text-navy-900 dark:text-zinc-100">{statusLabel}</span>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 text-xs leading-relaxed text-zinc-700 dark:bg-navy-900 dark:text-zinc-300">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{ta('calcReason')} </span>
              <span>{ruleDesc}</span>
            </div>

            {isBoundaryWarning && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                ⚠️ {ta('calcWarningBoundary')}
              </div>
            )}

            <p className="text-[11px] text-zinc-500 italic dark:text-zinc-400">
              {ta('calcAuthorityNotice')}
            </p>
          </div>
        </Card>
      )}

      {errorKey && <FieldError message={errorKey} />}

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={!startDate || !endDate || startInvalid || startInPast || !isValidIsoLocal(startDate) || !isValidIsoLocal(endDate)}
        >
          {tn('continue')}
        </Button>
      </div>
    </StepShell>
  );
}
