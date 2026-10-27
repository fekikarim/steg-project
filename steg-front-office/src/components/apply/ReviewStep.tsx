'use client';

/* eslint-disable react-hooks/set-state-in-effect -- dialogs sync form state on open, intentional cascading render */
import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';
import {Badge, StatusPill} from '@/components/ui/Badge';
import {Input} from '@/components/ui/Input';
import {DatePicker} from '@/components/ui/DatePicker';
import {FieldError} from '@/components/ui/FieldError';
import {Modal} from '@/components/ui/Modal';
import {StepShell} from './StepShell';
import {FileDropzone} from '@/components/ui/FileDropzone';
import {cx} from '@/lib/cx';
import {formatBytes} from '@/lib/files';
import {useToast} from '@/components/ui/Toast';
import type {WizardDraft, PersonalInfoDraft, EducationDraft, UploadKind} from '@/lib/apply-wizard';
import type {University} from '@/lib/api/candidate';
import type {ApplicationDocumentResponse, ClassificationResult, DocumentAiValidation} from '@/lib/api/application';
import {DOCUMENT_RULES} from '@/lib/api/application';
import type {SlotError, SlotState} from './DocumentSlot';

interface ReviewStepProps {
  draft: WizardDraft;
  universities: University[];
  classification: ClassificationResult | null;
  applicationLetter: ApplicationDocumentResponse | null;
  assignmentLetter: ApplicationDocumentResponse | null;
  // AI gate
  aiValidations?: Record<UploadKind, DocumentAiValidation | null>;
  aiValidating?: Record<UploadKind, boolean>;
  aiErrors?: Record<UploadKind, SlotError | null>;
  fullName?: string | null;
  // Slots for documents edit dialog
  slots?: Record<UploadKind, SlotState>;
  // Callbacks — may be async when syncing with backend
  onUpdatePersonal: (patch: Partial<PersonalInfoDraft>) => void | Promise<void>;
  onUpdateEducation: (patch: Partial<EducationDraft>) => void | Promise<void>;
  onUpdateDates: (start: string, end: string) => Promise<void> | void;
  onSelectFiles?: (kind: UploadKind, files: File[]) => void;
  onCancel?: (kind: UploadKind) => void;
  onRetry?: (kind: UploadKind) => void;
  onRemove?: (kind: UploadKind) => void;
  onRetryAi?: (kind: UploadKind) => void;
  onToggleTerms: (confirmed: boolean) => void;
  onContinue: () => void;
  saving?: boolean;
  isValidatingIdentifiers?: boolean;
}

function Section({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      title={title}
      action={
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400 cursor-pointer"
        >
          <span aria-hidden="true">✎</span> {editLabel}
        </button>
      }
    >
      <div className="flex flex-col gap-1.5">{children}</div>
    </Card>
  );
}

function Row({label, value}: {label: string; value?: React.ReactNode}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-1.5 text-xs last:border-0 sm:text-sm dark:border-zinc-800">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-end font-medium text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

// Validators — mirrors apply-wizard.ts (keep in sync)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-žƤ-ʓЀ-џ؀-ۿݐ-ݿ‐-―'’\- ]+$/u;
const CIN_RE = /^[A-Za-z0-9][A-Za-z0-9\- ]*$/;
const EDUCATION_LEVELS = new Set(['LICENCE', 'MASTER', 'INGENIEUR', 'DOCTORAT', 'AUTRE']);
function isValidPhone(raw: string): boolean {
  const compact = raw.replace(/[\s.\-()]/g, '');
  if (/^\+216[24579]\d{7}$/.test(compact)) return true;
  if (/^[24579]\d{7}$/.test(compact)) return true;
  if (/^\+?\d{8,15}$/.test(compact)) return true;
  return false;
}
function birthDateError(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d > today) return true;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age < 15 || age > 80;
}

