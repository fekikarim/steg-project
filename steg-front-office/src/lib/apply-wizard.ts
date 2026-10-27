import type {
  ApplicationDocumentResponse,
  DocumentAiValidation,
  InternshipType,
} from '@/lib/api/application';

/**
 * 6-step guided Apply wizard identifiers conforming to Phase B7 specification:
 * 1. personal (Full name, CIN, Phone, Email, Birth date)
 * 2. education (Level, University)
 * 3. dates (Start date, End date, automatic live classification preview)
 * 4. documents (Required PDF uploads)
 * 5. review (Full scannable summary + confirmation checkbox)
 * 6. result (Submission success reference and tracking)
 */
export const STEPS = [
  'personal',
  'education',
  'dates',
  'documents',
  'review',
  'result',
] as const;

export type StepId = (typeof STEPS)[number];

export interface PersonalInfoDraft {
  firstName: string;
  lastName: string;
  nationalId: string;
  email: string;
  phone: string;
  birthDate: string;
}

export interface EducationDraft {
  educationLevel: string;
  speciality: string;
  universityId: string;
}

export interface InternshipDatesDraft {
  desiredStartDate: string;
  desiredEndDate: string;
}

export interface WizardDraft {
  personal: PersonalInfoDraft;
  education: EducationDraft;
  dates: InternshipDatesDraft;
  confirmedTerms: boolean;
}

export type UploadKind = 'INTERNSHIP_APPLICATION' | 'ASSIGNMENT_LETTER';

