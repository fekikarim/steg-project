'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {notFound} from 'next/navigation';
import {Link} from '@/i18n/navigation';
import {ApiError} from '@/lib/api-client';
import type {
  ApplicationDocumentResponse,
  ApplicationResponse,
  WorkflowInstanceResponse,
} from '@/lib/api/application';
import {
  getApplication,
  getApplicationDocuments,
  getApplicationWorkflow,
  withdrawApplication,
} from '@/lib/api/application-client';
import {formatDate, formatDateTime} from '@/lib/dates';
import {formatBytes} from '@/lib/files';
import {useToast} from '@/components/ui/Toast';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {StatusPill} from '@/components/ui/Badge';
import {Modal} from '@/components/ui/Modal';
import {FieldError} from '@/components/ui/FieldError';
import {CardSkeleton} from '@/components/feedback/Skeleton';
import {ErrorState} from '@/components/feedback/ErrorState';
import {cx} from '@/lib/cx';

type Phase = 'loading' | 'anonymous' | 'missing' | 'ready' | 'error';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TimelineStage {
  key: string;
  labelKey: string;
  descKey: string;
  /** Reached = past stage; active = current stage; future = not yet reached. */
  state: 'reached' | 'active' | 'future';
  date: string | null;
}

/**
 * Full 7-stage lifecycle:
 *   Draft → Submitted → Under review → Accepted/Rejected →
 *   Internship preparation → In progress → Completed
 *
 * Each stage is always shown; reached milestones carry timestamps,
 * future milestones appear inactive. The backend status determines
 * which stage is currently "active".
 */
const STAGE_PIPELINE: Array<{key: string; statuses: string[]; labelKey: string; descKey: string}> = [
  {key: 'draft',       statuses: ['DRAFT'],                     labelKey: 'timelineStateDraft',       descKey: 'timelineStateDraftDesc'},
  {key: 'submitted',   statuses: ['SUBMITTED', 'RESUBMITTED'],   labelKey: 'timelineStateSubmitted',   descKey: 'timelineStateSubmittedDesc'},
  {key: 'underReview', statuses: ['UNDER_REVIEW', 'MODIFICATION_REQUESTED'], labelKey: 'timelineStateUnderReview', descKey: 'timelineStateUnderReviewDesc'},
  {key: 'decision',    statuses: ['APPROVED', 'REJECTED'],       labelKey: 'timelineStateAccepted',    descKey: 'timelineStateAcceptedDesc'},
  {key: 'preparation', statuses: [],                            labelKey: 'timelineStatePrep',        descKey: 'timelineStatePrepDesc'},
  {key: 'inProgress',  statuses: [],                            labelKey: 'timelineStateInProgress',  descKey: 'timelineStateInProgressDesc'},
  {key: 'completed',   statuses: [],                            labelKey: 'timelineStateCompleted',   descKey: 'timelineStateCompletedDesc'},
];

function buildFullTimeline(app: ApplicationResponse, workflow: WorkflowInstanceResponse | null): TimelineStage[] {
  // Determine the active stage index from the current backend status.
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

  // For "decision" stage, show the right label based on actual status.
  const isRejected = app.status === 'REJECTED';

  return STAGE_PIPELINE.map((stage, i) => {
    let state: 'reached' | 'active' | 'future';
    if (activeIdx < 0) {
      // Withdrawn: show all as future except draft
      state = i === 0 ? 'reached' : 'future';
    } else if (i < activeIdx) {
      state = 'reached';
    } else if (i === activeIdx) {
      state = 'active';
    } else {
      state = 'future';
    }

    // Determine the date for reached/active stages using backend workflow dates when available.
    let date: string | null = null;
    if (state === 'reached' || state === 'active') {
      if (i === 0) date = app.createdAt;
      else if (i === 1) date = app.submissionDate;
      else if (i === 2) date = workflow?.startedAt || app.submissionDate || app.updatedAt;
      else if (i === 3) date = workflow?.completedAt || app.updatedAt;
      else date = app.updatedAt;
    }

    // Override label for rejection
    const labelKey =
      stage.key === 'decision' && isRejected
        ? 'timelineStateRejected'
        : stage.labelKey;
    const descKey =
      stage.key === 'decision' && isRejected
        ? 'timelineStateRejectedDesc'
        : stage.descKey;

    return {
      key: stage.key,
      labelKey,
      descKey,
      state,
      date,
    };
  });
}

