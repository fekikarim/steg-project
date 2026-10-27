'use client';

import {useRef} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Badge, StatusPill} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {FileDropzone} from '@/components/ui/FileDropzone';
import {FieldError} from '@/components/ui/FieldError';
import {cx} from '@/lib/cx';
import {extensionsLabel, formatBytes} from '@/lib/files';
import type {ApplicationDocumentResponse, DocumentRule} from '@/lib/api/application';
import type {UploadKind} from '@/lib/apply-wizard';

export type SlotPhase = 'idle' | 'uploading' | 'attaching' | 'error' | 'cancelled';

export interface SlotError {
  message: string;
  traceId?: string | null;
  retryable: boolean;
}

export interface SlotState {
  phase: SlotPhase;
  /** 0–100 while uploading, null when the total is unknown. */
  progress: number | null;
  pendingName: string | null;
  pendingSize: number | null;
  error: SlotError | null;
  attachment: ApplicationDocumentResponse | null;
}

export const idleSlot = (attachment: ApplicationDocumentResponse | null = null): SlotState => ({
  phase: 'idle',
  progress: null,
  pendingName: null,
  pendingSize: null,
  error: null,
  attachment,
});

import type {DocumentAiValidation} from '@/lib/api/application';

interface DocumentSlotProps {
  kind: UploadKind;
  title: string;
  description: string;
  rule: DocumentRule;
  state: SlotState;
  /** Whole-wizard busy flag (e.g. draft saving). */
  disabled?: boolean;
  aiValidation?: DocumentAiValidation | null;
  aiValidating?: boolean;
  aiError?: SlotError | null;
  /** Current full name for transparency (first + last) */
  fullName?: string | null;
  onSelect: (kind: UploadKind, files: File[]) => void;
  onCancel: (kind: UploadKind) => void;
  onRetry: (kind: UploadKind) => void;
  onRemove: (kind: UploadKind) => void;
  onRetryAi?: (kind: UploadKind) => void;
}

/**
 * B5 production upload slot: backend-confirmed constraints display, real
 * accessible progress with cancel, localized backend-error surfacing with
 * retry, and a success state showing document metadata, verification status
 * and replace/remove actions. Only safe metadata is ever rendered
 * (originalFileName, size, MIME, upload date, verification) — never storage
 * keys or internal paths, which the backend does not even expose.
 */