export const INITIAL_WIZARD_DRAFT: WizardDraft = {
  personal: {
    firstName: '',
    lastName: '',
    nationalId: '',
    email: '',
    phone: '',
    birthDate: '',
  },
  education: {
    educationLevel: 'LICENCE',
    speciality: '',
    universityId: '',
  },
  dates: {
    desiredStartDate: '',
    desiredEndDate: '',
  },
  confirmedTerms: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Letters (Latin + Arabic), spaces, hyphens, apostrophes. */
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-žƤ-ʓЀ-џ؀-ۿݐ-ݿ‐-―'’\- ]+$/u;

const CIN_RE = /^[A-Za-z0-9][A-Za-z0-9\- ]*$/;

const EDUCATION_LEVELS = new Set(['LICENCE', 'MASTER', 'INGENIEUR', 'DOCTORAT', 'AUTRE']);

/** Tunisian mobile/landline (with or without +216) or generic international. */
function isValidPhone(raw: string): boolean {
  const compact = raw.replace(/[\s.\-()]/g, '');
  if (/^\+216[24579]\d{7}$/.test(compact)) return true;
  if (/^[24579]\d{7}$/.test(compact)) return true;
  if (/^\+?\d{8,15}$/.test(compact)) return true;
  return false;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const utc = Date.UTC(y, m - 1, d);
  const dt = new Date(utc);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isoToUtcMs(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function todayIsoLocal(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function birthDateError(value: string): boolean {
  if (!isValidIsoDate(value)) return true;
  const dMs = isoToUtcMs(value);
  const todayMs = isoToUtcMs(todayIsoLocal());
  if (dMs > todayMs) return true;
  const today = new Date();
  const d = new Date(dMs);
  let age = today.getFullYear() - d.getUTCFullYear();
  const m = today.getMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getUTCDate())) age -= 1;
  return age < 15 || age > 80;
}

/**
 * Validate each step in the wizard.
 * Returns null if valid, or a message key RELATIVE to the `apply`
 * next-intl namespace (caller uses `useTranslations('apply')`).
 */
export function validateStep(
  step: StepId,
  draft: WizardDraft,
  classificationType: InternshipType | null,
  uploads: Record<UploadKind, ApplicationDocumentResponse | null>,
  uploadingStates: Record<UploadKind, boolean>,
  aiValidations?: Record<UploadKind, DocumentAiValidation | null>,
  aiValidating?: Record<UploadKind, boolean>,
): string | null {
  switch (step) {
    case 'personal': {
      const p = draft.personal;
      const first = p.firstName.trim();
      const last = p.lastName.trim();
      if (!first || !last) return 'personal.nameRequired';
      if (
        first.length < 2 ||
        last.length < 2 ||
        first.length > 100 ||
        last.length > 100 ||
        !NAME_RE.test(first) ||
        !NAME_RE.test(last)
      )
        return 'personal.nameInvalid';
      const cin = p.nationalId.trim();
      if (!cin || cin.length < 5 || cin.length > 20 || !CIN_RE.test(cin))
        return 'personal.cinRequired';
      const email = p.email.trim();
      if (!email || email.length > 254 || !EMAIL_RE.test(email))
        return 'personal.emailInvalid';
      const phone = p.phone.trim();
      if (!phone) return 'personal.phoneRequired';
      if (!isValidPhone(phone)) return 'personal.phoneInvalid';
      if (!p.birthDate) return 'personal.birthDateRequired';
      if (birthDateError(p.birthDate)) return 'personal.birthDateInvalid';
      return null;
    }
    case 'education': {
      const e = draft.education;
      if (!EDUCATION_LEVELS.has(e.educationLevel)) return 'education.universityRequired';
      if (!e.speciality.trim() || e.speciality.trim().length < 2)
        return 'education.specialityRequired';
      if (!e.universityId) return 'education.universityRequired';
      return null;
    }
    case 'dates': {
      const d = draft.dates;
      if (!d.desiredStartDate || !d.desiredEndDate) return 'dates.errorBothRequired';
      if (!isValidIsoDate(d.desiredStartDate) || !isValidIsoDate(d.desiredEndDate)) return 'dates.errorInvalidDate';
      const startMs = isoToUtcMs(d.desiredStartDate);
      const endMs = isoToUtcMs(d.desiredEndDate);
      if (endMs < startMs) return 'dates.errorEndBeforeStart';
      const todayMs = isoToUtcMs(todayIsoLocal());
      if (startMs < todayMs) return 'dates.errorStartInPast';
      return null;
    }
    case 'documents': {
      const requiredKinds: UploadKind[] = ['INTERNSHIP_APPLICATION', 'ASSIGNMENT_LETTER'];
      for (const k of requiredKinds) {
        if (!uploads[k]) return 'documents.allRequired';
        if (uploadingStates[k]) return 'documents.allRequired';
        if (aiValidating?.[k]) return 'documents.aiValidating';
        const v = aiValidations?.[k] ?? null;
        if (!v) return 'documents.aiNotValidated';
        if (!v.valid) {
          if (!v.documentTypeValid && !v.candidateNameValid) return 'documents.aiInvalidTypeAndName';
          if (!v.documentTypeValid) return 'documents.aiInvalidType';
          if (!v.candidateNameValid) return 'documents.aiInvalidName';
          return 'documents.aiInvalid';
        }
      }
      return null;
    }
    case 'review': {
      if (!draft.confirmedTerms) return 'reviewAgreeTerms';
      // Also enforce documents + AI gate on review — editing personal info
      // invalidates AI, so review cannot be passed until re-validated.
      const requiredKinds: UploadKind[] = ['INTERNSHIP_APPLICATION', 'ASSIGNMENT_LETTER'];
      for (const k of requiredKinds) {
        if (!uploads[k]) return 'documents.allRequired';
        if (uploadingStates[k]) return 'documents.allRequired';
        if (aiValidating?.[k]) return 'documents.aiValidating';
        const v = aiValidations?.[k] ?? null;
        if (!v) return 'documents.aiNotValidated';
        if (!v.valid) {
          if (!v.documentTypeValid && !v.candidateNameValid) return 'documents.aiInvalidTypeAndName';
          if (!v.documentTypeValid) return 'documents.aiInvalidType';
          if (!v.candidateNameValid) return 'documents.aiInvalidName';
          return 'documents.aiInvalid';
        }
      }
      return null;
    }
    case 'result':
      return null;
  }
}