function AiDocRow({
  kind,
  doc,
  validation,
  validating,
  error,
  fullName,
}: {
  kind: UploadKind;
  doc: ApplicationDocumentResponse | null;
  validation: DocumentAiValidation | null | undefined;
  validating: boolean | undefined;
  error: SlotError | null | undefined;
  fullName: string | null | undefined;
}) {
  const t = useTranslations('apply.documents');
  if (!doc) {
    return (
      <div className="flex items-center justify-between py-1.5 text-xs sm:text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">
          {kind === 'INTERNSHIP_APPLICATION' ? t('applicationLetter') : t('assignmentLetter')}
        </span>
        <Badge tone="error">{t('missingRequired')}</Badge>
      </div>
    );
  }
  const expectedLabel = kind === 'INTERNSHIP_APPLICATION' ? t('aiExpectedInternship') : t('aiExpectedAssignment');
  const displayName = (fullName || '').trim();
  const toks = displayName ? displayName.split(/\s+/).filter(Boolean) : [];
  const alt = toks.length >= 2 ? `${toks.slice(1).join(' ')} ${toks[0]}` : '';
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-100" dir="auto">
          {doc.document.originalFileName}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {t('verificationLabel')}: <StatusPill code={doc.verificationStatus} />
        </span>
      </div>
      {validating ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
        >
          <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          {t('aiValidating')}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-medium">{error.message}</p>
          {error.traceId && <p className="font-mono opacity-70" dir="ltr">traceId: {error.traceId}</p>}
        </div>
      ) : validation ? (
        <div
          className={cx(
            'rounded-lg border px-2.5 py-2 text-xs',
            validation.valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
          )}
        >
          <p className="font-semibold leading-relaxed">
            {validation.valid ? t('aiValid') : t('aiInvalid')}
            <span className="ms-1.5 font-mono text-[11px] opacity-70">({Math.round(validation.confidence * 100)}%)</span>
          </p>
          <p className="mt-1 leading-relaxed opacity-90" dir="auto">
            {validation.reason}
          </p>
          <div className="mt-2 grid gap-1.5 rounded bg-white/60 p-2 dark:bg-black/10">
            <div className="flex items-start gap-1.5">
              <span className={cx('text-xs', validation.documentTypeValid ? 'text-emerald-600' : 'text-amber-600')}>
                {validation.documentTypeValid ? '✓' : '✗'}
              </span>
              <span className="leading-relaxed">
                <span className="font-semibold">{t('aiCheckType')} </span>
                <span className="opacity-90">
                  {validation.documentTypeValid ? t('aiTypeFound', {expected: expectedLabel}) : t('aiTypeNotFound', {expected: expectedLabel})}
                </span>
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className={cx('text-xs', validation.candidateNameValid ? 'text-emerald-600' : 'text-amber-600')}>
                {validation.candidateNameValid ? '✓' : '✗'}
              </span>
              <span className="leading-relaxed">
                <span className="font-semibold">{t('aiCheckName')} </span>
                <span className="opacity-90">
                  {displayName
                    ? validation.candidateNameValid
                      ? t('aiNameFound', {fullName: displayName, alt})
                      : t('aiNameNotFound', {fullName: displayName, alt})
                    : t('aiNameMissing')}
                </span>
              </span>
            </div>
            {!validation.valid && <p className="rounded bg-amber-100/70 px-2 py-1.5 font-medium dark:bg-amber-500/20">{t('aiReplaceGuidance')}</p>}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {t('aiNotValidated')}
        </div>
      )}
    </div>
  );
}

/**
 * Step 5 — Review and Confirmation.
 * Displays a scannable summary, masked CIN, per-section edit dialogs with
 * strong validators (same as creation), and documents AI breakdown.
 */