export function DocumentSlot({
  kind,
  title,
  description,
  rule,
  state,
  disabled = false,
  aiValidation = null,
  aiValidating = false,
  aiError = null,
  fullName = null,
  onSelect,
  onCancel,
  onRetry,
  onRemove,
  onRetryAi,
}: DocumentSlotProps) {
  const t = useTranslations('apply.documents');
  const locale = useLocale();
  const pickerRef = useRef<HTMLInputElement | null>(null);

  const busy = state.phase === 'uploading' || state.phase === 'attaching';
  const units = {b: t('unitB'), kb: t('unitKB'), mb: t('unitMB')};
  const maxLabel = formatBytes(rule.maxBytes, units);
  const formatsLabel = extensionsLabel(rule.extensions);
  const uploadedDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const attachment = state.attachment;
  const doc = attachment?.document ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</span>
        {attachment ? (
          <Badge tone="success">{t('uploaded')}</Badge>
        ) : (
          <Badge tone={rule.required ? 'info' : 'neutral'}>
            {rule.required ? t('required') : t('optional')}
          </Badge>
        )}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400" dir="auto">
        {t('formatsAndSize', {formats: formatsLabel, size: maxLabel})}
      </p>

      <FileDropzone
        label={title}
        hint={t('privacyNotice')}
        accept={rule.extensions.join(',')}
        allowedExtensions={[...rule.extensions]}
        maxSizeMb={rule.maxBytes / (1024 * 1024)}
        required={rule.required}
        disabled={disabled || busy}
        managed
        pickerRef={pickerRef}
        onFiles={(files) => onSelect(kind, files)}
      />

      {state.phase === 'uploading' && (
        <div className="flex flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-zinc-800 dark:text-zinc-100" dir="auto">
              {state.pendingName}
              {state.pendingSize != null && (
                <span className="ms-2 text-xs font-normal text-zinc-500">({formatBytes(state.pendingSize, units)})</span>
              )}
            </span>
            <Button variant="tertiary" size="sm" onClick={() => onCancel(kind)}>
              {t('cancelUpload')}
            </Button>
          </div>
          <div
            role="progressbar"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.progress ?? undefined}
            aria-valuetext={
              state.progress != null ? t('uploading', {percent: state.progress}) : t('uploadingIndeterminate')
            }
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
          >
            <div
              className={cx(
                'h-full rounded-full bg-brand-600 transition-[width] duration-200 motion-reduce:transition-none dark:bg-brand-400',
                state.progress == null && 'w-1/3 animate-pulse',
              )}
              style={state.progress != null ? {width: `${state.progress}%`} : undefined}
            />
          </div>
          <p aria-hidden="true" className="text-xs text-zinc-600 dark:text-zinc-300">
            {state.progress != null ? t('uploading', {percent: state.progress}) : t('uploadingIndeterminate')}
          </p>
        </div>
      )}

      {state.phase === 'attaching' && (
        <p role="status" className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent motion-reduce:animate-none" />
          {t('attaching')}
        </p>
      )}

      {(state.phase === 'error' || state.phase === 'cancelled') && state.error && (
        <div
          role={state.phase === 'error' ? 'alert' : 'status'}
          className={cx(
            'flex flex-col gap-2 rounded-lg border p-3 text-sm',
            state.phase === 'error'
              ? 'border-accent-200 bg-accent-50/60 text-accent-800 dark:border-accent-800 dark:bg-accent-600/10 dark:text-accent-100'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-white/5 dark:text-zinc-200',
          )}
        >
          <FieldError message={state.error.message} />
          {state.error.traceId && (
            <p className="font-mono text-xs opacity-80" dir="ltr">
              traceId: {state.error.traceId}
            </p>
          )}
          {state.error.retryable && (
            <div>
              <Button variant="secondary" size="sm" onClick={() => onRetry(kind)}>
                {t('retry')}
              </Button>
            </div>
          )}
        </div>
      )}

      {attachment && doc && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-white/5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-zinc-800 dark:text-zinc-100" dir="auto">
              {doc.originalFileName}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              {t('verificationLabel')}: <StatusPill code={attachment.verificationStatus} />
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-1 text-xs text-zinc-600 sm:grid-cols-2 dark:text-zinc-300">
            <div>
              <dd className="font-medium">{t('uploadedOn', {date: uploadedDate(doc.uploadedAt)})}</dd>
            </div>
            <div>
              <dd className="font-medium" dir="ltr">
                {formatBytes(doc.sizeBytes, units)} · {doc.mimeType}
              </dd>
            </div>
          </dl>
          {attachment.verificationComment && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold">{t('verificationCommentLabel')}: </span>
              <span dir="auto">{attachment.verificationComment}</span>
            </p>
          )}
          {doc.restrictedAccess && (
            <p>
              <Badge tone="warning">{t('restrictedNote')}</Badge>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="tertiary" size="sm" onClick={() => pickerRef.current?.click()} disabled={disabled || busy || aiValidating}>
              {t('replace')}
            </Button>
            <Button variant="tertiary" size="sm" onClick={() => onRemove(kind)} disabled={disabled || busy || aiValidating}>
              {t('remove')}
            </Button>
          </div>
        </div>
      )}

      {/* AI Document Intelligence gate – must pass before Continue */}
      {attachment && aiValidating && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
          <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-600 border-t-transparent motion-reduce:animate-none" />
          <span className="font-medium">{t('aiValidating')}</span>
        </div>
      )}

      {attachment && !aiValidating && aiError && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-medium">{aiError.message}</p>
          {aiError.traceId && (
            <p className="font-mono opacity-80" dir="ltr">traceId: {aiError.traceId}</p>
          )}
          {aiError.retryable && onRetryAi && (
            <div>
              <Button variant="secondary" size="sm" onClick={() => onRetryAi(kind)}>
                {t('aiRetry')}
              </Button>
            </div>
          )}
        </div>
      )}

      {attachment && !aiValidating && !aiError && aiValidation && (
        <div
          role={aiValidation.valid ? 'status' : 'alert'}
          aria-live="polite"
          className={cx(
            'flex flex-col gap-3 rounded-lg border px-3 py-3 text-xs',
            aiValidation.valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
          )}
        >
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none',
                aiValidation.valid
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                  : 'bg-amber-500 text-white dark:bg-amber-500',
              )}
            >
              {aiValidation.valid ? '✓' : '⚠'}
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="font-semibold leading-relaxed text-[13px]">
                {aiValidation.valid ? t('aiValid') : t('aiInvalid')}
                <span className="ms-1.5 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] opacity-80 dark:bg-white/10">
                  {Math.round(aiValidation.confidence * 100)}%
                </span>
              </p>
              <p className="leading-relaxed opacity-90" dir="auto">
                {aiValidation.reason}
              </p>
            </div>
          </div>

          {/* Structured breakdown — professional transparency */}
          {(() => {
            const expectedLabel =
              kind === 'INTERNSHIP_APPLICATION' ? t('aiExpectedInternship') : t('aiExpectedAssignment');
            const displayName = (fullName || '').trim();
            const toks = displayName ? displayName.split(/\s+/).filter(Boolean) : [];
            const reversed =
              toks.length >= 2 ? `${toks.slice(1).join(' ')} ${toks[0]}` : displayName ? [...toks].reverse().join(' ') : '';
            // For multi-word last names like "Ben Ali", show the proper last+first (toks[1:]+toks[0])
            const alt = toks.length > 2 ? `${toks.slice(1).join(' ')} ${toks[0]}` : reversed;
            return (
              <div className="grid gap-2 rounded-lg bg-white/60 p-2.5 dark:bg-black/10">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className={cx('mt-0.5 text-sm', aiValidation.documentTypeValid ? 'text-emerald-600' : 'text-amber-600')}>
                    {aiValidation.documentTypeValid ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 leading-relaxed">
                    <span className="font-semibold">{t('aiCheckType')} </span>
                    <span dir="auto" className="opacity-90">
                      {aiValidation.documentTypeValid ? (
                        <>{t('aiTypeFound', {expected: expectedLabel})}</>
                      ) : (
                        <>{t('aiTypeNotFound', {expected: expectedLabel})}</>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className={cx('mt-0.5 text-sm', aiValidation.candidateNameValid ? 'text-emerald-600' : 'text-amber-600')}>
                    {aiValidation.candidateNameValid ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 leading-relaxed">
                    <span className="font-semibold">{t('aiCheckName')} </span>
                    <span dir="auto" className="opacity-90">
                      {displayName ? (
                        aiValidation.candidateNameValid ? (
                          <>{t('aiNameFound', {fullName: displayName, alt})}</>
                        ) : (
                          <>{t('aiNameNotFound', {fullName: displayName, alt})}</>
                        )
                      ) : (
                        <>{t('aiNameMissing')}</>
                      )}
                    </span>
                  </div>
                </div>
                {!aiValidation.valid && (
                  <p className="rounded bg-amber-100/70 px-2.5 py-2 font-medium leading-relaxed text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
                    {t('aiReplaceGuidance')}
                  </p>
                )}
              </div>
            );
          })()}

          {!aiValidation.valid && onRetryAi && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => onRetryAi(kind)}>
                {t('aiRetry')}
              </Button>
              <Button variant="tertiary" size="sm" onClick={() => pickerRef.current?.click()} disabled={disabled || busy}>
                {t('replace')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