function docTypeLabel(
  type: string,
  td: (k: string) => string,
): string {
  if (type === 'INTERNSHIP_APPLICATION') return td('applicationLetter');
  if (type === 'ASSIGNMENT_LETTER') return td('assignmentLetter');
  return type;
}

/**
 * Candidate dossier detail at `/[locale]/applications/[id]` (B6). Dossier
 * header, truthful timeline, rejection/correction alerts, document checklist
 * with verification states and authorized downloads, and backend-gated
 * withdrawal with an explanatory confirmation dialog.
 */
export function ApplicationDetail({id}: {id: string}) {
  const t = useTranslations('tracking');
  const ta = useTranslations('apply');
  const td = useTranslations('apply.documents');
  const tc = useTranslations('companion');
  const productName = tc('productName');
  const locale = useLocale();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('loading');
  const [app, setApp] = useState<ApplicationResponse | null>(null);
  const [docs, setDocs] = useState<ApplicationDocumentResponse[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowInstanceResponse | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [actionError, setActionError] = useState<{message: string; traceId?: string | null} | null>(null);

  const validId = UUID_RE.test(id);

  const load = useCallback(async () => {
    // next/navigation notFound() only takes effect during render, so a
    // missing dossier flips to the `missing` phase here and the render
    // below raises the boundary (same HTTP 404, no data leaked either way).
    try {
      const detail = await getApplication(id);
      setApp(detail);
      const [documents, flow] = await Promise.all([
        getApplicationDocuments(id).catch(() => [] as ApplicationDocumentResponse[]),
        getApplicationWorkflow(id).catch((err: unknown) => {
          // No workflow instance before submit (404) → timestamps-only timeline.
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
      ]);
      setDocs(documents);
      setWorkflow(flow);
      setPhase('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPhase('anonymous');
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setPhase('missing');
        return;
      }
      if (err instanceof ApiError) setTraceId(err.traceId ?? null);
      setPhase('error');
    }
  }, [id]);

  useEffect(() => {
    // async bootstrap on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleWithdraw() {
    if (!app) return;
    setWithdrawing(true);
    setActionError(null);
    try {
      await withdrawApplication(app.id);
      setConfirmOpen(false);
      toast.notify({title: t('withdrawSuccess'), tone: 'success'});
      await load();
    } catch (err) {
      // Backend owns eligibility: a lost race (e.g. just approved) lands here;
      // reload so the UI reflects the authoritative state either way.
      setConfirmOpen(false);
      setActionError({
        message: err instanceof ApiError ? err.message : t('withdrawError'),
        traceId: err instanceof ApiError ? (err.traceId ?? null) : null,
      });
      await load();
    } finally {
      setWithdrawing(false);
    }
  }

  if (!validId || phase === 'missing') notFound();

  if (phase === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <ErrorState
        title={ta('loadErrorTitle')}
        hint={ta('loadErrorHint')}
        traceId={traceId}
        onRetry={() => {
          setPhase('loading');
          void load();
        }}
      />
    );
  }

  if (phase === 'anonymous' || !app) {
    return (
      <Card className="mx-auto max-w-md items-center text-center">
        <h2 className="text-lg font-bold text-navy-900 dark:text-zinc-50">{ta('authRequiredTitle')}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{ta('authRequiredBody')}</p>
        <div className="flex w-full justify-center">
          <Link href="/login">
            <Button variant="primary" size="md">
              {ta('authSignIn')}
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const canWithdraw = app.status !== 'APPROVED' && app.status !== 'WITHDRAWN';
  const stages = buildFullTimeline(app, workflow);
  const statusHelp = (t as (k: string) => string)(`statusHelp.${app.status}`);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/applications"
        className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
      >
        <span aria-hidden="true" className="inline-block rtl:rotate-180">
          ←
        </span>{' '}
        {t('backToList')}
      </Link>

      {/* Dossier header */}
      <Card
        title={
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono" dir="ltr">
              {t('detailTitle', {reference: app.reference})}
            </span>
            <StatusPill code={app.status} />
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {app.calculatedType && <StatusPill code={app.calculatedType} />}
          {app.requirement && <StatusPill code={app.requirement} />}
          {!app.calculatedType && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('typeUnclassified')}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300" dir="auto">
          {statusHelp}
        </p>
        {workflow && (
          <div className="mt-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-navy-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-brand-700 dark:text-brand-300">
                {workflow.definitionName || 'Workflow'}
              </span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 font-bold text-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
                {workflow.status}
              </span>
            </div>
            {workflow.currentStepName && (
              <p className="mt-1 font-medium text-navy-900 dark:text-zinc-200">
                {t('currentStep', {step: workflow.currentStepName})}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-zinc-500 dark:text-zinc-400">
              {workflow.startedAt && <span>Démarré le {formatDateTime(workflow.startedAt, locale)}</span>}
              {workflow.completedAt && <span>Finalisé le {formatDateTime(workflow.completedAt, locale)}</span>}
            </div>
          </div>
        )}
      </Card>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-accent-200 bg-accent-50/60 px-4 py-3 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-600/10 dark:text-accent-100"
        >
          <FieldError message={actionError.message} />
          {actionError.traceId && (
            <p className="mt-1 font-mono text-xs opacity-80" dir="ltr">
              traceId: {actionError.traceId}
            </p>
          )}
        </div>
      )}

      {/* Rejection / correction alerts */}
      {app.status === 'REJECTED' && app.rejectionReason && (
        <div
          role="alert"
          className="rounded-xl border border-accent-200 bg-accent-50/60 p-4 dark:border-accent-800 dark:bg-accent-600/10"
        >
          <h2 className="text-sm font-bold text-accent-800 dark:text-accent-100">{t('rejectedTitle')}</h2>
          <p className="mt-1 text-sm text-accent-700 dark:text-accent-100" dir="auto">
            {app.rejectionReason}
          </p>
        </div>
      )}
      {app.status === 'MODIFICATION_REQUESTED' && app.correctionComment && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <h2 className="text-sm font-bold text-amber-800 dark:text-amber-200">{t('correctionTitle')}</h2>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-100" dir="auto">
            {app.correctionComment}
          </p>
        </div>
      )}

      {/* Overview */}
      <Card title={t('sectionOverview')}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-800">
            <dt className="text-zinc-500 dark:text-zinc-400">{t('fieldDates')}</dt>
            <dd className="text-end font-medium text-zinc-800 dark:text-zinc-100" dir="ltr">
              {app.desiredStartDate && app.desiredEndDate
                ? `${app.desiredStartDate} → ${app.desiredEndDate}`
                : t('notProvided')}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-800">
            <dt className="text-zinc-500 dark:text-zinc-400">{t('fieldSubmitted')}</dt>
            <dd className="text-end font-medium text-zinc-800 dark:text-zinc-100">
              {app.submissionDate ? formatDate(app.submissionDate, locale) : t('notProvided')}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-800">
            <dt className="text-zinc-500 dark:text-zinc-400">{t('fieldUpdated')}</dt>
            <dd className="text-end font-medium text-zinc-800 dark:text-zinc-100">
              {formatDateTime(app.updatedAt, locale)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-800">
            <dt className="text-zinc-500 dark:text-zinc-400">{t('fieldCreated')}</dt>
            <dd className="text-end font-medium text-zinc-800 dark:text-zinc-100">
              {formatDateTime(app.createdAt, locale)}
            </dd>
          </div>
        </dl>
      </Card>

      {/* 7-Stage Lifecycle Timeline */}
      <Card title={t('sectionTimeline')}>
        <ol className="flex flex-col gap-0">
          {stages.map((stage, i) => {
            const isLast = i === stages.length - 1;
            const label = (t as unknown as (k: string, p?: Record<string, string>) => string)(stage.labelKey, {productName});
            const desc = (t as unknown as (k: string, p?: Record<string, string>) => string)(stage.descKey, {productName});

            return (
              <li key={stage.key} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Connector line */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute top-8 bottom-0 start-[15px] w-0.5',
                      stage.state === 'reached'
                        ? 'bg-brand-600 dark:bg-brand-500'
                        : stage.state === 'active'
                          ? 'bg-brand-300 dark:bg-brand-800'
                          : 'bg-zinc-200 dark:bg-zinc-800',
                    )}
                  />
                )}

                {/* Stage circle */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all',
                    stage.state === 'reached'
                      ? 'bg-brand-600 text-white shadow-xs'
                      : stage.state === 'active'
                        ? 'border-2 border-brand-600 bg-white font-mono text-brand-700 shadow-xs ring-4 ring-brand-500/15 dark:bg-navy-950 dark:border-brand-400 dark:text-brand-300 dark:ring-brand-500/20'
                        : 'border border-zinc-300 bg-zinc-100 font-mono text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600',
                  )}
                >
                  {stage.state === 'reached' ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>0{i + 1}</span>
                  )}
                </span>

                {/* Stage content */}
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cx(
                        'text-sm font-semibold',
                        stage.state === 'reached'
                          ? 'text-brand-800 dark:text-brand-300'
                          : stage.state === 'active'
                            ? 'text-navy-900 dark:text-zinc-50'
                            : 'text-zinc-400 dark:text-zinc-500',
                      )}
                    >
                      {label}
                    </p>
                    {stage.state === 'active' && (
                      <StatusPill code={app.status} />
                    )}
                  </div>
                  <p
                    className={cx(
                      'text-xs leading-relaxed',
                      stage.state === 'future'
                        ? 'text-zinc-300 dark:text-zinc-600'
                        : 'text-zinc-500 dark:text-zinc-400',
                    )}
                  >
                    {desc}
                  </p>
                  {stage.date && (
                    <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                      <time dateTime={stage.date}>{formatDateTime(stage.date, locale)}</time>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Documents */}
      <Card title={t('sectionDocuments')}>
        {docs.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('emptyDocs')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium text-zinc-800 dark:text-zinc-100" dir="auto">
                    {d.document.originalFileName}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {docTypeLabel(d.document.type, td as (k: string) => string)} ·{' '}
                    <span dir="ltr">
                      {d.document.mimeType} ·{' '}
                      {formatBytes(d.document.sizeBytes, {
                        b: td('unitB'),
                        kb: td('unitKB'),
                        mb: td('unitMB'),
                      })}
                    </span>{' '}
                    · {td('uploadedOn', {date: formatDate(d.document.uploadedAt, locale)})}
                  </span>
                  <span>
                    <StatusPill code={d.verificationStatus} />
                  </span>
                  {(d.verificationStatus === 'REJECTED' || d.verificationStatus === 'REQUIRES_CORRECTION') &&
                    d.verificationComment && (
                      <span className="text-xs text-amber-700 dark:text-amber-300" dir="auto">
                        <span className="font-semibold">{td('verificationCommentLabel')}: </span>
                        {d.verificationComment}
                      </span>
                    )}
                </div>
                <a
                  href={`/api/documents/${d.document.id}/download`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] font-semibold text-navy-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-white/5"
                  aria-label={t('docDownload', {name: d.document.originalFileName})}
                >
                  <span aria-hidden="true">⬇</span>
                  {t('docDownload', {name: ''}).trim()}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {app.status === 'DRAFT' && (
          <Link href="/apply">
            <Button variant="primary" size="md">
              {t('continueApplication')}
            </Button>
          </Link>
        )}
        {canWithdraw ? (
          <div>
            <Button variant="secondary" size="md" onClick={() => setConfirmOpen(true)}>
              {t('withdraw')}
            </Button>
          </div>
        ) : (
          app.status === 'APPROVED' && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('withdrawClosedNote')}</p>
          )
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!withdrawing) setConfirmOpen(false);
        }}
        title={t('withdrawDialogTitle')}
        description={t('withdrawDialogBody')}
        closeLabel={t('withdrawCancel')}
        size="sm"
        footer={
          <>
            <Button variant="tertiary" size="md" onClick={() => setConfirmOpen(false)} disabled={withdrawing}>
              {t('withdrawCancel')}
            </Button>
            <Button variant="destructive" size="md" onClick={() => void handleWithdraw()} disabled={withdrawing}>
              {withdrawing ? '…' : t('withdrawConfirm')}
            </Button>
          </>
        }
      >
        <p className="font-mono text-sm font-semibold text-navy-900 dark:text-zinc-50" dir="ltr">
          {app.reference}
        </p>
      </Modal>
    </div>
  );
}
