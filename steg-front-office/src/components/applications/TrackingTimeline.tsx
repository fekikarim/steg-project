'use client';

import {useTranslations} from 'next-intl';
import type {ApplicationResponse} from '@/lib/api/application';

interface TimelineStage {
  key: string;
  labelKey: string;
  descKey: string;
  state: 'reached' | 'active' | 'future';
  date: string | null;
}

const STAGE_PIPELINE: Array<{key: string; statuses: string[]; labelKey: string; descKey: string}> = [
  {key: 'draft',       statuses: ['DRAFT'],                     labelKey: 'timelineStateDraft',       descKey: 'timelineStateDraftDesc'},
  {key: 'submitted',   statuses: ['SUBMITTED', 'RESUBMITTED'],   labelKey: 'timelineStateSubmitted',   descKey: 'timelineStateSubmittedDesc'},
  {key: 'underReview', statuses: ['UNDER_REVIEW', 'MODIFICATION_REQUESTED'], labelKey: 'timelineStateUnderReview', descKey: 'timelineStateUnderReviewDesc'},
  {key: 'decision',    statuses: ['APPROVED', 'REJECTED'],       labelKey: 'timelineStateAccepted',    descKey: 'timelineStateAcceptedDesc'},
  {key: 'preparation', statuses: [],                            labelKey: 'timelineStatePrep',        descKey: 'timelineStatePrepDesc'},
  {key: 'inProgress',  statuses: [],                            labelKey: 'timelineStateInProgress',  descKey: 'timelineStateInProgressDesc'},
  {key: 'completed',   statuses: [],                            labelKey: 'timelineStateCompleted',   descKey: 'timelineStateCompletedDesc'},
];

function buildFullTimeline(app: ApplicationResponse): TimelineStage[] {
  const statusToStageIndex: Record<string, number> = {
    DRAFT: 0,
    SUBMITTED: 1,
    RESUBMITTED: 1,
    UNDER_REVIEW: 2,
    MODIFICATION_REQUESTED: 2,
    APPROVED: 3,
    REJECTED: 3,
    WITHDRAWN: -1,
  };
  const activeIdx = statusToStageIndex[app.status] ?? -1;
  const isRejected = app.status === 'REJECTED';

  return STAGE_PIPELINE.map((stage, i) => {
    let state: 'reached' | 'active' | 'future';
    if (activeIdx < 0) {
      state = i === 0 ? 'reached' : 'future';
    } else if (i < activeIdx) {
      state = 'reached';
    } else if (i === activeIdx) {
      state = 'active';
    } else {
      state = 'future';
    }

    let date: string | null = null;
    // STEG Architectural Decision: TrackingTimeline is used on public tracking pages (/track/[token])
    // where authentication is not available. Only ApplicationResponse (or PublicApplicationTrackingResponse)
    // metadata is accessible; granular workflow transition timestamps require authenticated getApplicationWorkflow.
    // Therefore, date milestones intentionally fall back to createdAt, submissionDate, and updatedAt.
    if (state === 'reached' || state === 'active') {
      if (i === 0) date = app.createdAt;
      else if (i === 1) date = app.submissionDate;
      else date = app.updatedAt;
    }

    const labelKey = stage.key === 'decision' && isRejected
      ? 'timelineStateRejected'
      : stage.labelKey;

    return {key: stage.key, labelKey, descKey: stage.descKey, state, date};
  });
}

export function TrackingTimeline({application: app}: {application: ApplicationResponse}) {
  const t = useTranslations('tracking');
  const tc = useTranslations('companion');
  const productName = tc('productName');
  const stages = buildFullTimeline(app);
  

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-4 bottom-4 w-px bg-zinc-200 dark:bg-zinc-800" />

      {stages.map((stage) => {
        const isReached = stage.state === 'reached' || stage.state === 'active';
        const isActive = stage.state === 'active';
        return (
          <div key={stage.key} className="relative flex gap-4 py-4">
            {/* Dot */}
            <div
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                isReached
                  ? isActive
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-brand-600 bg-white text-brand-600 dark:border-brand-400 dark:text-brand-400'
                  : 'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-navy-900 dark:text-zinc-600'
              }`}
            >
              {isReached && !isActive && (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {isActive && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-medium ${isReached ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
                  {(t as (key: string) => string)(stage.labelKey)}
                </span>
                {isActive && (
                  <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                    {t('timelineCurrent')}
                  </span>
                )}
              </div>
              <p className={`text-sm ${isReached ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-400'}`}>
                {(t as (key: string, values?: Record<string, string>) => string)(stage.descKey, {productName})}
              </p>
              {stage.date && (
                <p className="mt-1 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  {stage.date}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
