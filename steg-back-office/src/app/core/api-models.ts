/**
 * Typed API contracts maintained from `steg-backend/docs/openapi.json`
 * (Phase A13 export, 103 paths). This file is the Back Office's typed view
 * of that contract — regenerate/align when the frozen contract changes.
 * Backend is authoritative for business rules; these are transport types only.
 */

export interface ApiErrorEnvelope {
  readonly timestamp?: string;
  readonly status?: number;
  readonly error?: string;
  readonly message?: string;
  readonly path?: string;
  readonly traceId?: string;
  readonly fieldErrors?: readonly { readonly field: string; readonly message: string }[];
}

export interface Page<T> {
  readonly content: readonly T[];
  readonly totalElements: number;
  readonly totalPages: number;
  readonly number: number;
  readonly size: number;
}

/**
 * Normalizes a paginated backend response into the app's flat `Page<T>`.
 *
 * Spring Boot 4 returns the instance-model format
 * `{ content, page: { number, size, totalElements, totalPages } }` while
 * older endpoints/mocks still return the flat format (and some list
 * endpoints return a bare array). Accepting all three here keeps every
 * paginated view (finance, audit, notifications, companion lists, …)
 * rendering correct counts instead of `NaN`.
 */
export function asPage<T>(
  payload: Page<T> | { readonly page?: unknown; readonly content: readonly T[] } | readonly T[],
): Page<T> {
  if (Array.isArray(payload)) {
    const rows = payload as readonly T[];
    return {
      content: rows,
      totalElements: rows.length,
      totalPages: 1,
      number: 0,
      size: rows.length,
    };
  }
  const body = payload as { readonly content: readonly T[]; readonly page?: unknown };
  const meta = body.page as
    | {
        readonly number?: number;
        readonly size?: number;
        readonly totalElements?: number;
        readonly totalPages?: number;
      }
    | undefined;
  if (meta && typeof meta === 'object') {
    const content = body.content;
    return {
      content,
      number: meta.number ?? 0,
      size: meta.size ?? content.length,
      totalElements: meta.totalElements ?? content.length,
      totalPages:
        meta.totalPages ??
        (meta.size
          ? Math.max(1, Math.ceil((meta.totalElements ?? content.length) / meta.size))
          : 1),
    };
  }
  const flat = body as unknown as Partial<Page<T>>;
  const content = body.content;
  return {
    content,
    number: flat.number ?? 0,
    size: flat.size ?? content.length,
    totalElements: flat.totalElements ?? content.length,
    totalPages: flat.totalPages ?? 1,
  };
}

/** Explicit application statuses (AGENTS.md §4). */
export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'MODIFICATION_REQUESTED'
  | 'RESUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';
export type InternshipStatus =
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'REPORT_SUBMITTED'
  | 'UNDER_VALIDATION'
  | 'VALIDATED'
  | 'RECEIPT_ISSUED'
  | 'CANCELLED'
  | 'ARCHIVED';
export type InternshipType = 'OBSERVATION' | 'PERFECTIONNEMENT' | 'PFE';
export type FinanceCaseStatus =
  | 'OPENED'
  | 'UNDER_REVIEW'
  | 'DOCUMENTS_MISSING'
  | 'READY_FOR_DECISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export interface ApplicationQueueQuery {
  /** Zero-based page index (Spring Data). */
  readonly page: number;
  readonly size: number;
  /** `property,asc|desc` — backend whitelists the properties. */
  readonly sort?: string;
  /** Free-text search over reference, candidate name and candidate email. */
  readonly q?: string;
  readonly status?: ApplicationStatus;
  /** Exact calculated internship type. */
  readonly type?: InternshipType;
  readonly university?: string;
  /** Inclusive submission-date bounds, `yyyy-MM-dd`. */
  readonly from?: string;
  readonly to?: string;
}

/**
 * Row of the staff application queue (`GET /api/applications/manage`).
 * Carries the candidate and university in the same row, so the list screen
 * needs no second round-trip (AGENTS.md §5.2).
 */
export interface ApplicationQueueRow {
  readonly id: string;
  readonly reference: string;
  readonly status: ApplicationStatus;
  readonly candidateId: string;
  readonly candidateName: string;
  readonly candidateEmail: string | null;
  readonly universityName: string | null;
  readonly submittedOnline: boolean | null;
  readonly submissionDate: string | null;
  readonly calculatedType: InternshipType | null;
  readonly requirement: InternshipRequirement | null;
  readonly rejectionReason: string | null;
  readonly correctionComment: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number | null;
}

export interface KpiSummary {
  readonly pendingApplications: number;
  readonly activeInternships: number;
  readonly financeToReview: number;
  readonly documentsMissing: number;
}

/**
 * Backend reporting DTOs (Phase A13 `/api/reports/*`).
 * Every dashboard metric is derived from these — never from partial client lists.
 */
export interface GroupCountDto {
  readonly groupName: string;
  readonly count: number;
}

export interface PaymentTotalRowDto {
  readonly year: number;
  readonly month: number;
  readonly departmentCode: string;
  readonly totalAmount: number;
  readonly receiptCount: number;
}

/** Minimal notification projection for the dashboard activity feed. */
export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  readonly relatedEntityType: string;
  readonly relatedEntityId: string;
  readonly createdAt: string;
  readonly read: boolean;
  readonly readAt: string | null;
}

