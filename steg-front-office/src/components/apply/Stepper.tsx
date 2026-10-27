'use client';

import {useTranslations} from 'next-intl';
import {useLocale} from 'next-intl';
import {cx} from '@/lib/cx';

export interface StepDef {
  id: string;
  key: string;
}

interface StepperProps {
  steps: StepDef[];
  current: number;
}

/**
 * Wizard progress stepper (B4, compacted in B5). Numbered milestones stay
 * readable down to small phones: pills carry number-only badges (labels are
 * screen-reader-only) and a visible caption announces "Step X of 8 — label".
 * Full text labels inside every pill never fit an 8-step row (they overflow
 * even desktop content columns), so they live in the caption instead.
 * RTL-aware (logical flex direction). Each milestone carries aria-current
 * for the active step.
 */
export function Stepper({steps, current}: StepperProps) {
  const t = useTranslations('apply.stepper');
  const locale = useLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const label = (k: string) => (t as (key: string) => string)(`steps.${k}`);

  return (
    <nav
      aria-label={t('step')}
      dir={dir}
      className="mb-8 w-full surface-card rounded-2xl p-4 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-navy-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400" />
          <p className="text-sm font-bold text-navy-950 dark:text-white">
            {t('step')} <span className="font-mono text-brand-700 dark:text-brand-300">0{current + 1}</span> {t('of', {total: steps.length})}
            <span className="font-normal text-zinc-500 dark:text-zinc-400"> — {label(steps[current]?.key ?? '')}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-mono font-medium text-brand-800 dark:border-brand-800/60 dark:bg-brand-950/50 dark:text-brand-300">
          {t('progressLabel', {percent: Math.round(((current + 1) / steps.length) * 100)})}
        </span>
      </div>

      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((step, i) => {
          const state =
            i < current ? 'done' : i === current ? 'current' : 'upcoming';
          const isLast = i === steps.length - 1;
          return (
            <li
              key={step.id}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cx('flex min-w-0 items-center gap-1 sm:gap-2', !isLast && 'flex-1')}
            >
              <div
                className={cx(
                  'relative flex min-w-0 items-center gap-2 rounded-full p-1 transition-all duration-300 sm:px-2',
                  state === 'current' &&
                    'bg-brand-50/80 ring-2 ring-brand-500/40 shadow-xs dark:bg-brand-950/40 dark:ring-brand-400',
                  state === 'done' && 'hover:bg-brand-50/40 dark:hover:bg-white/5'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all sm:h-7 sm:w-7 sm:text-xs',
                    state === 'done' && 'bg-brand-600 text-white shadow-xs',
                    state === 'current' &&
                      'border-2 border-brand-600 bg-white font-mono text-brand-700 shadow-xs ring-4 ring-brand-500/15 dark:border-brand-400 dark:bg-navy-950 dark:text-brand-300 dark:ring-brand-500/20',
                    state === 'upcoming' &&
                      'border border-zinc-300 bg-zinc-50 font-mono text-zinc-400 dark:border-zinc-700 dark:bg-navy-900 dark:text-zinc-500',
                  )}
                >
                  {state === 'done' ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3 sm:h-3.5 sm:w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="sr-only">{label(step.key)}</span>
              </div>
              {!isLast && (
                <div
                  aria-hidden="true"
                  className="relative h-1 min-w-3 flex-1 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800"
                >
                  <div
                    className={cx(
                      'h-full w-full rounded-full transition-all duration-500',
                      state === 'done'
                        ? 'bg-brand-600 dark:bg-brand-500'
                        : i === current - 1
                          ? 'bg-brand-400'
                          : 'bg-transparent'
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
