/**
 * Typed backend DTOs and server-side calls for the internship application
 * module (contract: backend `openapi.json` — ApplicationResponse,
 * ApplicationCreateRequest, ApplicationUpdateRequest, DocumentResponse,
 * ApplicationDocumentResponse, AttachDocumentRequest).
 *
 * These run inside route handlers only: the browser talks to our own
 * `/api/applications` proxy routes, which attach the httpOnly session
 * access token server-side. Tokens never reach client bundles.
 */
import {ApiError, backendFetch, type ErrorEnvelope} from '../api-client';

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/**
 * Explicit backend statuses (AGENTS.md §4). `UNDER_REVIEW` is kept for rows
 * created before the two-step review was retired. The legacy `NEEDS_CORRECTION`
 * and `ACCEPTED` statuses were migrated to `MODIFICATION_REQUESTED` and
 * `APPROVED` (V39, re-asserted by V43) and REMOVED from the contract in S1b,
 * so this union no longer accepts them.
 */
export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'MODIFICATION_REQUESTED'
  | 'RESUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type InternshipType = 'OBSERVATION' | 'PERFECTIONNEMENT' | 'PFE';

export type InternshipRequirement = 'OBLIGATOIRE' | 'OPTIONAL';

export type DocumentType =
  | 'CV'
  | 'MOTIVATION_LETTER'
  | 'UNIVERSITY_CONVENTION'
  | 'TRANSCRIPT'
  | 'INTERNSHIP_APPLICATION'
  | 'ASSIGNMENT_LETTER'
  | 'INTERNSHIP_CONVENTION'
  | 'STEG_INTERNSHIP_REPORT'
  | 'CAHIER_DES_CHARGES'
  | 'INTERNSHIP_CERTIFICATE'
  | 'INTERNSHIP_LOGBOOK'
  | 'CIN_COPY'
  | 'PAYMENT_RECEIPT'
  | 'OTHER';

export type DocumentVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REQUIRES_CORRECTION';

/* ------------------------------------------------------------------ */
/*  Application                                                        */
/* ------------------------------------------------------------------ */