/** Minimal finance-case projection for the finance work queue. */
export interface FinanceCaseQueueItem {
  readonly id: string;
  readonly reference: string;
  readonly status: FinanceCaseStatus;
  readonly internshipId: string;
  readonly internshipReference: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly receiptReference: string | null;
}

/** Sum counts for the given group names (e.g. pending = SUBMITTED + UNDER_REVIEW). */
export function sumGroups(groups: readonly GroupCountDto[], names: readonly string[]): number {
  const wanted = new Set(names);
  return groups.filter((g) => wanted.has(g.groupName)).reduce((acc, g) => acc + (g.count ?? 0), 0);
}

/** Exact count for one group name, 0 when the backend omits the group. */
export function countOf(groups: readonly GroupCountDto[], name: string): number {
  return groups.find((g) => g.groupName === name)?.count ?? 0;
}

/** Total of all groups (denominator for distribution bars). */
export function totalOf(groups: readonly GroupCountDto[]): number {
  return groups.reduce((acc, g) => acc + (g.count ?? 0), 0);
}

/** Normalize payment-totals payload (backend may return one row or an array). */
export function normalizePaymentTotals(
  payload: PaymentTotalRowDto | readonly PaymentTotalRowDto[] | null,
): readonly PaymentTotalRowDto[] {
  if (isPaymentRowArray(payload)) return payload;
  if (payload === null) return [];
  return [payload];
}

function isPaymentRowArray(value: unknown): value is readonly PaymentTotalRowDto[] {
  return Array.isArray(value);
}

/* ------------------------------------------------------------------ */
/* Phase C2 — candidate / application review workspace contracts.      */
/* Mirrors steg-backend/docs/openapi.json. Backend is authoritative;  */
/* these are transport types only, no business rules live here.       */
/* ------------------------------------------------------------------ */

