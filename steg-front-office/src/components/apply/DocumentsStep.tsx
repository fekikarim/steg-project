'use client';

import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';
import {StepShell} from './StepShell';
import {FieldError} from '@/components/ui/FieldError';
import {DocumentSlot, type SlotError, type SlotState} from './DocumentSlot';
import {DOCUMENT_RULES, type DocumentAiValidation} from '@/lib/api/application';
import type {UploadKind} from '@/lib/apply-wizard';

interface DocumentsStepProps {
  application: SlotState;
  assignment: SlotState;
  disabled?: boolean;
  /** Files queued before a reload/locale switch whose bytes could not be kept. */
  staleFileNames?: string[];
  aiValidations?: Record<UploadKind, DocumentAiValidation | null>;
  aiValidating?: Record<UploadKind, boolean>;
  aiErrors?: Record<UploadKind, SlotError | null>;
  /** Current full name (first + last) for AI transparency */
  fullName?: string | null;
  onRetryAi?: (kind: UploadKind) => void;
  onSelectFiles: (kind: UploadKind, files: File[]) => void;
  onCancel: (kind: UploadKind) => void;
  onRetry: (kind: UploadKind) => void;
  onRemove: (kind: UploadKind) => void;
  errorKey: string | null;
  onContinue: () => void;
}

/**
 * Step 5 — Required Documents.
 * Collects mandatory Internship Application PDF and Assignment Letter PDF,
 * with format validations and secure handling notice.
 */
export function DocumentsStep({
  application,
  assignment,
  disabled = false,
  staleFileNames = [],
  aiValidations,
  aiValidating,
  aiErrors,
  fullName = null,
  onRetryAi,
  onSelectFiles,
  onCancel,
  onRetry,
  onRemove,
  errorKey,
  onContinue,
}: DocumentsStepProps) {
  const t = useTranslations('apply.documents');
  const tn = useTranslations('apply.nav');

  const ready = Boolean(application.attachment) && Boolean(assignment.attachment);
  const aiReady =
    !aiValidating?.INTERNSHIP_APPLICATION &&
    !aiValidating?.ASSIGNMENT_LETTER &&
    Boolean(aiValidations?.INTERNSHIP_APPLICATION?.valid) &&
    Boolean(aiValidations?.ASSIGNMENT_LETTER?.valid);
  const aiBusy = Boolean(aiValidating?.INTERNSHIP_APPLICATION || aiValidating?.ASSIGNMENT_LETTER);

  return (
    <StepShell eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')}>
      {staleFileNames.length > 0 && !ready && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-500/30 bg-amber-50/90 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {t('staleUploadsNotice', {files: staleFileNames.join(', ')})}
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-6">
          <DocumentSlot
            kind="INTERNSHIP_APPLICATION"
            title={t('applicationLetter')}
            description={t('applicationLetterHint')}
            rule={DOCUMENT_RULES.INTERNSHIP_APPLICATION}
            state={application}
            disabled={disabled}
            aiValidation={aiValidations?.INTERNSHIP_APPLICATION ?? null}
            aiValidating={Boolean(aiValidating?.INTERNSHIP_APPLICATION)}
            aiError={aiErrors?.INTERNSHIP_APPLICATION ?? null}
            fullName={fullName}
            onSelect={onSelectFiles}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            onRetryAi={onRetryAi}
          />

          <DocumentSlot
            kind="ASSIGNMENT_LETTER"
            title={t('assignmentLetter')}
            description={t('assignmentLetterHint')}
            rule={DOCUMENT_RULES.ASSIGNMENT_LETTER}
            state={assignment}
            disabled={disabled}
            aiValidation={aiValidations?.ASSIGNMENT_LETTER ?? null}
            aiValidating={Boolean(aiValidating?.ASSIGNMENT_LETTER)}
            aiError={aiErrors?.ASSIGNMENT_LETTER ?? null}
            fullName={fullName}
            onSelect={onSelectFiles}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            onRetryAi={onRetryAi}
          />

          {/* Secure handling & privacy note */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3.5 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-navy-950/60 dark:text-zinc-400">
            <strong>{t('privacyTitle')} :</strong> {t('privacyBody')}
          </div>
        </div>
      </Card>

      {errorKey && <FieldError message={errorKey} />}

      {ready && !aiReady && (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {aiBusy ? t('gateWaiting') : t('gateNotValid')}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={!ready || !aiReady || disabled || aiBusy}
          aria-disabled={!ready || !aiReady || disabled || aiBusy}
          title={!ready ? t('allRequired') : !aiReady ? (aiBusy ? t('aiValidating') : t('aiGateBlocked')) : undefined}
        >
          {aiBusy ? t('aiValidating') : tn('continue')}
        </Button>
      </div>
    </StepShell>
  );
}