export interface ApplicationResponse {
  id: string;
  reference: string;
  status: ApplicationStatus;
  candidateId: string;
  candidateName: string;
  desiredStartDate: string | null;
  desiredEndDate: string | null;
  submittedOnline: boolean;
  submissionDate: string | null;
  calculatedType: InternshipType | null;
  requirement: InternshipRequirement | null;
  rejectionReason: string | null;
  correctionComment: string | null;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ApplicationCreateRequest {
  desiredStartDate?: string | null;
  desiredEndDate?: string | null;
  submittedOnline?: boolean;
}

export interface ApplicationUpdateRequest {
  desiredStartDate?: string | null;
  desiredEndDate?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Documents                                                          */
/* ------------------------------------------------------------------ */

export interface DocumentResponse {
  id: string;
  reference: string;
  type: DocumentType;
  restrictedAccess: boolean;
  generatedAutomatically: boolean;
  latestVersionNumber: number;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedAt: string;
  createdAt: string;
}

export interface ApplicationDocumentResponse {
  id: string;
  applicationId: string;
  document: DocumentResponse;
  mandatory: boolean;
  verificationStatus: DocumentVerificationStatus;
  verificationComment: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface AttachDocumentRequest {
  documentId: string;
  mandatory?: boolean;
}

/** Backend workflow instance state (contract: WorkflowInstanceResponse). */
export type WorkflowStatus = 'CREATED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export interface WorkflowInstanceResponse {
  id: string;
  definitionCode: string;
  definitionName: string;
  currentStepCode: string | null;
  currentStepName: string | null;
  status: WorkflowStatus;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface DocumentRule {
  /** MIME types accepted by the backend (Tika-verified, not just the extension). */
  mimes: readonly string[];
  /** File extensions accepted as a client-side pre-check hint (UX only). */
  extensions: readonly string[];
  /** Maximum file size in bytes enforced by the backend. */
  maxBytes: number;
  /** Whether the wizard treats this slot as mandatory. */
  required: boolean;
}

/**
 * Backend-confirmed upload rules per DocumentType (authority: backend
 * `document/domain/service/DocumentValidationService` — `SIZE_LIMITS` and
 * `ALLOWED_MIME_TYPES`). INTERNSHIP_APPLICATION and ASSIGNMENT_LETTER are
 * absent from `SIZE_LIMITS`, so they fall under `DEFAULT_MAX_SIZE` (10 MB).
 
 *
 * These constants drive client-side pre-validation and slot chrome (accepted
 * formats, max size) as UX feedback only — the backend (Tika content
 * inspection + per-type caps) remains the authoritative gate and its error
 * codes (FILE_TOO_LARGE, INVALID_FILE_TYPE, MIME_TYPE_SPOOFING_DETECTED,
 * EMPTY_FILE) are surfaced verbatim to the user.
 */
export const DOCUMENT_RULES: Record<
  'INTERNSHIP_APPLICATION' | 'ASSIGNMENT_LETTER',
  DocumentRule
> = {
  INTERNSHIP_APPLICATION: {
    mimes: ['application/pdf'],
    extensions: ['.pdf'],
    maxBytes: 10 * 1024 * 1024,
    required: true,
  },
  ASSIGNMENT_LETTER: {
    mimes: ['application/pdf'],
    extensions: ['.pdf'],
    maxBytes: 10 * 1024 * 1024,
    required: true,
  },
};

/* ------------------------------------------------------------------ */
/*  Classification                                                     */
/* ------------------------------------------------------------------ */

export interface ClassificationResult {
  type: InternshipType;
  requirement: InternshipRequirement;
  paymentEligible: boolean;
  durationInDays: number;
  appliedRuleDescription: string;
}

/* ------------------------------------------------------------------ */
/*  Server-side fetches                                                */
/* ------------------------------------------------------------------ */

export function createApplication(token: string, body: ApplicationCreateRequest) {
  return backendFetch<ApplicationResponse>('/api/applications', {
    method: 'POST',
    token,
    body,
  });
}

export function getApplication(token: string, id: string) {
  return backendFetch<ApplicationResponse>(`/api/applications/${id}`, {
    method: 'GET',
    token,
  });
}

export function listApplications(token: string) {
  return backendFetch<ApplicationResponse[]>('/api/applications', {
    method: 'GET',
    token,
  });
}

export function updateApplication(token: string, id: string, body: ApplicationUpdateRequest) {
  return backendFetch<ApplicationResponse>(`/api/applications/${id}`, {
    method: 'PUT',
    token,
    body,
  });
}

export function submitApplication(
  token: string,
  id: string,
  opts: {timeoutMs?: number; idempotencyKey?: string} = {},
) {
  return backendFetch<ApplicationResponse>(`/api/applications/${id}/submit`, {
    method: 'POST',
    token,
    // Submit fans out to notifications + Resend email server-side; allow a
    // generous budget (email timeout is bounded server-side, worst case ~15s).
    timeoutMs: opts.timeoutMs ?? 45_000,
    headers: opts.idempotencyKey ? {'X-Idempotency-Key': opts.idempotencyKey} : undefined,
  });
}

/**
 * Withdraw an own application (→ WITHDRAWN). The backend refuses an APPROVED
 * or already-WITHDRAWN dossier; those rejections surface as ApiError.
 */
export function withdrawApplication(token: string, id: string) {
  return backendFetch<ApplicationResponse>(`/api/applications/${id}/withdraw`, {
    method: 'POST',
    token,
  });
}

/**
 * Current workflow state for an application. Only exists once the workflow
 * instance is spawned (at submit); DRAFTs yield backend 404, which callers
 * must treat as "no workflow yet", not as an error.
 */
export function getApplicationWorkflow(token: string, id: string) {
  return backendFetch<WorkflowInstanceResponse>(`/api/applications/${id}/workflow`, {
    method: 'GET',
    token,
  });
}

export function getApplicationDocuments(token: string, applicationId: string) {
  return backendFetch<ApplicationDocumentResponse[]>(
    `/api/applications/${applicationId}/documents`,
    {method: 'GET', token},
  );
}

export function attachApplicationDocument(
  token: string,
  applicationId: string,
  body: AttachDocumentRequest,
) {
  return backendFetch<ApplicationDocumentResponse>(
    `/api/applications/${applicationId}/documents`,
    {method: 'POST', token, body},
  );
}

/**
 * Upload a file to `/api/documents` (multipart). Returns the created
 * DocumentResponse. Rate-limited to 10 uploads/minute on the backend.
 *
 * Server-side proxy use: gives large files (up to 15 MB) plus Tika/malware
 * scanning time a generous 120 s budget instead of hanging forever, and
 * preserves the backend error `code` (FILE_TOO_LARGE, INVALID_FILE_TYPE,
 * MIME_TYPE_SPOOFING_DETECTED, EMPTY_FILE) so the browser can localize it.
 * Proxy semantics: 504 = upstream timed out, 502 = upstream unreachable.
 */
export async function uploadDocument(
  token: string,
  file: File,
  type: DocumentType,
): Promise<DocumentResponse> {
  const baseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
  const form = new FormData();
  form.append('file', file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/documents?type=${type}`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(504, {error: 'UPSTREAM_TIMEOUT', message: 'Document upload timed out.'}, 'Document upload failed.');
    }
    throw new ApiError(502, {error: 'UPSTREAM_UNREACHABLE', message: 'Cannot reach the server.'}, 'Document upload failed.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let envelope: ErrorEnvelope | null = null;
    try {
      envelope = (await res.json()) as ErrorEnvelope;
    } catch {
      /* empty */
    }
    throw new ApiError(res.status, envelope ?? null, 'Document upload failed.');
  }

  return (await res.json()) as DocumentResponse;
}

/* ------------------------------------------------------------------ */
/*  AI validation                                                       */
/* ------------------------------------------------------------------ */

export interface DocumentAiValidation {
  documentId: string | null;
  valid: boolean;
  documentTypeValid: boolean;
  candidateNameValid: boolean;
  confidence: number;
  reason: string;
  version: string;
}

/**
 * AI validation budget: Spring Boot allows up to ~30s for Python
 * (15s timeout x 2 attempts + backoff). The Next.js proxy must wait longer
 * than that, otherwise it aborts healthy-but-slow validations and the UI
 * shows a false "service unavailable". 45s covers p99 + headroom.
 */
const AI_VALIDATION_TIMEOUT_MS = 45_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {...init, signal: controller.signal});
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, {error: 'AI_TIMEOUT', message: 'AI verification timed out.'}, 'AI verification timed out.');
    }
    throw new ApiError(0, null, 'Cannot reach the server.');
  } finally {
    clearTimeout(timer);
  }
}

export function validateStoredDocumentAi(
  token: string,
  documentId: string,
  body: {expectedType?: string; fullName?: string},
): Promise<DocumentAiValidation> {
  return backendFetch<DocumentAiValidation>(`/api/documents/${documentId}/validation`, {
    method: 'POST',
    token,
    body,
    timeoutMs: AI_VALIDATION_TIMEOUT_MS,
  });
}

/** Anonymous / pre-account file validation: Next.js proxy forwards multipart to backend public endpoint. */
export async function validatePublicDocumentAi(
  file: File,
  type: DocumentType,
  fullName: string | null,
): Promise<DocumentAiValidation> {
  const baseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
  // When running in the Next.js proxy we go through our own route so the
  // server can attach httpOnly auth when present; for public we also proxy.
  // Detect browser vs server: if window exists, use same-origin proxy.
  if (typeof window !== 'undefined') {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (fullName) form.append('fullName', fullName);
    const res = await fetchWithTimeout(
      '/api/public/documents/validation',
      {method: 'POST', body: form, cache: 'no-store'},
      AI_VALIDATION_TIMEOUT_MS,
    );
    const text = await res.text();
    const data: unknown = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const env = data && typeof data === 'object' ? (data as ErrorEnvelope) : null;
      throw new ApiError(res.status, env, env?.message ?? 'AI validation failed.');
    }
    return data as DocumentAiValidation;
  }
  // Server-side direct call (used by route handler): forward to Spring Boot.
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (fullName) form.append('fullName', fullName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_VALIDATION_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/public/documents/validation`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(504, {error: 'UPSTREAM_TIMEOUT', message: 'Document validation timed out.'}, 'Document validation timed out.');
    }
    throw new ApiError(502, {error: 'UPSTREAM_UNREACHABLE', message: 'Cannot reach the server.'}, 'Document validation failed.');
  } finally {
    clearTimeout(timer);
  }
  const t = await res.text();
  const d: unknown = t ? (JSON.parse(t) as unknown) : null;
  if (!res.ok) {
    // Backend returns envelope with message/traceId; surface it
    let envelope: ErrorEnvelope | null = null;
    try {
      envelope = d && typeof d === 'object' ? (d as ErrorEnvelope) : null;
    } catch {
      envelope = null;
    }
    const msg = (envelope as unknown as {message?: string})?.message ?? 'AI validation failed.';
    throw new ApiError(res.status, envelope, msg);
  }
  return d as DocumentAiValidation;
}

/** Browser helper: re-validate a stored document via the same-origin proxy. */
export async function validateStoredDocumentAiBrowser(
  documentId: string,
  body: {expectedType?: string; fullName?: string},
): Promise<DocumentAiValidation> {
  const res = await fetchWithTimeout(
    `/api/documents/${documentId}/validation`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      cache: 'no-store',
    },
    AI_VALIDATION_TIMEOUT_MS,
  );
  const text = await res.text();
  const data: unknown = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const env = data && typeof data === 'object' ? (data as ErrorEnvelope) : null;
    throw new ApiError(res.status, env, env?.message ?? 'AI validation failed.');
  }
  return data as DocumentAiValidation;
}