/** Full application record (GET /api/applications, GET /api/applications/{id}). */
export interface ApplicationDetail {
  readonly id: string;
  readonly reference: string;
  readonly status: ApplicationStatus;
  readonly candidateId: string;
  readonly candidateName: string;
  readonly desiredStartDate: string;
  readonly desiredEndDate: string;
  readonly proposedTheme: string | null;
  readonly submittedOnline: boolean;
  readonly submissionDate: string | null;
  /** Backend-calculated internship type — read-only, never set by the client. */
  readonly calculatedType: InternshipType | null;
  /** Backend-calculated requirement — read-only, never set by the client. */
  readonly requirement: 'OBLIGATOIRE' | 'OPTIONAL' | null;
  readonly rejectionReason: string | null;
  readonly correctionComment: string | null;
  readonly reviewerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export type WorkflowActionType =
  | 'APPROVAL'
  | 'VALIDATION'
  | 'SUBMISSION'
  | 'REJECTION'
  | 'CORRECTION_REQUEST'
  | 'CANCELLATION'
  | 'COMPLETION';
export type WorkflowDecision =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'MODIFICATION_REQUESTED';

/** POST /api/applications/{id}/workflow/actions body. */
export interface WorkflowTransitionRequest {
  readonly targetStepCode?: string;
  readonly actionType: WorkflowActionType;
  readonly decision?: WorkflowDecision;
  readonly comment?: string;
}

export interface WorkflowInstanceResponse {
  readonly id: string;
  readonly definitionCode: string;
  readonly definitionName: string;
  readonly currentStepCode: string;
  readonly currentStepName: string;
  readonly status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
}

export interface WorkflowActionResponse {
  readonly id: string;
  readonly instanceId: string;
  readonly stepCode: string;
  readonly stepName: string;
  readonly performedById: string;
  readonly performedByUsername: string;
  readonly type: WorkflowActionType;
  readonly decision: WorkflowDecision;
  readonly comment: string | null;
  readonly sequenceNumber: number;
  readonly performedAt: string;
}

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
  | 'PROJECT_DEMO_IMAGE'
  | 'INTERNSHIP_CERTIFICATE'
  | 'INTERNSHIP_LOGBOOK'
  | 'CIN_COPY'
  | 'PAYMENT_RECEIPT'
  | 'OTHER';
export type DocumentVerificationStatus =
  'PENDING' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_CORRECTION';

export interface DocumentFile {
  readonly id: string;
  readonly reference: string;
  readonly type: DocumentType;
  readonly restrictedAccess: boolean;
  readonly generatedAutomatically: boolean;
  readonly latestVersionNumber: number;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly uploadedAt: string;
  readonly createdAt: string;
}

export interface ApplicationDocumentItem {
  readonly id: string;
  readonly applicationId: string;
  readonly document: DocumentFile;
  readonly mandatory: boolean;
  readonly verificationStatus: DocumentVerificationStatus;
  readonly verificationComment: string | null;
  readonly verifiedById: string | null;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
}

export interface DocumentVerificationBody {
  readonly status: DocumentVerificationStatus;
  readonly comment?: string;
}

export interface DocumentAiValidationResponse {
  readonly documentId?: string | null;
  readonly valid: boolean;
  readonly documentTypeValid: boolean;
  readonly candidateNameValid: boolean;
  readonly confidence: number;
  readonly reason: string;
}

/**
 * Candidate list projection. nationalId is NEVER present here by backend
 * contract — the type omits it so lists cannot leak CIN even by accident.
 */
export interface CandidateSummary {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly birthDate: string | null;
  readonly speciality: string | null;
  readonly diploma: string | null;
  readonly universityId: string;
  readonly universityName: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** Full candidate profile (staff view). nationalId is sensitive — mask in UI. */
export interface CandidateDetail extends CandidateSummary {
  readonly address: string | null;
  readonly skills: string | null;
  readonly languages: string | null;
  readonly nationalId: string | null;
}

export interface University {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

/**
 * Manual intake payload (POST /api/public/applications, multipart).
 * Produces the identical InternshipApplication model as online applications;
 * source is read back from `submittedOnline` on the response/detail.
 */
export interface ManualApplicationFields {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly birthDate: string;
  readonly nationalId: string;
  readonly universityId: string;
  readonly speciality: string;
  readonly diploma: string;
  readonly desiredStartDate: string;
  readonly desiredEndDate: string;
}

export interface ManualApplicationResult {
  readonly reference: string;
  readonly status: string;
  readonly trackingToken: string;
}

/* ------------------------------------------------------------------ */
/* Phase C3 — internship lifecycle & assignment contracts.             */
/* Mirrors steg-backend/docs/openapi.json. All classification,         */
/* eligibility and transition rules live backend-side; these are       */
/* transport types only.                                               */
/* ------------------------------------------------------------------ */

export type InternshipRequirement = 'OBLIGATOIRE' | 'OPTIONAL';

/** GET /api/internships, GET /api/internships/{id}. */
export interface InternshipDetail {
  readonly id: string;
  readonly reference: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: InternshipStatus;
  /** Backend-computed — read-only, never set by the client. */
  readonly type: InternshipType;
  /** Backend-computed — read-only, never set by the client. */
  readonly requirement: InternshipRequirement;
  /** Backend-computed payment eligibility flag — read-only. */
  readonly paymentEligible: boolean;
  readonly subject: string;
  readonly academicLevel: string;
  readonly candidateId: string;
  readonly candidateFullName: string;
  readonly applicationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** GET /api/internships/{id}/classification — read-only transparency view. */
export interface InternshipClassification {
  readonly internshipId: string;
  readonly reference: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly type: InternshipType;
  readonly requirement: InternshipRequirement;
  readonly paymentEligible: boolean;
  readonly durationInDays: number;
  readonly appliedRuleDescription: string;
}

export type AssignmentStatus = 'PLANNED' | 'ACTIVE' | 'ENDED' | 'REASSIGNED' | 'CANCELLED';

/** GET/POST /api/internships/{id}/assignments. */
export interface InternshipAssignment {
  readonly id: string;
  readonly internshipId: string;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly supervisorId: string;
  readonly supervisorName: string;
  readonly assignedById: string;
  readonly assignedByName: string;
  readonly assignedAt: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: AssignmentStatus;
  readonly assignmentReason: string | null;
  readonly endedAt: string | null;
  readonly createdAt: string;
  readonly version: number;
}

export interface InternshipAssignmentRequest {
  readonly departmentId: string;
  readonly supervisorId: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly assignmentReason?: string;
}

/** POST /api/internships/from-application. */
export interface InternshipCreateFromApplicationRequest {
  readonly applicationId: string;
  /**
   * Explicit flag for observation internships (true = OBLIGATOIRE).
   * Null/absent conservatively defaults to OPTIONAL backend-side.
   */
  readonly observationObligatoire?: boolean | null;
}

/** POST /api/internships/manual. */
export interface InternshipCreateManualRequest {
  readonly candidateId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly subject: string;
  readonly academicLevel?: string;
  readonly observationObligatoire?: boolean | null;
}

/** PUT /api/internships/{id}/dates — backend recomputes classification. */
export interface InternshipUpdateDatesRequest {
  readonly startDate: string;
  readonly endDate: string;
  readonly observationObligatoire?: boolean | null;
}

export interface Department {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly parentDepartmentId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface Employee {
  readonly id: string;
  readonly employeeNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string | null;
  readonly position: string | null;
  readonly hireDate: string | null;
  readonly active: boolean;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly userId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** POST /api/internships/{id}/certificates response (metadata; PDF via download). */
export interface CertificateInfo {
  readonly id: string;
  readonly reference: string;
  readonly status: 'GENERATED' | 'REVOKED';
  readonly templateCode: string;
  readonly templateVersion: number;
  readonly internshipId: string;
  readonly internshipReference: string;
  readonly generatedAt: string;
  readonly issueDate: string;
}

/* ------------------------------------------------------------------ */
/* Phase C4 — internship document workspace contracts.                 */
/* Mirrors steg-backend/docs/openapi.json. Verification support varies */
/* per context (application docs: yes; internship docs: read-only);    */
/* the client never invents verification semantics.                    */
/* ------------------------------------------------------------------ */

/** GET /api/internships/{id}/documents item. No verification fields by contract. */
export interface InternshipDocumentItem {
  readonly id: string;
  readonly internshipId: string;
  readonly document: DocumentFile;
  readonly mandatory: boolean;
  readonly generatedAutomatically: boolean;
  readonly createdAt: string;
}

/** POST /api/internships/{id}/documents body. */
export interface AttachInternshipDocumentBody {
  readonly documentId: string;
  readonly mandatory?: boolean;
}

/** Document types staff may upload into an internship dossier. */
export const INTERNSHIP_UPLOAD_TYPES: readonly DocumentType[] = [
  'INTERNSHIP_APPLICATION',
  'ASSIGNMENT_LETTER',
  'STEG_INTERNSHIP_REPORT',
  'CAHIER_DES_CHARGES',
  'PROJECT_DEMO_IMAGE',
  'INTERNSHIP_CONVENTION',
  'CIN_COPY',
  'OTHER',
];

/** Dossier completeness expectations (presence only — finance decides). */
export const REQUIRED_DOSSIER_TYPES: readonly DocumentType[] = [
  'INTERNSHIP_APPLICATION',
  'ASSIGNMENT_LETTER',
  'STEG_INTERNSHIP_REPORT',
];

/* ------------------------------------------------------------------ */
/* Phase C5 — finance & payment workspace contracts.                   */
/* Mirrors Phase A11 endpoints. Calculation fields are rendered        */
/* verbatim; no payment formula lives in the client.                   */
/* ------------------------------------------------------------------ */

/** GET /api/finance-cases/{id} — full case with calculation + history. */
export interface FinanceCaseDetail {
  readonly id: string;
  readonly reference: string;
  readonly status: FinanceCaseStatus;
  readonly internshipId: string;
  readonly internshipReference: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly workflowInstanceId: string;
  readonly calculation: PaymentCalculation | null;
  readonly documents: readonly FinanceCaseDocument[];
  readonly approvals: readonly PaymentApproval[];
  readonly receiptReference: string | null;
}

/** Backend payment snapshot — displayed verbatim, never recomputed. */
export interface PaymentCalculation {
  readonly completedMonths: number;
  readonly payableMonths: number;
  readonly ratePerMonth: number;
  readonly calculatedAmount: number;
  readonly cappedAmount: number;
  readonly capApplied: boolean;
  readonly currencyCode: string;
  readonly calculatedAt: string;
}

export interface PaymentApproval {
  readonly id: string;
  readonly decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  readonly comment: string | null;
  readonly decisionSequence: number;
  readonly decidedAt: string;
  readonly decidedByName: string;
}

export interface FinanceCaseDocument {
  readonly documentId: string;
  readonly documentReference: string;
  readonly documentType: DocumentType;
  readonly mandatory: boolean;
  readonly verificationStatus: DocumentVerificationStatus;
  readonly verificationComment: string | null;
  readonly reviewedAt: string | null;
  readonly reviewedByName: string | null;
}

export interface PaymentDecisionBody {
  readonly comment?: string;
}

export interface FinanceDocumentReviewBody {
  readonly status: DocumentVerificationStatus;
  readonly comment?: string;
}

/** Advisory AI result — recommendations are read-only proposals for humans. */
export interface AiAnalysisResult {
  readonly analysis: AiAnalysis;
  readonly recommendations: readonly AiRecommendation[];
  readonly responseText: string;
}

export interface AiAnalysis {
  readonly id: string;
  readonly type: string;
  readonly relatedEntityType: string;
  readonly relatedEntityId: string;
  readonly modelUsed: string;
  readonly inputSummary: string;
  readonly outputSummary: string;
  readonly cinExcluded: boolean;
  readonly createdAt: string;
}

export interface AiRecommendation {
  readonly id: string;
  readonly analysisId: string;
  readonly recommendationText: string;
  readonly status: 'PROPOSED' | 'ACCEPTED_BY_HUMAN' | 'DISMISSED';
  readonly reviewedById: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Phase C6 — administration workspace contracts.                      */
/* Department/employee/audit mirror the backend; user-account           */
/* provisioning has no backend endpoint (marked pending in UI).        */
/* ------------------------------------------------------------------ */

export interface DepartmentRequest {
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly parentDepartmentId?: string | null;
}

export interface EmployeeRequest {
  readonly employeeNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber?: string;
  readonly position?: string;
  readonly hireDate?: string;
  readonly departmentId: string;
  readonly userId?: string | null;
}

/** GET /api/audit item. old/new values are opaque backend-redacted JSON. */
export interface AuditLogEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly oldValues: string | null;
  readonly newValues: string | null;
  readonly actorId: string;
  readonly actorEmail: string;
  readonly ipAddress: string;
  readonly source?: string | null;
}

export type AuditSource = 'FRONT_OFFICE' | 'BACK_OFFICE' | 'MOBILE' | 'SYSTEM' | 'AI';

export interface AuditQuery {
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly source?: AuditSource;
  /** Absolute instant bound (ISO-8601); wins over fromDate when both are sent. */
  readonly from?: string;
  /** Absolute instant bound (ISO-8601); wins over toDate when both are sent. */
  readonly to?: string;
  /** Calendar day (yyyy-MM-dd) resolved server-side in the application time zone. */
  readonly fromDate?: string;
  /** Calendar day (yyyy-MM-dd, inclusive) resolved server-side in the application time zone. */
  readonly toDate?: string;
  readonly page: number;
  readonly size: number;
}

/** Backend error → user-safe message mapping (no stack traces, no secrets). */
export function toUserMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const envelope = (error as { error?: ApiErrorEnvelope }).error ?? (error as ApiErrorEnvelope);
    if (envelope?.message) return envelope.message;
    if (typeof envelope?.error === 'string') return envelope.error;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Unexpected error';
}

/* ------------------------------------------------------------------ */
/* Supervision workspace contracts (companion + evaluation).           */
/* Mirrors steg-backend CompanionController/EvaluationController DTOs. */
/* All progress/validation rules live backend-side; these are         */
/* transport types only.                                               */
/* ------------------------------------------------------------------ */

/** Task attached to an internship (Flutter + back office share the model). */
export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'APPROVED'
  | 'DENIED'
  | 'CANCELLED';

export interface CompanionTask {
  readonly id: string;
  readonly internshipId: string;
  readonly createdById: string | null;
  readonly createdByEmail: string | null;
  readonly assignedToId: string | null;
  readonly assignedToEmail: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly dueDate: string | null;
  readonly completedAt: string | null;
  readonly reviewReason?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TaskRequest {
  readonly title: string;
  readonly description?: string;
  readonly assignedToId?: string | null;
  readonly dueDate?: string | null;
  readonly status?: TaskStatus;
}

/** S6c — atomic bulk task mutation (AGENTS.md §5.5/§6.1). */
export type BulkTaskAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface BulkTaskMutation {
  readonly action: BulkTaskAction;
  readonly internshipId?: string | null;
  readonly taskId?: string | null;
  readonly task?: TaskRequest | null;
}

export interface BulkTaskItemResult {
  readonly index: number;
  readonly action: BulkTaskAction;
  readonly taskId: string | null;
  readonly internshipId: string | null;
  readonly status: string;
}

export interface BulkTaskResult {
  readonly tasks: CompanionTask[];
  readonly deletedCount: number;
  readonly items: BulkTaskItemResult[];
}

/* ------------------------------------------------------------------ */
/* S7 internship validation (AGENTS.md §5.11). Transport types only:    */
/* scope, transitions, AI degradation and receipt rules live backend.  */
/* ------------------------------------------------------------------ */

export type ValidationDocumentType = 'REPORT' | 'JOURNAL';

export interface ValidationQueueQuery {
  readonly page: number;
  readonly size: number;
  readonly sort?: string;
  readonly q?: string;
  readonly statuses?: string[];
  readonly supervisorUserId?: string;
  readonly universityId?: string;
  readonly type?: string;
}

export interface ValidationQueueRow {
  readonly internshipId: string;
  readonly reference: string;
  readonly status: string;
  readonly type: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly candidateId: string | null;
  readonly candidateName: string;
  readonly candidateEmail: string | null;
  readonly universityName: string | null;
  readonly supervisorUserId: string | null;
  readonly supervisorEmail: string | null;
}

export interface ValidationCheckView {
  readonly key: string;
  readonly label: string;
  readonly status: 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | string;
  readonly expected: string;
  readonly found: string;
  readonly evidence: string;
}

export interface ValidationRunView {
  readonly overall: string;
  readonly degraded: boolean;
  readonly checks: ValidationCheckView[];
  readonly runBy: string | null;
  readonly runAt: string;
}

export interface ValidationDecisionView {
  readonly decision: 'VALIDATED' | 'REJECTED' | string;
  readonly comment: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string;
}

export interface ValidationDocumentRef {
  readonly documentType: ValidationDocumentType;
  readonly deliverableId: string;
  readonly fileAssetId: string;
  readonly version: number | null;
  readonly title: string | null;
  readonly submittedAt: string | null;
  readonly sizeBytes: number | null;
}

export interface ValidationTaskItem {
  readonly id: string;
  readonly title: string;
  readonly status: string | null;
}

export interface ValidationDetail {
  readonly internshipId: string;
  readonly reference: string;
  readonly status: string;
  readonly type: string | null;
  readonly requirement: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly candidate: {
    readonly id: string | null;
    readonly fullName: string;
    readonly email: string | null;
    readonly universityName: string | null;
  };
  readonly supervisor: {
    readonly userId: string | null;
    readonly email: string | null;
    readonly displayName: string | null;
  };
  readonly tasks: { readonly total: number; readonly done: number; readonly items: ValidationTaskItem[] };
  readonly report: ValidationDocumentRef | null;
  readonly journal: ValidationDocumentRef | null;
  readonly latestReportRun: ValidationRunView | null;
  readonly latestJournalRun: ValidationRunView | null;
  readonly reportDecision: ValidationDecisionView | null;
  readonly journalDecision: ValidationDecisionView | null;
  readonly receipt: { readonly reference: string; readonly amount: string | null; readonly currency: string | null; readonly downloadable: boolean } | null;
}

export interface VerificationResult {
  readonly documentType: ValidationDocumentType;
  readonly overall: string;
  readonly degraded: boolean;
  readonly checks: ValidationCheckView[];
  readonly runId: string;
}

export interface ValidationReceipt {
  readonly reference: string;
  readonly amount: number | string | null;
  readonly currency: string | null;
  readonly financeCaseId: string;
}

/* ------------------------------------------------------------------ */
/* S8 certificates (AGENTS.md §5.7). Transport types only: eligibility, */
/* versioning, revocation and scope live backend-side.                  */
/* ------------------------------------------------------------------ */

export type CertificateStatus = 'GENERATED' | 'REVOKED';

export interface CertificateRow {
  readonly id: string;
  readonly reference: string;
  readonly status: CertificateStatus | string;
  readonly versionNumber: number;
  readonly issueDate: string | null;
  readonly generatedAt: string;
  readonly internshipId: string | null;
  readonly internshipReference: string | null;
  readonly candidateName: string;
  readonly candidateEmail: string | null;
  readonly universityName: string | null;
  readonly internshipType: string | null;
}

export interface CertificateVersionEntry {
  readonly versionNumber: number;
  readonly fileAssetId: string | null;
  readonly generatedAt: string;
}

export interface CertificateDetail {
  readonly certificate: CertificateRow;
  readonly versions: CertificateVersionEntry[];
}

export interface CertificateQuery {
  readonly page: number;
  readonly size: number;
  readonly sort?: string;
  readonly q?: string;
  readonly status?: CertificateStatus;
}

/** Daily journal entry submitted from the Flutter mobile app. */
export type JournalEntryStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';

export interface JournalEntry {
  readonly id: string;
  readonly journalId: string | null;
  readonly authorId: string | null;
  readonly authorEmail: string | null;
  readonly validatedById: string | null;
  readonly validatedByName: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: JournalEntryStatus;
  readonly entryDate: string;
  readonly submittedAt: string | null;
  readonly validatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JournalValidationBody {
  readonly comment?: string;
}

/** Internship report deliverable with append-only versions. */
export type DeliverableStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';

export interface DeliverableItem {
  readonly id: string;
  readonly internshipId: string;
  readonly validatedById: string | null;
  readonly validatedByName: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: DeliverableStatus;
  readonly currentVersion: number;
  readonly submittedAt: string | null;
  readonly validatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Supervisor/intern evaluation (totalScore computed backend-side). */
export type EvaluationType = 'DAILY' | 'WEEKLY' | 'MID_TERM' | 'FINAL' | 'CUSTOM';

export interface EvaluationItem {
  readonly id: string;
  readonly internshipId: string;
  readonly evaluatorId: string | null;
  readonly evaluatorEmail: string | null;
  readonly templateId: string | null;
  readonly templateName: string | null;
  readonly type: EvaluationType;
  readonly evaluationDate: string;
  readonly feedback: string | null;
  readonly totalScore: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EvaluationCreateBody {
  readonly templateId?: string | null;
  readonly type: EvaluationType;
  readonly evaluationDate: string;
  readonly feedback?: string;
}

export interface EvaluationScoreItem {
  readonly id: string;
  readonly evaluationId: string;
  readonly criterionId: string | null;
  readonly criterionName: string | null;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly weight: number | null;
  readonly comment: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EvaluationCriterionItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly maxScore: number;
  readonly weight: number;
}

export interface EvaluationTemplateItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly criteria: readonly EvaluationCriterionItem[];
}

/* ------------------------------------------------------------------ */
/* Administrative validation decisions (AGENTS.md §5.11 step 4):       */
/* the Admin's manual per-document verdict, VALIDATED or REJECTED.     */
/* Advisory AI output can never produce one of these.                  */
/* ------------------------------------------------------------------ */

/**
 * The Admin's MANUAL decision on one internship validation document
 * (AGENTS.md §5.11 step 4). Deliberately its own vocabulary — NOT an
 * application status and NOT a workflow decision: "I checked this report /
 * journal myself and I accept or refuse it" is a different question from
 * whether an internship application was approved. Mirrors the backend
 * `ValidationDecision` enum. The AI verification result (§7.3) is advisory and
 * can never produce one of these.
 */
export type ValidationDecision = 'VALIDATED' | 'REJECTED';

export const VALIDATION_DECISIONS: readonly ValidationDecision[] = ['VALIDATED', 'REJECTED'];

/** PUT /api/candidates/{id} body (staff profile correction). */
export interface CandidateUpdateBody {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly birthDate?: string | null;
  readonly address?: string | null;
  readonly speciality?: string | null;
  readonly diploma?: string | null;
  readonly skills?: string | null;
  readonly languages?: string | null;
  readonly universityId: string;
  /** Optional on update (S5): omitted/blank keeps the stored CIN — staff and
   * Supervisors edit without ever receiving it. Required on create. */
  readonly nationalId?: string | null;
}

/**
 * POST /api/candidates/manage — staff creation of a profile on behalf of
 * somebody (AGENTS.md §5.1 Admin / §6.2 Supervisor in his own scope, A4).
 *
 * The profile has NO account: the owner claims it later by registering on the
 * front office with the same CIN or the same email. `managedByUserId` is the
 * managing staff member — an ADMIN may choose any supervisor or the admin
 * himself; a SUPERVISOR may only create candidates he manages himself (the
 * backend refuses anything else with 403).
 */
export interface StaffCandidateCreateBody {
  readonly candidate: CandidateUpdateBody;
  readonly managedByUserId?: string | null;
}

/** GET /api/intern-accounts row (subset used by the credentials resend flow). */
export interface InternAccount {
  readonly id: string;
  readonly email: string;
  readonly role?: string;
  readonly enabled?: boolean;
  readonly mustChangePassword?: boolean;
}

/** POST /api/intern-accounts/{id}/reset-password result (shown once). */
export interface ResetAccountPasswordResult {
  readonly email: string;
  readonly temporaryPassword: string;
  readonly emailSent: boolean;
}

/** GET /api/supervisors — selectable supervisors (Admin included, AGENTS.md §3.2). */
export interface SupervisorOption {
  readonly userId: string;
  readonly email: string;
  /** Backend role code: ADMIN or SUPERVISOR. */
  readonly role: string;
}

/** IAM account status (backend `UserStatus`). */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

/** GET /api/supervisors/manage row (SupervisorResponse). */
export interface SupervisorRow {
  readonly id: string;
  readonly email: string;
  /** Primary role code resolved backend-side: ADMIN or SUPERVISOR. */
  readonly role: string;
  readonly status: UserStatus;
  readonly enabled: boolean;
  /** ACTIVE assignments — the delete guard (§5.6). */
  readonly activeAssignmentsCount: number;
  readonly createdAt: string;
}

/** GET /api/supervisors/manage query — every field is handled SERVER-side. */
export interface SupervisorQueueQuery {
  readonly page: number;
  readonly size: number;
  /** Only email/status/createdAt are whitelisted backend-side; others fall back to email ASC. */
  readonly sort?: string;
  readonly q?: string;
  readonly status?: UserStatus;
}

/** POST /api/supervisors body. */
export interface CreateSupervisorBody {
  readonly email: string;
}

/**
 * PUT /api/supervisors/{id} body. Absent fields are left untouched by the
 * backend, so the edit dialog sends only what the Admin actually changed.
 */
export interface UpdateSupervisorBody {
  readonly status?: UserStatus;
  readonly enabled?: boolean;
}

/** GET /api/intern-accounts/manage row (backend `InternAccountResponse`, §5.4). */
export interface InternAccountRow {
  readonly id: string;
  readonly email: string;
  /** Backend role codes, sorted: INTERN and/or SUPERVISOR. */
  readonly roles: string[];
  readonly status: UserStatus;
  readonly enabled: boolean;
  readonly mustChangePassword: boolean;
  /** Candidate full name, when the account is linked to a candidate profile. */
  readonly fullName: string | null;
  readonly candidateId: string | null;
  readonly internshipId: string | null;
  readonly createdAt: string | null;
}

/** GET /api/intern-accounts/manage query — every field is handled SERVER-side. */
export interface InternAccountQueueQuery {
  readonly page: number;
  readonly size: number;
  /** Only email/status/createdAt are whitelisted backend-side. */
  readonly sort?: string;
  readonly q?: string;
  /** Backend role codes; `student` in the UI maps to INTERN. */
  readonly role?: 'INTERN' | 'SUPERVISOR';
  readonly status?: UserStatus;
}

/** POST /api/intern-accounts body — the backend returns one-time credentials. */
export interface CreateInternAccountBody {
  readonly email: string;
  readonly role: 'INTERN' | 'SUPERVISOR';
  readonly candidateId?: string | null;
}

/** PUT /api/intern-accounts/{id} body (absent fields stay untouched). */
export interface UpdateInternAccountBody {
  readonly status?: UserStatus;
  readonly enabled?: boolean;
}

/** POST /api/supervisors/{id}/assign-candidate body. */
export interface AssignCandidateBody {
  readonly internshipId: string;
  readonly departmentId?: string | null;
}

/** PUT /api/supervisors/{id}/reassign/{internshipId} body. */
export interface ReassignSupervisorBody {
  readonly newSupervisorUserId: string;
  readonly reason?: string | null;
}

/** POST /api/applications/{id}/approve body — supervisorUserId null = acting Admin. */
export interface ApplicationApprovalBody {
  readonly supervisorUserId: string | null;
  readonly departmentId: string;
}

/**
 * Atomic approval result. `temporaryPassword` is present exactly once, only
 * when the mobile-account policy applies (AGENTS.md §5.3); it must never be
 * persisted client-side.
 */
export interface ApplicationApprovalResult {
  readonly supervisorUserId: string | null;
  readonly credentialEmail: string | null;
  readonly temporaryPassword: string | null;
  readonly credentialEmailSent: boolean;
  readonly internship: { readonly id: string; readonly reference?: string } | null;
}

/** GET /api/candidates/manage row (backend CandidateQueueResponse, §5.1). */
export interface CandidateQueueRow {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly speciality: string | null;
  readonly diploma: string | null;
  readonly universityId: string;
  readonly universityName: string;
  /** Linked front-office account, when the candidate owns one. */
  readonly userId: string | null;
  /** null = no linked account; true/false = the account's enabled state. */
  readonly accountEnabled: boolean | null;
  readonly applicationCount: number;
  readonly latestApplicationStatus: ApplicationStatus | null;
  readonly supervisorUserId: string | null;
  readonly supervisorEmail: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** GET /api/candidates/manage query — every field is handled SERVER-side. */
export interface CandidateQueueQuery {
  /** Zero-based page index (Spring Data). */
  readonly page: number;
  readonly size: number;
  /** Whitelisted backend-side: firstName/lastName/email/createdAt/updatedAt. */
  readonly sort?: string;
  /** Full name, email or university. */
  readonly q?: string;
  readonly university?: string;
  readonly type?: InternshipType;
  /** Supervisor user id (Admin filter; the Supervisor scope is server-side). */
  readonly supervisor?: string;
  /** §5.1 "validation status" = linked front-office account state. */
  readonly validation?: 'ACTIVE' | 'DISABLED';
  readonly status?: ApplicationStatus;
  /** Profile creation date range (ISO dates, inclusive). */
  readonly from?: string;
  readonly to?: string;
}

/** One row of the candidate overview aggregate (§5.1). */
export interface CandidateOverviewApplication {
  readonly id: string;
  readonly reference: string;
  readonly status: ApplicationStatus;
  readonly type: InternshipType | null;
  readonly submissionDate: string | null;
  readonly createdAt: string;
}

/**
 * GET /api/candidates/{id}/overview — the §5.1 detail aggregate in ONE backend
 * call: profile, supervisor, applications, internship, task summary, documents
 * and certificate/receipt status. `profile.nationalId` is present only for the
 * Admin (CIN rule), never for a Supervisor.
 */
export interface CandidateOverview {
  readonly profile: CandidateDetail;
  readonly supervisor: { readonly userId: string; readonly email: string } | null;
  readonly applications: readonly CandidateOverviewApplication[];
  readonly internship: {
    readonly id: string;
    readonly reference: string;
    readonly status: string;
    readonly type: InternshipType;
    readonly startDate: string;
    readonly endDate: string;
  } | null;
  readonly tasks: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
  };
  readonly documents: readonly {
    readonly id: string;
    readonly reference: string;
    readonly type: string;
    readonly source: string;
    readonly restrictedAccess: boolean;
    readonly createdAt: string;
  }[];
  readonly certificate: {
    readonly id: string;
    readonly reference: string;
    readonly status: string;
    readonly issueDate: string | null;
    readonly generatedAt: string;
  } | null;
  readonly receipt: {
    readonly id: string;
    readonly reference: string;
    readonly status: string;
    readonly amount: number | null;
    readonly currencyCode: string | null;
    readonly paymentDate: string | null;
    readonly issuedAt: string | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* S10c — AI task drafts review (AGENTS.md §7.4, backend authoritative). */
/* Transport types only: scope, validation, atomicity all live server-side. */
/* ------------------------------------------------------------------ */

/** Server-side AI task draft: a proposal, not a real task until bulk-added. */
export interface TaskDraft {
  readonly id: string;
  readonly referenceInternshipId: string;
  readonly title: string;
  readonly description: string | null;
  readonly dueDate: string | null;
  readonly createdAt: string;
}

/** Manual draft creation (works even when AI is unavailable). */
export interface ManualDraftBody {
  readonly referenceInternshipId: string;
  readonly title: string;
  readonly description?: string;
  readonly dueDate?: string | null;
}

/** Manual draft edit (lengths and period re-validated server-side). */
export interface UpdateDraftBody {
  readonly title?: string;
  readonly description?: string | null;
  readonly dueDate?: string | null;
}

/** AI revision of one draft from a free-text instruction. */
export interface ReviseDraftBody {
  readonly instruction: string;
}

/** Atomic bulk-add of approved drafts to one or more students. */
export interface BulkAddDraftsBody {
  readonly draftIds: readonly string[];
  readonly internshipIds: readonly string[];
}

/** Per-pair result of a draft bulk-add, in request order. */
export interface DraftBulkItem {
  readonly index: number;
  readonly draftId: string;
  readonly internshipId: string;
  readonly taskId: string | null;
  readonly status: string;
}

/** Draft bulk-add result: one entry per draft-student pair. */
export interface BulkAddDraftsResult {
  readonly items: DraftBulkItem[];
}

/* ------------------------------------------------------------------ */
/* S10c — back-office chatbot (AGENTS.md §7.5, backend authoritative).  */
/* ------------------------------------------------------------------ */

/** Advisory chatbot answer; degraded = friendly fallback when AI is down. */
export interface ChatbotResponse {
  readonly answer: string;
  readonly degraded: boolean;
  readonly toolsUsed: readonly string[];
}

/** One persisted conversation turn (server-side, owner-scoped). */
export interface ChatMessage {
  readonly role: 'USER' | 'ASSISTANT';
  readonly content: string;
  readonly createdAt: string;
}

/** Caller-owned history, oldest first, bounded server-side. */
export interface ChatHistory {
  readonly turns: ChatMessage[];
}

/* ------------------------------------------------------------------ */
/* S11 — dashboard summaries (AGENTS.md §8.3, backend authoritative).   */
/* One scoped backend call per dashboard; every map carries all enum     */
/* values (zeros included) so counts per status are exact.               */
/* ------------------------------------------------------------------ */

/** Candidates per supervising user, Admin included when supervising. */
export interface WorkloadRow {
  readonly supervisorUserId: string;
  readonly email: string;
  readonly candidateCount: number;
}

/** One calendar month in the application time zone. */
export interface TrendPoint {
  readonly month: string;
  readonly applications: number;
  readonly internships: number;
}

/** Admin dashboard summary: global stats + quick actions for every module. */
export interface AdminDashboardSummary {
  readonly applicationsByStatus: Readonly<Record<string, number>>;
  readonly newCandidates: number;
  readonly tasksAwaitingApproval: number;
  readonly reportsAwaitingValidation: Readonly<Record<string, number>>;
  readonly receiptsIssued: number;
  readonly certificatesIssued: number;
  readonly supervisorWorkload: readonly WorkloadRow[];
  readonly trends: readonly TrendPoint[];
}

/** Recent notification for the supervisor dashboard. */
export interface RecentNotification {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
}

/** Supervisor dashboard summary: own candidates and tasks only. */
export interface SupervisorDashboardSummary {
  readonly myCandidates: number;
  readonly candidatesByStatus: Readonly<Record<string, number>>;
  readonly tasksAwaitingApproval: number;
  readonly overdueTasks: number;
  readonly unreadNotifications: number;
  readonly recentNotifications: readonly RecentNotification[];
}