export function ReviewStep({
  draft,
  universities,
  classification,
  applicationLetter,
  assignmentLetter,
  aiValidations,
  aiValidating,
  aiErrors,
  fullName,
  slots,
  onUpdatePersonal,
  onUpdateEducation,
  onUpdateDates,
  onSelectFiles,
  onCancel,
  onRetry,
  onRemove,
  onRetryAi,
  onToggleTerms,
  onContinue,
  saving = false,
  isValidatingIdentifiers = false,
}: ReviewStepProps) {
  const t = useTranslations('apply.review');
  const ta = useTranslations('apply');
  const td = useTranslations('apply.documents');
  const tdates = useTranslations('apply.dates');
  const tp = useTranslations('apply.personal');
  const te = useTranslations('apply.education');
  const tn = useTranslations('apply.nav');
  const tc = useTranslations('common');
  const toast = useToast();
  const universityName =
    universities.find((u) => u.id === draft.education.universityId)?.name ||
    draft.education.universityId;
  const maskedCin = draft.personal.nationalId ? `•••• ${draft.personal.nationalId.slice(-4)}` : t('notProvided');
  const docsComplete = Boolean(applicationLetter) && Boolean(assignmentLetter);
  const aiReady =
    !aiValidating?.INTERNSHIP_APPLICATION &&
    !aiValidating?.ASSIGNMENT_LETTER &&
    Boolean(aiValidations?.INTERNSHIP_APPLICATION?.valid) &&
    Boolean(aiValidations?.ASSIGNMENT_LETTER?.valid);
  const aiBusy = Boolean(aiValidating?.INTERNSHIP_APPLICATION || aiValidating?.ASSIGNMENT_LETTER);

  // Dialog open states
  const [openPersonal, setOpenPersonal] = useState(false);
  const [openEducation, setOpenEducation] = useState(false);
  const [openDates, setOpenDates] = useState(false);
  const [openDocs, setOpenDocs] = useState(false);

  // Personal form local state — sync only when dialog opens (not on every draft change, to avoid overwriting user typing)
  const [pForm, setPForm] = useState<PersonalInfoDraft>(draft.personal);
  const [pErrors, setPErrors] = useState<Record<string, string | null>>({});
  const [pSaving, setPSaving] = useState(false);
  useEffect(() => {
    if (openPersonal) {
      setPForm(draft.personal);
      setPErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only on open, draft is read at open time
  }, [openPersonal]);

  // Education form — same: sync only on open
  const [eForm, setEForm] = useState<EducationDraft>(draft.education);
  const [eErrors, setEErrors] = useState<Record<string, string | null>>({});
  const [eSaving, setESaving] = useState(false);
  useEffect(() => {
    if (openEducation) {
      setEForm(draft.education);
      setEErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEducation]);

  // Dates form — sync only on open
  const [dStart, setDStart] = useState(draft.dates.desiredStartDate);
  const [dEnd, setDEnd] = useState(draft.dates.desiredEndDate);
  const [dErrors, setDErrors] = useState<Record<string, string | null>>({});
  const [dSaving, setDSaving] = useState(false);
  useEffect(() => {
    if (openDates) {
      setDStart(draft.dates.desiredStartDate);
      setDEnd(draft.dates.desiredEndDate);
      setDErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDates]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);
  const maxBirth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear() - 15}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);
  const minBirth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear() - 80}-01-01`;
  }, []);

  const validatePersonal = (data: PersonalInfoDraft): Record<string, string | null> => {
    const errs: Record<string, string | null> = {};
    const first = data.firstName.trim();
    const last = data.lastName.trim();
    if (!first || !last) errs.name = tp('nameRequired');
    else if (first.length < 2 || last.length < 2 || first.length > 100 || last.length > 100 || !NAME_RE.test(first) || !NAME_RE.test(last))
      errs.name = tp('nameInvalid');
    const cin = data.nationalId.trim();
    if (!cin || cin.length < 5 || cin.length > 20 || !CIN_RE.test(cin)) errs.cin = tp('cinRequired');
    const email = data.email.trim();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) errs.email = tp('emailInvalid');
    const phone = data.phone.trim();
    if (!phone) errs.phone = tp('phoneRequired');
    else if (!isValidPhone(phone)) errs.phone = tp('phoneInvalid');
    if (!data.birthDate) errs.birthDate = tp('birthDateRequired');
    else if (birthDateError(data.birthDate)) errs.birthDate = tp('birthDateInvalid');
    return errs;
  };

  const validateEducation = (data: EducationDraft): Record<string, string | null> => {
    const errs: Record<string, string | null> = {};
    if (!EDUCATION_LEVELS.has(data.educationLevel)) errs.level = te('universityRequired');
    if (!data.speciality.trim() || data.speciality.trim().length < 2) errs.speciality = te('specialityRequired');
    if (!data.universityId) errs.university = te('universityRequired');
    return errs;
  };

  const validateDates = (start: string, end: string): Record<string, string | null> => {
    const errs: Record<string, string | null> = {};
    const isValidIso = (v: string): boolean => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const [y, m, d] = v.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    };
    const toMs = (v: string): number => {
      const [y, m, d] = v.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    if (!start || !end) errs.dates = tdates('errorBothRequired');
    else if (!isValidIso(start) || !isValidIso(end)) errs.dates = tdates('errorInvalidDate');
    else if (toMs(end) < toMs(start)) errs.dates = tdates('errorEndBeforeStart');
    else if (toMs(start) < toMs(todayStr)) errs.dates = tdates('errorStartInPast');
    return errs;
  };

  const handleSavePersonal = async () => {
    const errs = validatePersonal(pForm);
    const hasErr = Object.values(errs).some(Boolean);
    setPErrors(errs);
    if (hasErr) return;
    setPSaving(true);
    try {
      await onUpdatePersonal(pForm);
      setOpenPersonal(false);
      toast.notify({title: tc('save') + ' ✓', tone: 'success'});
    } catch (e) {
      const msg = e instanceof Error ? e.message : tp('nameRequired');
      // Surface as form-level error; keep dialog open for correction
      setPErrors((prev) => ({...prev, form: msg}));
      toast.notify({title: msg, tone: 'error'});
    } finally {
      setPSaving(false);
    }
  };

  const handleSaveEducation = async () => {
    const errs = validateEducation(eForm);
    const hasErr = Object.values(errs).some(Boolean);
    setEErrors(errs);
    if (hasErr) return;
    setESaving(true);
    try {
      await onUpdateEducation(eForm);
      setOpenEducation(false);
      toast.notify({title: tc('save') + ' ✓', tone: 'success'});
    } catch (e) {
      const msg = e instanceof Error ? e.message : te('universityRequired');
      setEErrors((prev) => ({...prev, form: msg}));
      toast.notify({title: msg, tone: 'error'});
    } finally {
      setESaving(false);
    }
  };

  const handleSaveDates = async () => {
    const errs = validateDates(dStart, dEnd);
    const hasErr = Object.values(errs).some(Boolean);
    setDErrors(errs);
    if (hasErr) return;
    setDSaving(true);
    try {
      await onUpdateDates(dStart, dEnd);
      setOpenDates(false);
      toast.notify({title: tc('save') + ' ✓', tone: 'success'});
    } catch (e) {
      const msg = e instanceof Error ? e.message : tdates('errorBothRequired');
      setDErrors({dates: msg});
      toast.notify({title: msg, tone: 'error'});
    } finally {
      setDSaving(false);
    }
  };

  const levels = [
    {value: 'LICENCE', label: te('levelLicence')},
    {value: 'MASTER', label: te('levelMaster')},
    {value: 'INGENIEUR', label: te('levelEngineer')},
    {value: 'DOCTORAT', label: te('levelDoctorate')},
    {value: 'AUTRE', label: te('levelOther')},
  ];

  return (
    <StepShell eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')}>
      {/* 1. Personal Information */}
      <Section title={t('sectionCandidate')} onEdit={() => setOpenPersonal(true)} editLabel={t('editSection')}>
        <Row label={t('fieldName')} value={`${draft.personal.firstName} ${draft.personal.lastName}`.trim() || t('notProvided')} />
        <Row label={t('fieldCin')} value={maskedCin} />
        <Row label={t('fieldEmail')} value={draft.personal.email || t('notProvided')} />
        <Row label={t('fieldPhone')} value={draft.personal.phone || t('notProvided')} />
        <Row label={t('fieldBirthDate')} value={draft.personal.birthDate || t('notProvided')} />
      </Section>

      {/* 2. Education */}
      <Section title={t('sectionEducation')} onEdit={() => setOpenEducation(true)} editLabel={t('editSection')}>
        <Row label={t('eduLevelLabel')} value={draft.education.educationLevel} />
        {draft.education.speciality && <Row label={t('specialityLabel')} value={draft.education.speciality} />}
        <Row label={t('fieldUniversity')} value={universityName || t('notProvided')} />
      </Section>

      {/* 3. Dates & Classification */}
      <Section title={t('sectionDates')} onEdit={() => setOpenDates(true)} editLabel={t('editSection')}>
        <Row
          label={t('fieldDates')}
          value={
            draft.dates.desiredStartDate && draft.dates.desiredEndDate ? (
              <span dir="ltr">
                {draft.dates.desiredStartDate} → {draft.dates.desiredEndDate}
              </span>
            ) : (
              t('notProvided')
            )
          }
        />
        {classification && (
          <>
            <Row
              label={t('classificationType')}
              value={
                <Badge tone={classification.type === 'PFE' ? 'brand' : 'info'}>
                  {classification.type === 'PFE' ? t('typePfe') : classification.type === 'PERFECTIONNEMENT' ? t('typePerfectionnement') : t('typeObservation')}
                </Badge>
              }
            />
            <Row label={t('classificationRequirement')} value={classification.requirement === 'OBLIGATOIRE' ? t('requirementObligatoire') : t('requirementOptional')} />
            <Row label={t('classificationDuration')} value={tdates('durationDays', {count: classification.durationInDays})} />
            <Row
              label={t('justificationLabel')}
              value={
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {classification.type === 'PFE' ? tdates('pfeDesc') : classification.type === 'PERFECTIONNEMENT' ? tdates('perfDesc') : tdates('obsDesc')}
                </span>
              }
            />
          </>
        )}
      </Section>

      {/* 4. Documents — enhanced with AI breakdown */}
      <Section title={t('sectionDocuments')} onEdit={() => setOpenDocs(true)} editLabel={t('editSection')}>
        <div className="flex flex-col gap-3">
          <AiDocRow
            kind="INTERNSHIP_APPLICATION"
            doc={applicationLetter}
            validation={aiValidations?.INTERNSHIP_APPLICATION}
            validating={aiValidating?.INTERNSHIP_APPLICATION}
            error={aiErrors?.INTERNSHIP_APPLICATION}
            fullName={fullName}
          />
          <AiDocRow
            kind="ASSIGNMENT_LETTER"
            doc={assignmentLetter}
            validation={aiValidations?.ASSIGNMENT_LETTER}
            validating={aiValidating?.ASSIGNMENT_LETTER}
            error={aiErrors?.ASSIGNMENT_LETTER}
            fullName={fullName}
          />
          {!docsComplete && <p className="text-xs text-amber-700 dark:text-amber-300">{td('allRequired')}</p>}
          {docsComplete && !aiReady && !aiBusy && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {td('aiNotValidated')} — {td('aiReplaceGuidance')}
            </p>
          )}
          {aiBusy && (
            <p role="status" className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /> {td('aiValidating')}
            </p>
          )}
        </div>
      </Section>

      {/* Confirmation Checkbox */}
      <Card>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.confirmedTerms}
            onChange={(e) => onToggleTerms(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 accent-brand-600 dark:accent-brand-500 cursor-pointer"
          />
          <span className="text-xs font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 sm:text-sm">{ta('reviewAgreeTerms')}</span>
        </label>
      </Card>

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={onContinue}
          disabled={!draft.confirmedTerms || !docsComplete || !aiReady || saving}
          title={!docsComplete ? td('allRequired') : !aiReady ? td('aiGateBlocked') : undefined}
          className="shadow-md hover-lift"
        >
          {tn('continue')}
        </Button>
      </div>

      {/* Personal Edit Dialog — same secure validation as Step 1 wizard (shared backend) */}
      <Modal
        open={openPersonal}
        onClose={() => setOpenPersonal(false)}
        title={t('sectionCandidate')}
        description={tp('intro')}
        closeLabel={tc('close')}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setOpenPersonal(false)}
              disabled={pSaving || isValidatingIdentifiers}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSavePersonal}
              disabled={pSaving || isValidatingIdentifiers}
            >
              {pSaving || isValidatingIdentifiers ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  {tp('validating')}
                </span>
              ) : (
                tc('save')
              )}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Input
              id="edit-first-name"
              label={tp('firstName')}
              value={pForm.firstName}
              onChange={(e) => setPForm((p) => ({...p, firstName: e.target.value}))}
              placeholder={tp('firstNamePlaceholder')}
              required
              minLength={2}
              maxLength={100}
            />
            {pErrors.name && <FieldError message={pErrors.name} />}
          </div>
          <div>
            <Input
              id="edit-last-name"
              label={tp('lastName')}
              value={pForm.lastName}
              onChange={(e) => setPForm((p) => ({...p, lastName: e.target.value}))}
              placeholder={tp('lastNamePlaceholder')}
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          <div>
            <Input
              id="edit-national-id"
              label={tp('cin')}
              value={pForm.nationalId}
              onChange={(e) => setPForm((p) => ({...p, nationalId: e.target.value}))}
              placeholder={tp('cinPlaceholder')}
              required
              minLength={5}
              maxLength={20}
            />
            {pErrors.cin && <FieldError message={pErrors.cin} />}
          </div>
          <div>
            <Input
              id="edit-phone"
              label={tp('phone')}
              type="tel"
              value={pForm.phone}
              onChange={(e) => setPForm((p) => ({...p, phone: e.target.value}))}
              placeholder={tp('phonePlaceholder')}
              required
              minLength={8}
              maxLength={16}
            />
            {pErrors.phone && <FieldError message={pErrors.phone} />}
          </div>
          <div className="sm:col-span-2">
            <Input
              id="edit-email"
              label={tp('email')}
              type="email"
              value={pForm.email}
              onChange={(e) => setPForm((p) => ({...p, email: e.target.value}))}
              placeholder={tp('emailPlaceholder')}
              required
              maxLength={254}
            />
            {pErrors.email && <FieldError message={pErrors.email} />}
          </div>
          <div>
            <Input
              id="edit-birth-date"
              label={tp('birthDate')}
              type="date"
              value={pForm.birthDate}
              onChange={(e) => setPForm((p) => ({...p, birthDate: e.target.value}))}
              required
              min={minBirth}
              max={maxBirth}
            />
            {pErrors.birthDate && <FieldError message={pErrors.birthDate} />}
          </div>
        </div>
        {pErrors.name && !pErrors.cin && !pErrors.email && !pErrors.phone && !pErrors.birthDate && (
          <div className="mt-3">
            <FieldError message={pErrors.name} />
          </div>
        )}
        {pErrors.form && (
          <div className="mt-3">
            <FieldError message={pErrors.form} />
          </div>
        )}
      </Modal>

      {/* Education Edit Dialog */}
      <Modal
        open={openEducation}
        onClose={() => setOpenEducation(false)}
        title={t('sectionEducation')}
        description={te('intro')}
        closeLabel={tc('close')}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setOpenEducation(false)} disabled={eSaving}>
              {tc('cancel')}
            </Button>
            <Button variant="primary" size="md" onClick={handleSaveEducation} disabled={eSaving}>
              {eSaving ? tc('loading') : tc('save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-education-level" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {te('level')} <span className="text-accent-600">*</span>
            </label>
            <select
              id="edit-education-level"
              value={eForm.educationLevel}
              onChange={(e) => setEForm((p) => ({...p, educationLevel: e.target.value}))}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-navy-900 dark:text-zinc-100"
              required
            >
              {levels.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label}
                </option>
              ))}
            </select>
            {eErrors.level && <FieldError message={eErrors.level} />}
          </div>
          <div>
            <Input
              id="edit-speciality"
              label={te('speciality')}
              value={eForm.speciality}
              onChange={(e) => setEForm((p) => ({...p, speciality: e.target.value}))}
              placeholder={te('specialityPlaceholder')}
              required
              minLength={2}
              maxLength={100}
            />
            {eErrors.speciality && <FieldError message={eErrors.speciality} />}
          </div>
          <Input
            id="edit-university"
            label={te('university')}
            type="text"
            value={eForm.universityId}
            onChange={(e) => setEForm((p) => ({...p, universityId: e.target.value}))}
            placeholder={te('university')}
            required
            autoComplete="off"
          />
          {eErrors.university && <FieldError message={eErrors.university} />}
          {eErrors.form && <FieldError message={eErrors.form} />}
        </div>
      </Modal>

      {/* Dates Edit Dialog */}
      <Modal
        open={openDates}
        onClose={() => setOpenDates(false)}
        title={t('sectionDates')}
        description={tdates('intro')}
        closeLabel={tc('close')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setOpenDates(false)} disabled={dSaving || saving}>
              {tc('cancel')}
            </Button>
            <Button variant="primary" size="md" onClick={handleSaveDates} disabled={dSaving || saving}>
              {dSaving || saving ? tc('loading') : tc('save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            id="edit-start-date"
            label={tdates('startDate')}
            hint={tdates('startHint')}
            value={dStart}
            min={todayStr}
            required
            onChange={(e) => setDStart(e.target.value)}
          />
          <DatePicker
            id="edit-end-date"
            label={tdates('endDate')}
            hint={tdates('endHint')}
            value={dEnd}
            min={dStart || todayStr}
            required
            onChange={(e) => setDEnd(e.target.value)}
          />
        </div>
        {dErrors.dates && <FieldError message={dErrors.dates} />}
        {classification && dStart && dEnd && dEnd >= dStart && (
          <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3 text-xs leading-relaxed dark:border-brand-800 dark:bg-brand-950/20">
            <span className="font-bold">{ta('calcType')} </span>
            <Badge tone={classification.type === 'PFE' ? 'brand' : 'info'}>
              {classification.type === 'PFE' ? t('typePfe') : classification.type === 'PERFECTIONNEMENT' ? t('typePerfectionnement') : t('typeObservation')}
            </Badge>
            <span className="ms-2">{tdates('durationDays', {count: classification.durationInDays})}</span>
          </div>
        )}
        <p className="mt-2 text-[11px] italic text-zinc-500 dark:text-zinc-400">{ta('calcAuthorityNotice')}</p>
      </Modal>

      {/* Documents Edit Dialog */}
      <Modal
        open={openDocs}
        onClose={() => setOpenDocs(false)}
        title={t('sectionDocuments')}
        description={td('intro')}
        closeLabel={tc('close')}
        size="lg"
        footer={
          <Button variant="secondary" size="md" onClick={() => setOpenDocs(false)}>
            {tc('close')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {slots ? (
            <>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{td('applicationLetter')}</p>
                <div className="flex flex-col gap-2">
                  <FileDropzone
                    label={td('applicationLetter')}
                    hint={td('privacyNotice')}
                    accept={DOCUMENT_RULES.INTERNSHIP_APPLICATION.extensions.join(',')}
                    allowedExtensions={[...DOCUMENT_RULES.INTERNSHIP_APPLICATION.extensions]}
                    maxSizeMb={DOCUMENT_RULES.INTERNSHIP_APPLICATION.maxBytes / (1024 * 1024)}
                    required
                    managed
                    onFiles={(files) => onSelectFiles?.('INTERNSHIP_APPLICATION', files)}
                  />
                  {slots.INTERNSHIP_APPLICATION.attachment && (
                    <p className="truncate text-xs text-zinc-600 dark:text-zinc-400" dir="auto">
                      {slots.INTERNSHIP_APPLICATION.attachment.document.originalFileName} · {formatBytes(slots.INTERNSHIP_APPLICATION.attachment.document.sizeBytes, {b: td('unitB'), kb: td('unitKB'), mb: td('unitMB')})} 
                    </p>
                  )}
                  {slots.INTERNSHIP_APPLICATION.phase === 'uploading' && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /> {td('uploadingIndeterminate')}
                      </p>
                      {onCancel && (
                        <Button variant="tertiary" size="sm" onClick={() => onCancel('INTERNSHIP_APPLICATION')}>
                          {td('cancelUpload')}
                        </Button>
                      )}
                    </div>
                  )}
                  {aiValidating?.INTERNSHIP_APPLICATION && (
                    <p className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /> {td('aiValidating')}
                    </p>
                  )}
                  {aiErrors?.INTERNSHIP_APPLICATION && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      {aiErrors.INTERNSHIP_APPLICATION.message}
                    </div>
                  )}
                  {aiValidations?.INTERNSHIP_APPLICATION && !aiValidating?.INTERNSHIP_APPLICATION && !aiErrors?.INTERNSHIP_APPLICATION && (
                    <div className={cx('rounded-lg border px-2.5 py-2 text-xs', aiValidations.INTERNSHIP_APPLICATION.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100')}>
                      <p className="font-semibold">
                        {aiValidations.INTERNSHIP_APPLICATION.valid ? td('aiValid') : td('aiInvalid')} ({Math.round(aiValidations.INTERNSHIP_APPLICATION.confidence * 100)}%)
                      </p>
                      <p className="mt-1 opacity-90" dir="auto">
                        {aiValidations.INTERNSHIP_APPLICATION.reason}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {slots.INTERNSHIP_APPLICATION.attachment && onRemove && (
                      <Button variant="tertiary" size="sm" onClick={() => onRemove('INTERNSHIP_APPLICATION')}>
                        {td('remove')}
                      </Button>
                    )}
                    {aiErrors?.INTERNSHIP_APPLICATION?.retryable && onRetryAi && (
                      <Button variant="secondary" size="sm" onClick={() => onRetryAi('INTERNSHIP_APPLICATION')}>
                        {td('aiRetry')}
                      </Button>
                    )}
                    {slots.INTERNSHIP_APPLICATION.phase === 'error' && onRetry && (
                      <Button variant="secondary" size="sm" onClick={() => onRetry('INTERNSHIP_APPLICATION')}>
                        {td('retry')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{td('assignmentLetter')}</p>
                <div className="flex flex-col gap-2">
                  <FileDropzone
                    label={td('assignmentLetter')}
                    hint={td('privacyNotice')}
                    accept={DOCUMENT_RULES.ASSIGNMENT_LETTER.extensions.join(',')}
                    allowedExtensions={[...DOCUMENT_RULES.ASSIGNMENT_LETTER.extensions]}
                    maxSizeMb={DOCUMENT_RULES.ASSIGNMENT_LETTER.maxBytes / (1024 * 1024)}
                    required
                    managed
                    onFiles={(files) => onSelectFiles?.('ASSIGNMENT_LETTER', files)}
                  />
                  {slots.ASSIGNMENT_LETTER.attachment && (
                    <p className="truncate text-xs text-zinc-600 dark:text-zinc-400" dir="auto">
                      {slots.ASSIGNMENT_LETTER.attachment.document.originalFileName} · {formatBytes(slots.ASSIGNMENT_LETTER.attachment.document.sizeBytes, {b: td('unitB'), kb: td('unitKB'), mb: td('unitMB')})} 
                    </p>
                  )}
                  {slots.ASSIGNMENT_LETTER.phase === 'uploading' && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /> {td('uploadingIndeterminate')}
                      </p>
                      {onCancel && (
                        <Button variant="tertiary" size="sm" onClick={() => onCancel('ASSIGNMENT_LETTER')}>
                          {td('cancelUpload')}
                        </Button>
                      )}
                    </div>
                  )}
                  {aiValidating?.ASSIGNMENT_LETTER && (
                    <p className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /> {td('aiValidating')}
                    </p>
                  )}
                  {aiErrors?.ASSIGNMENT_LETTER && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      {aiErrors.ASSIGNMENT_LETTER.message}
                    </div>
                  )}
                  {aiValidations?.ASSIGNMENT_LETTER && !aiValidating?.ASSIGNMENT_LETTER && !aiErrors?.ASSIGNMENT_LETTER && (
                    <div className={cx('rounded-lg border px-2.5 py-2 text-xs', aiValidations.ASSIGNMENT_LETTER.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100')}>
                      <p className="font-semibold">
                        {aiValidations.ASSIGNMENT_LETTER.valid ? td('aiValid') : td('aiInvalid')} ({Math.round(aiValidations.ASSIGNMENT_LETTER.confidence * 100)}%)
                      </p>
                      <p className="mt-1 opacity-90" dir="auto">
                        {aiValidations.ASSIGNMENT_LETTER.reason}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {slots.ASSIGNMENT_LETTER.attachment && onRemove && (
                      <Button variant="tertiary" size="sm" onClick={() => onRemove('ASSIGNMENT_LETTER')}>
                        {td('remove')}
                      </Button>
                    )}
                    {aiErrors?.ASSIGNMENT_LETTER?.retryable && onRetryAi && (
                      <Button variant="secondary" size="sm" onClick={() => onRetryAi('ASSIGNMENT_LETTER')}>
                        {td('aiRetry')}
                      </Button>
                    )}
                    {slots.ASSIGNMENT_LETTER.phase === 'error' && onRetry && (
                      <Button variant="secondary" size="sm" onClick={() => onRetry('ASSIGNMENT_LETTER')}>
                        {td('retry')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{td('aiNotValidated')}</p>
          )}
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-2.5 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-navy-950/60 dark:text-zinc-400">
            <strong>{td('privacyTitle')} :</strong> {td('privacyBody')}
          </div>
        </div>
      </Modal>
    </StepShell>
  );
}