/* ------------------------------------------------------------------ */
/*  Client-side classification (mirrors backend logic)                  */
/* ------------------------------------------------------------------ */

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.floor((e - s) / 86_400_000) + 1;
}

function periodBetween(start: string, end: string): {years: number; months: number; days: number} {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  let years = ey - sy;
  let months = em - sm;
  let days = ed - sd;
  if (days < 0) {
    months -= 1;
    // days in month preceding end date
    const prevMonthDays = new Date(Date.UTC(ey, em - 1, 0)).getUTCDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return {years, months, days};
}

/**
 * Client-side classification mirroring `InternshipClassificationService`.
 * The backend is the authority; this provides instant UI feedback while
 * the candidate is selecting dates.
 */
export function classifyInternship(startDate: string, endDate: string): ClassificationResult {
  // Robust validation: reject invalid ISO or end before start before computing
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return {
      type: 'OBSERVATION',
      requirement: 'OPTIONAL',
      paymentEligible: false,
      durationInDays: 0,
      appliedRuleDescription: 'Invalid date range.',
    };
  }
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return {
      type: 'OBSERVATION',
      requirement: 'OPTIONAL',
      paymentEligible: false,
      durationInDays: 0,
      appliedRuleDescription: 'Invalid date range.',
    };
  }

  const durationInDays = daysBetween(startDate, endDate);
  const period = periodBetween(startDate, endDate);
  const isGreaterThan3Months = period.years > 0 || period.months > 3 || (period.months === 3 && period.days > 0);

  if (durationInDays < 42) {
    return {
      type: 'OBSERVATION',
      requirement: 'OPTIONAL',
      paymentEligible: false,
      durationInDays,
      appliedRuleDescription: `Duration is ${durationInDays} day${durationInDays === 1 ? '' : 's'} (< 42 days).`,
    };
  }

  if (!isGreaterThan3Months) {
    return {
      type: 'PERFECTIONNEMENT',
      requirement: 'OBLIGATOIRE',
      paymentEligible: true,
      durationInDays,
      appliedRuleDescription: `Duration is ${period.months} month${period.months === 1 ? '' : 's'} and ${period.days} day${period.days === 1 ? '' : 's'}.`,
    };
  }

  return {
    type: 'PFE',
    requirement: 'OBLIGATOIRE',
    paymentEligible: true,
    durationInDays,
    appliedRuleDescription: `Duration is ${period.years > 0 ? period.years * 12 + period.months : period.months} month${(period.years > 0 ? period.years * 12 + period.months : period.months) === 1 ? '' : 's'} and ${period.days} day${period.days === 1 ? '' : 's'} (> 3 months).`,
  };
}

/**
 * Check whether a date range falls in the "gap" between Observation and
 * Perfectionnement (exactly 42 days is Perfectionnement, so no gap exists
 * for valid ranges). Also validates that end >= start with proper ISO parsing.
 */
export function validateDateRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  if (e < s) return 'apply.wizard.dates.errorEndBeforeStart';
  return null;
}
