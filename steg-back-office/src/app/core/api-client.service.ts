import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpContext } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { asPage } from './api-models';
import { environment } from '../../environments/environment';
import { SKIP_GLOBAL_ERROR } from './error.interceptor';
import type {
  Page,
  ApplicationQueueQuery,
  ApplicationQueueRow,
  GroupCountDto,
  PaymentTotalRowDto,
  NotificationItem,
  FinanceCaseQueueItem,
  FinanceCaseStatus,
  FinanceCaseDetail,
  FinanceCaseDocument,
  PaymentDecisionBody,
  FinanceDocumentReviewBody,
  AiAnalysisResult,
  AiRecommendation,
  ApplicationDetail,
  ApplicationApprovalBody,
  ApplicationApprovalResult,
  InternAccount,
  InternAccountRow,
  InternAccountQueueQuery,
  CreateInternAccountBody,
  UpdateInternAccountBody,
  ResetAccountPasswordResult,
  SupervisorOption,
  SupervisorQueueQuery,
  SupervisorRow,
  CreateSupervisorBody,
  UpdateSupervisorBody,
  AssignCandidateBody,
  UserStatus,
  ReassignSupervisorBody,
  WorkflowTransitionRequest,
  WorkflowInstanceResponse,
  WorkflowActionResponse,
  ApplicationDocumentItem,
  DocumentVerificationBody,
  DocumentAiValidationResponse,
  CandidateSummary,
  CandidateDetail,
  CandidateOverview,
  CandidateQueueQuery,
  CandidateQueueRow,
  CandidateUpdateBody,
  StaffCandidateCreateBody,
  University,
  ManualApplicationFields,
  ManualApplicationResult,
  InternshipDetail,
  InternshipClassification,
  InternshipAssignment,
  InternshipAssignmentRequest,
  InternshipCreateFromApplicationRequest,
  InternshipCreateManualRequest,
  InternshipUpdateDatesRequest,
  Department,
  Employee,
  CertificateInfo,
  CertificateDetail,
  CertificateQuery,
  CertificateRow,
  InternshipDocumentItem,
  AttachInternshipDocumentBody,
  DocumentType,
  DocumentFile,
  DepartmentRequest,
  EmployeeRequest,
  AuditLogEntry,
  AuditQuery,
  CompanionTask,
  TaskRequest,
  TaskStatus,
  BulkTaskMutation,
  BulkTaskResult,
  ValidationDecision,
  ValidationDetail,
  ValidationDocumentType,
  ValidationQueueQuery,
  ValidationQueueRow,
  ValidationReceipt,
  VerificationResult,
  JournalEntry,
  JournalValidationBody,
  DeliverableItem,
  EvaluationItem,
  EvaluationCreateBody,
  EvaluationScoreItem,
  EvaluationTemplateItem,
  TaskDraft,
  ManualDraftBody,
  UpdateDraftBody,
  BulkAddDraftsBody,
  BulkAddDraftsResult,
  ChatbotResponse,
  ChatHistory,
  AdminDashboardSummary,
  SupervisorDashboardSummary,
} from './api-models';

/**
 * Centralized typed API client. All feature services go through here —
 * no ad-hoc fetch wrappers. Base URL + auth + error envelope centralized.
 * Report methods mirror `steg-backend/docs/openapi.json` (Phase A13 export).
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiBaseUrl;

  /** Spring Data pageable params for endpoints with a required `pageable`. */
  private pageable(page: number, size: number, sort?: string): HttpParams {
    let p = new HttpParams().set('page', page).set('size', Math.min(size, environment.pageSizeMax));
    if (sort) p = p.set('sort', sort);
    return p;
  }

  /**
   * Staff application queue (AGENTS.md §5.2): pagination, search, filters and
   * sort run SERVER-side on `GET /api/applications/manage`. ADMIN sees every
   * application; SUPERVISOR only his own candidates — the backend derives the
   * scope and ignores any client-supplied one.
   */
  searchApplications(query: ApplicationQueueQuery): Observable<Page<ApplicationQueueRow>> {
    let p = new HttpParams()
      .set('page', query.page)
      .set('size', Math.min(query.size, environment.pageSizeMax));
    if (query.sort) p = p.set('sort', query.sort);
    if (query.q) p = p.set('q', query.q);
    if (query.status) p = p.set('status', query.status);
    if (query.type) p = p.set('type', query.type);
    if (query.university) p = p.set('university', query.university);
    if (query.from) p = p.set('from', query.from);
    if (query.to) p = p.set('to', query.to);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/applications/manage`, {
        params: p,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<ApplicationQueueRow>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  // -- Phase A13 reporting endpoints (aggregate counts, not raw dumps) --

  private silentContext(): HttpContext {
    return new HttpContext().set(SKIP_GLOBAL_ERROR, true);
  }

  getApplicationsByStatus(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/applications-by-status`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* ------------------------------------------------------------------ */
  /* S11 — dashboard summaries (AGENTS.md §8.3).                          */
  /* ------------------------------------------------------------------ */

  /**
   * Admin dashboard summary, global scope (ADMIN only, enforced server-side).
   * One call serves every Admin tile: pending applications, new candidates,
   * tasks awaiting approval, reports awaiting validation, receipts and
   * certificates issued, supervisor workload and monthly trends.
   */
  getAdminSummary(): Observable<AdminDashboardSummary> {
    return this.http
      .get<AdminDashboardSummary>(`${this.baseUrl}/api/reports/admin-summary`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Supervisor dashboard summary, own scope (ADMIN sees global numbers).
   * One call serves every Supervisor tile: own candidates, tasks awaiting
   * approval, overdue tasks, candidates by status and recent notifications.
   */
  getSupervisorSummary(): Observable<SupervisorDashboardSummary> {
    return this.http
      .get<SupervisorDashboardSummary>(`${this.baseUrl}/api/reports/supervisor-summary`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternshipsByStatus(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/internships-by-status`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternshipsByType(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/internships-by-type`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternshipsByDepartment(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/internships-by-department`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getFinanceCasesByStatus(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/finance-cases-by-status`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getPaymentTotals(departmentId?: string): Observable<PaymentTotalRowDto | PaymentTotalRowDto[]> {
    let params = new HttpParams();
    if (departmentId) params = params.set('departmentId', departmentId);
    return this.http
      .get<PaymentTotalRowDto | PaymentTotalRowDto[]>(
        `${this.baseUrl}/api/reports/payment-totals`,
        {
          params,
          context: this.silentContext(),
        },
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  // -- Bounded queue reads (small pages only; never full dumps on the dashboard) --

  getFinanceCases(
    status: FinanceCaseStatus,
    page = 0,
    size = 5,
  ): Observable<Page<FinanceCaseQueueItem>> {
    const params = this.pageable(page, size, 'openedAt,desc').set('status', status);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/finance-cases`, {
        params,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<FinanceCaseQueueItem>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  getNotifications(unreadOnly: boolean, page = 0, size = 8): Observable<Page<NotificationItem>> {
    const params = this.pageable(page, size, 'createdAt,desc').set('unreadOnly', unreadOnly);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/notifications`, {
        params,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<NotificationItem>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Unread count for the topbar bell (own deliveries only, backend-scoped). */
  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.http
      .get<{ unreadCount: number }>(`${this.baseUrl}/api/notifications/unread-count`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Mark one notification as read (own deliveries only, backend-scoped). */
  markNotificationRead(id: string): Observable<unknown> {
    return this.http
      .post(`${this.baseUrl}/api/notifications/${id}/read`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Mark all own notifications as read. */
  markAllNotificationsRead(): Observable<unknown> {
    return this.http
      .post(`${this.baseUrl}/api/notifications/read-all`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Secure download via backend endpoint only — never expose storage keys. */
  downloadUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /* -------- Phase C2 — candidate / application review workspace -------- */

  /** Staff application list (ADMIN/HR see all). Backend returns the full array. */
  listApplications(): Observable<ApplicationDetail[]> {
    return this.http
      .get<ApplicationDetail[]>(`${this.baseUrl}/api/applications`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getApplication(id: string): Observable<ApplicationDetail> {
    return this.http
      .get<ApplicationDetail>(`${this.baseUrl}/api/applications/${id}`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getApplicationDocuments(applicationId: string): Observable<ApplicationDocumentItem[]> {
    return this.http
      .get<ApplicationDocumentItem[]>(
        `${this.baseUrl}/api/applications/${applicationId}/documents`,
        { context: this.silentContext() },
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  verifyApplicationDocument(
    applicationId: string,
    documentId: string,
    body: DocumentVerificationBody,
  ): Observable<ApplicationDocumentItem> {
    return this.http
      .put<ApplicationDocumentItem>(
        `${this.baseUrl}/api/applications/${applicationId}/documents/${documentId}/verify`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff workflow transitions (backend guard is authoritative):
   * review = VALIDATION/UNDER_REVIEW; accept/reject/correct = APPROVAL/FINAL_DECISION.
   */
  executeApplicationTransition(
    applicationId: string,
    body: WorkflowTransitionRequest,
  ): Observable<WorkflowActionResponse> {
    return this.http
      .post<WorkflowActionResponse>(
        `${this.baseUrl}/api/applications/${applicationId}/workflow/actions`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Atomic approval (AGENTS.md §5.2): application → APPROVED, internship +
   * supervisor assignment and, when the policy applies, the mobile account,
   * all in one backend transaction. Supervisor defaults to the acting Admin.
   */
  approveApplication(
    applicationId: string,
    body: ApplicationApprovalBody,
  ): Observable<ApplicationApprovalResult> {
    return this.http
      .post<ApplicationApprovalResult>(
        `${this.baseUrl}/api/applications/${applicationId}/approve`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Selectable supervisors for the approval dialog (Admin + Supervisors, §3.2). */
  listSupervisors(): Observable<SupervisorOption[]> {
    return this.http
      .get<SupervisorOption[]>(`${this.baseUrl}/api/supervisors`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Supervisor management list (AGENTS.md §5.6): pagination, email search,
   * status filter and sort run SERVER-side on `GET /api/supervisors/manage`,
   * which is the literal segment mapped before `/{id}` on the backend.
   */
  searchSupervisors(query: SupervisorQueueQuery): Observable<Page<SupervisorRow>> {
    let p = new HttpParams()
      .set('page', query.page)
      .set('size', Math.min(query.size, environment.pageSizeMax));
    if (query.sort) p = p.set('sort', query.sort);
    if (query.q) p = p.set('q', query.q);
    if (query.status) p = p.set('status', query.status);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/supervisors/manage`, {
        params: p,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<SupervisorRow>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /**
   * Create a supervisor account. The response carries the one-time password
   * (AGENTS.md §5.3): it is displayed once and never stored client-side.
   */
  createSupervisor(body: CreateSupervisorBody): Observable<ResetAccountPasswordResult> {
    return this.http
      .post<ResetAccountPasswordResult>(`${this.baseUrl}/api/supervisors`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Status / enabled flag update (both optional — the backend keeps the rest). */
  updateSupervisor(id: string, body: UpdateSupervisorBody): Observable<SupervisorRow> {
    return this.http
      .put<SupervisorRow>(`${this.baseUrl}/api/supervisors/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Delete — 409 `SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS` while candidates are assigned. */
  deleteSupervisor(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/supervisors/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Assign an approved candidate/internship to this supervisor (closes any prior ACTIVE one). */
  assignCandidateToSupervisor(id: string, body: AssignCandidateBody): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/api/supervisors/${id}/assign-candidate`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Move an internship to another supervisor (Admin included); history is preserved. */
  reassignSupervisor(
    id: string,
    internshipId: string,
    body: ReassignSupervisorBody,
  ): Observable<void> {
    return this.http
      .put<void>(`${this.baseUrl}/api/supervisors/${id}/reassign/${internshipId}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * 'STEG intern' account management list (AGENTS.md §5.4): pagination, search,
   * role/status filters and sort all run SERVER-side on
   * `GET /api/intern-accounts/manage` (the literal segment mapped before `/{id}`).
   */
  searchInternAccounts(query: InternAccountQueueQuery): Observable<Page<InternAccountRow>> {
    let p = new HttpParams()
      .set('page', query.page)
      .set('size', Math.min(query.size, environment.pageSizeMax));
    if (query.sort) p = p.set('sort', query.sort);
    if (query.q) p = p.set('q', query.q);
    if (query.role) p = p.set('role', query.role);
    if (query.status) p = p.set('status', query.status);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/intern-accounts/manage`, {
        params: p,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<InternAccountRow>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Create a mobile account; the one-time password is shown once and never stored. */
  createInternAccount(body: CreateInternAccountBody): Observable<ResetAccountPasswordResult> {
    return this.http
      .post<ResetAccountPasswordResult>(`${this.baseUrl}/api/intern-accounts`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Status / enabled flag update (both optional — the backend keeps the rest). */
  updateInternAccount(id: string, body: UpdateInternAccountBody): Observable<InternAccountRow> {
    return this.http
      .put<InternAccountRow>(`${this.baseUrl}/api/intern-accounts/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Activate/deactivate through the dedicated PATCH route. */
  setInternAccountStatus(
    id: string,
    body: { readonly status?: UserStatus; readonly enabled?: boolean },
  ): Observable<InternAccountRow> {
    let p = new HttpParams();
    if (body.status) p = p.set('status', body.status);
    if (body.enabled !== undefined) p = p.set('enabled', String(body.enabled));
    return this.http
      .patch<InternAccountRow>(`${this.baseUrl}/api/intern-accounts/${id}/status`, null, { params: p })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Delete — 409 `SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS` while candidates are assigned. */
  deleteInternAccount(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/intern-accounts/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Mobile accounts (ADMIN). Used by the credentials dialog to resend a one-time password. */
  listInternAccounts(search?: string): Observable<InternAccount[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http
      .get<InternAccount[]>(`${this.baseUrl}/api/intern-accounts`, { params })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Reset a mobile account password: new random password returned once, emailed (AGENTS.md §5.4). */
  resetInternAccountPassword(id: string): Observable<ResetAccountPasswordResult> {
    return this.http
      .post<ResetAccountPasswordResult>(`${this.baseUrl}/api/intern-accounts/${id}/reset-password`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  getApplicationWorkflow(applicationId: string): Observable<WorkflowInstanceResponse> {
    return this.http
      .get<WorkflowInstanceResponse>(`${this.baseUrl}/api/applications/${applicationId}/workflow`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  listWorkflowActions(instanceId: string): Observable<WorkflowActionResponse[]> {
    return this.http
      .get<WorkflowActionResponse[]>(`${this.baseUrl}/api/workflows/${instanceId}/actions`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff candidate list. Backend never includes nationalId here
   * (CandidateSummaryResponse) — the type makes CIN leakage impossible.
   */
  listCandidates(): Observable<CandidateSummary[]> {
    return this.http
      .get<CandidateSummary[]>(`${this.baseUrl}/api/candidates`, { context: this.silentContext() })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getCandidate(id: string): Observable<CandidateDetail> {
    return this.http
      .get<CandidateDetail>(`${this.baseUrl}/api/candidates/${id}`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff candidate queue (AGENTS.md §5.1): pagination, search, filters and
   * sort run SERVER-side on `GET /api/candidates/manage` (the literal segment
   * is declared before `/{id}` on the backend). ADMIN sees every candidate,
   * SUPERVISOR only his own — scope is derived server-side and never sent.
   */
  searchCandidates(query: CandidateQueueQuery): Observable<Page<CandidateQueueRow>> {
    let p = new HttpParams()
      .set('page', query.page)
      .set('size', Math.min(query.size, environment.pageSizeMax));
    if (query.sort) p = p.set('sort', query.sort);
    if (query.q) p = p.set('q', query.q);
    if (query.university) p = p.set('university', query.university);
    if (query.type) p = p.set('type', query.type);
    if (query.supervisor) p = p.set('supervisor', query.supervisor);
    if (query.validation) p = p.set('validation', query.validation);
    if (query.status) p = p.set('status', query.status);
    if (query.from) p = p.set('from', query.from);
    if (query.to) p = p.set('to', query.to);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/candidates/manage`, {
        params: p,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<CandidateQueueRow>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** One-call candidate detail aggregate: profile, supervisor, applications,
   * internship, task summary, documents, certificate/receipt (§5.1). */
  getCandidateOverview(id: string): Observable<CandidateOverview> {
    return this.http
      .get<CandidateOverview>(`${this.baseUrl}/api/candidates/${id}/overview`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff creation of a candidate profile (S6a, AGENTS.md §5.1 / §6.2 / A4).
   *
   * Backend rules, not client ones: a CIN is REQUIRED (422
   * `CANDIDATE_NATIONAL_ID_REQUIRED`), a duplicate live CIN is refused (422
   * `CANDIDATE_NATIONAL_ID_DUPLICATE`), a supervisor may only create candidates
   * he manages himself (403) and the manager must hold ADMIN/SUPERVISOR (422
   * `CANDIDATE_MANAGER_INVALID`). The response redacts the CIN for a
   * supervisor, exactly like a supervisor edit.
   */
  createCandidateByStaff(
    body: StaffCandidateCreateBody,
  ): Observable<CandidateDetail> {
    return this.http
      .post<CandidateDetail>(`${this.baseUrl}/api/candidates/manage`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Soft delete — 409 `CANDIDATE_HAS_DEPENDENCIES` while applications,
   * internships, tasks or receipts still reference the candidate. */
  deleteCandidate(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/candidates/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  listUniversities(): Observable<University[]> {
    return this.http
      .get<University[]>(`${this.baseUrl}/api/universities`, { context: this.silentContext() })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Manual intake for walk-in candidates: same InternshipApplication model as
   * online applications via POST /api/public/applications (multipart).
   * Source is read back from `submittedOnline` on the stored record.
   */
  submitManualApplication(
    fields: ManualApplicationFields,
    files: readonly File[],
  ): Observable<ManualApplicationResult> {
    const form = new FormData();
    form.append(
      'application',
      new Blob([JSON.stringify({ ...fields })], { type: 'application/json' }),
    );
    for (const file of files) form.append('documents', file, file.name);
    return this.http
      .post<ManualApplicationResult>(`${this.baseUrl}/api/public/applications`, form)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Authenticated binary download through backend endpoints (blob keeps the JWT header). */
  downloadDocument(documentId: string, restricted: boolean): Observable<Blob> {
    const segment = restricted ? 'download-restricted' : 'download';
    return this.http
      .get(`${this.baseUrl}/api/documents/${documentId}/${segment}`, { responseType: 'blob' })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * AI document intelligence validation (PDF text layer + OCR fallback + keyword & name verification).
   * Validates document type and candidate name against the stored document.
   */
  validateStoredDocumentAi(
    documentId: string,
    body?: { expectedType?: string; fullName?: string },
  ): Observable<DocumentAiValidationResponse> {
    return this.http
      .post<DocumentAiValidationResponse>(
        `${this.baseUrl}/api/documents/${documentId}/validation`,
        body ?? {},
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Phase C3 — internship lifecycle & assignment -------- */

  /** Staff internship list (ADMIN/HR/SUPERVISOR). Backend returns the full array. */
  listInternships(): Observable<InternshipDetail[]> {
    return this.http
      .get<InternshipDetail[]>(`${this.baseUrl}/api/internships`, { context: this.silentContext() })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternship(id: string): Observable<InternshipDetail> {
    return this.http
      .get<InternshipDetail>(`${this.baseUrl}/api/internships/${id}`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Create from an APPROVED application (ADMIN only). Source data copied backend-side. */
  createInternshipFromApplication(
    body: InternshipCreateFromApplicationRequest,
  ): Observable<InternshipDetail> {
    return this.http
      .post<InternshipDetail>(`${this.baseUrl}/api/internships/from-application`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Manual creation where the backend permits it (ADMIN/HR). */
  createManualInternship(body: InternshipCreateManualRequest): Observable<InternshipDetail> {
    return this.http
      .post<InternshipDetail>(`${this.baseUrl}/api/internships/manual`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Date update triggers backend reclassification (ADMIN/HR). */
  updateInternshipDates(
    id: string,
    body: InternshipUpdateDatesRequest,
  ): Observable<InternshipDetail> {
    return this.http
      .put<InternshipDetail>(`${this.baseUrl}/api/internships/${id}/dates`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  cancelInternship(id: string): Observable<InternshipDetail> {
    return this.http
      .post<InternshipDetail>(`${this.baseUrl}/api/internships/${id}/cancel`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Assignment history (ADMIN/HR/SUPERVISOR). */
  listAssignments(internshipId: string): Observable<InternshipAssignment[]> {
    return this.http
      .get<InternshipAssignment[]>(`${this.baseUrl}/api/internships/${internshipId}/assignments`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Assign/reassign (ADMIN/HR). Backend atomically ends the current ACTIVE
   * assignment and activates the new one; the one-active rule is enforced
   * server-side (409 on concurrent reassignment).
   */
  assignInternship(
    internshipId: string,
    body: InternshipAssignmentRequest,
  ): Observable<InternshipAssignment> {
    return this.http
      .post<InternshipAssignment>(
        `${this.baseUrl}/api/internships/${internshipId}/assignments`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Read-only classification transparency view. */
  getClassification(internshipId: string): Observable<InternshipClassification> {
    return this.http
      .get<InternshipClassification>(
        `${this.baseUrl}/api/internships/${internshipId}/classification`,
        { context: this.silentContext() },
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Internship lifecycle transition (AGENTS.md §4) through the single
   * authority: APPROVED → IN_PROGRESS → REPORT_SUBMITTED → UNDER_VALIDATION.
   * VALIDATED and RECEIPT_ISSUED are RESERVED (422) for the S7 validation
   * decision and receipt generation — never send them here.
   */
  transitionInternshipStatus(
    internshipId: string,
    targetStatus: 'IN_PROGRESS' | 'REPORT_SUBMITTED' | 'UNDER_VALIDATION',
    comment?: string,
  ): Observable<InternshipDetail> {
    return this.http
      .post<InternshipDetail>(`${this.baseUrl}/api/internships/${internshipId}/status-transitions`, {
        targetStatus,
        comment: comment?.trim() ? comment.trim() : null,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Certificate generation entry point (ADMIN only). Backend enforces the
   * VALIDATED eligibility gate; no request body — the generation date is
   * captured server-side.
   */
  generateCertificate(internshipId: string): Observable<CertificateInfo> {
    return this.http
      .post<CertificateInfo>(`${this.baseUrl}/api/internships/${internshipId}/certificates`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  downloadCertificate(certificateId: string): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}/api/certificates/${certificateId}`, { responseType: 'blob' })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* ------------------------------------------------------------------ */
  /* S8 certificates workspace (Admin only, AGENTS.md §5.7).              */
  /* ------------------------------------------------------------------ */

  /** Workspace list: one server page (search + status run in the database). */
  searchCertificates(query: CertificateQuery): Observable<Page<CertificateRow>> {
    let p = new HttpParams()
      .set('page', query.page)
      .set('size', Math.min(query.size, environment.pageSizeMax));
    if (query.sort) p = p.set('sort', query.sort);
    if (query.q?.trim()) p = p.set('q', query.q.trim());
    if (query.status) p = p.set('status', query.status);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/certificates`, {
        params: p,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<CertificateRow>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Workspace detail with the append-only version history. */
  getCertificateDetail(certificateId: string): Observable<CertificateDetail> {
    return this.http
      .get<CertificateDetail>(`${this.baseUrl}/api/certificates/${certificateId}/detail`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Edit-and-regenerate: re-issues the PDF as a new version (reference stable). */
  regenerateCertificate(certificateId: string, issueDate?: string): Observable<CertificateDetail> {
    return this.http
      .put<CertificateDetail>(`${this.baseUrl}/api/certificates/${certificateId}`, {
        issueDate: issueDate?.trim() ? issueDate.trim() : null,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Soft delete (REVOKED, row kept for audit). */
  revokeCertificate(certificateId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/certificates/${certificateId}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Download one version of a certificate PDF (null = latest issued). */
  downloadCertificateVersion(certificateId: string, version?: number): Observable<Blob> {
    const suffix =
      version != null
        ? `/versions/${version}/download`
        : '';
    return this.http
      .get(`${this.baseUrl}/api/certificates/${certificateId}${suffix}`, { responseType: 'blob' })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Departments/employees (ADMIN/HR) — reference data for the assign dialog. */
  listDepartments(): Observable<Department[]> {
    return this.http
      .get<Department[]>(`${this.baseUrl}/api/departments`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  listEmployees(): Observable<Employee[]> {
    return this.http
      .get<Employee[]>(`${this.baseUrl}/api/employees`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Phase C4 — internship document workspace -------- */

  /** Documents attached to an internship (ADMIN/HR/CANDIDATE/SUPERVISOR). */
  listInternshipDocuments(internshipId: string): Observable<InternshipDocumentItem[]> {
    return this.http
      .get<InternshipDocumentItem[]>(`${this.baseUrl}/api/internships/${internshipId}/documents`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff upload (any authenticated user; backend validates MIME/size/content
   * and returns metadata including restrictedAccess). Raw bytes never touch
   * application state beyond the upload call.
   */
  uploadDocument(type: DocumentType, file: File): Observable<DocumentFile> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post<DocumentFile>(`${this.baseUrl}/api/documents`, form, {
        params: new HttpParams().set('type', type),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Attach an uploaded document to an internship (ADMIN/HR). */
  attachInternshipDocument(
    internshipId: string,
    body: AttachInternshipDocumentBody,
  ): Observable<InternshipDocumentItem> {
    return this.http
      .post<InternshipDocumentItem>(
        `${this.baseUrl}/api/internships/${internshipId}/documents`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Document metadata without content (for preview decisions). */
  getDocumentMetadata(documentId: string): Observable<DocumentFile> {
    return this.http
      .get<DocumentFile>(`${this.baseUrl}/api/documents/${documentId}`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Phase C5 — finance & payment workspace -------- */

  /**
   * Server-paginated finance queue (FINANCE/ADMIN). Status is the only
   * backend-supported filter; period/department/eligibility refine the
   * loaded page client-side (see finance queue component).
   */
  listFinanceCases(
    status: FinanceCaseStatus | '',
    page: number,
    size: number,
    sort = 'openedAt,desc',
  ): Observable<Page<FinanceCaseQueueItem>> {
    let params = this.pageable(page, size, sort);
    if (status) params = params.set('status', status);
    return this.http.get<unknown>(`${this.baseUrl}/api/finance-cases`, { params }).pipe(
      map((raw) => asPage<FinanceCaseQueueItem>(raw as never)),
      catchError((e) => throwError(() => e)),
    );
  }

  /** Full case with calculation, dossier and approval history (FINANCE/ADMIN). */
  getFinanceCase(id: string): Observable<FinanceCaseDetail> {
    return this.http
      .get<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Recompute the payment snapshot pre-decision (FINANCE/ADMIN, audited). */
  recalculateCase(id: string): Observable<FinanceCaseDetail> {
    return this.http
      .post<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}/recalculate`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Approve payment + issue receipt (FINANCE role only, comment optional). */
  approveCase(id: string, comment?: string): Observable<FinanceCaseDetail> {
    const body: PaymentDecisionBody = comment?.trim() ? { comment: comment.trim() } : {};
    return this.http
      .post<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}/approve`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Reject payment (FINANCE role only, reason mandatory backend-side). */
  rejectCase(id: string, reason: string): Observable<FinanceCaseDetail> {
    return this.http
      .post<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}/reject`, {
        comment: reason.trim(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Receipt PDF download (backend checks FINANCE/ADMIN/HR-or-supervisor). */
  downloadReceipt(caseId: string): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}/api/finance-cases/${caseId}/receipt`, { responseType: 'blob' })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Review one dossier document (FINANCE/ADMIN). */
  reviewFinanceDocument(
    caseId: string,
    documentId: string,
    body: FinanceDocumentReviewBody,
  ): Observable<FinanceCaseDocument> {
    return this.http
      .patch<FinanceCaseDocument>(
        `${this.baseUrl}/api/finance-cases/${caseId}/documents/${documentId}`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Advisory AI report analysis of an application (ADMIN/HR). Narrow objective:
   * STEG-focus relevance of the submitted report — never an accept/reject decision.
   */
  analyzeApplication(applicationId: string): Observable<AiAnalysisResult> {
    return this.http
      .post<AiAnalysisResult>(`${this.baseUrl}/api/ai/applications/${applicationId}/analyze`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Advisory AI analysis of the dossier (ADMIN/FINANCE). CIN content is
   * excluded backend-side; the result only ever proposes recommendations.
   */
  analyzeFinanceCase(caseId: string): Observable<AiAnalysisResult> {
    return this.http
      .post<AiAnalysisResult>(`${this.baseUrl}/api/ai/finance-cases/${caseId}/analyze`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Human traceability review of one AI recommendation (no state change). */
  reviewAiRecommendation(
    recommendationId: string,
    status: 'ACCEPTED_BY_HUMAN' | 'DISMISSED',
  ): Observable<AiRecommendation> {
    return this.http
      .post<AiRecommendation>(`${this.baseUrl}/api/ai/recommendations/${recommendationId}/review`, {
        status,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Phase C6 — administration workspace -------- */

  /** Departments (mutations: ADMIN only, enforced backend-side). */
  createDepartment(body: DepartmentRequest): Observable<Department> {
    return this.http
      .post<Department>(`${this.baseUrl}/api/departments`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  updateDepartment(id: string, body: DepartmentRequest): Observable<Department> {
    return this.http
      .put<Department>(`${this.baseUrl}/api/departments/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Soft-deactivate (backend never hard-deletes). */
  deactivateDepartment(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/departments/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Employees (create/update: ADMIN/HR; deactivate: ADMIN only). */
  createEmployee(body: EmployeeRequest): Observable<Employee> {
    return this.http
      .post<Employee>(`${this.baseUrl}/api/employees`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  updateEmployee(id: string, body: EmployeeRequest): Observable<Employee> {
    return this.http
      .put<Employee>(`${this.baseUrl}/api/employees/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Soft-deactivate (backend never hard-deletes). */
  deactivateEmployee(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/employees/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Audit trail (ADMIN only, read-only, server-paginated). */
  searchAudit(query: AuditQuery): Observable<Page<AuditLogEntry>> {
    let params = this.pageable(query.page, query.size, 'createdAt,desc');
    if (query.action?.trim()) params = params.set('action', query.action.trim());
    if (query.entityType?.trim()) params = params.set('entityType', query.entityType.trim());
    if (query.entityId?.trim()) params = params.set('entityId', query.entityId.trim());
    if (query.actorId?.trim()) params = params.set('actorId', query.actorId.trim());
    if (query.source) params = params.set('source', query.source);
    if (query.from?.trim()) params = params.set('from', query.from.trim());
    if (query.to?.trim()) params = params.set('to', query.to.trim());
    if (query.fromDate?.trim()) params = params.set('fromDate', query.fromDate.trim());
    if (query.toDate?.trim()) params = params.set('toDate', query.toDate.trim());
    return this.http
      .get<unknown>(`${this.baseUrl}/api/audit`, {
        params,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<AuditLogEntry>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  getAuditEntry(id: string): Observable<AuditLogEntry> {
    return this.http
      .get<AuditLogEntry>(`${this.baseUrl}/api/audit/${id}`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Supervision workspace (companion + evaluation) -------- */
  /* Backend enforces participant/supervisor scoping; the client never  */
  /* filters by identity — 403 surfaces as an actionable error.        */

  /** Staff profile correction (ADMIN/HR; backend validates + audits). */
  updateCandidate(id: string, body: CandidateUpdateBody): Observable<CandidateDetail> {
    return this.http
      .put<CandidateDetail>(`${this.baseUrl}/api/candidates/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Tasks of an internship (ADMIN/HR/participant). Paged backend-side. */
  listTasks(internshipId: string, page = 0, size = 50): Observable<Page<CompanionTask>> {
    return this.http
      .get<unknown>(`${this.baseUrl}/api/internships/${internshipId}/tasks`, {
        params: this.pageable(page, size),
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<CompanionTask>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Create a task on an internship (ADMIN/HR/supervisor participant). */
  createTask(internshipId: string, body: TaskRequest): Observable<CompanionTask> {
    return this.http
      .post<CompanionTask>(`${this.baseUrl}/api/internships/${internshipId}/tasks`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * S6c — scoped task list (AGENTS.md §5.5/§6.1). Admin sees every student's
   * tasks; a Supervisor sees only his own candidates' — the backend derives
   * the scope, the client only groups the returned page by student.
   */
  listAllTasks(page = 0, size = 50, status?: TaskStatus): Observable<Page<CompanionTask>> {
    let params = this.pageable(page, size);
    if (status) params = params.set('status', status);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/internships/tasks`, {
        params,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<CompanionTask>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Update a task's details (Admin or assigned Supervisor). */
  updateTask(taskId: string, body: TaskRequest): Observable<CompanionTask> {
    return this.http
      .put<CompanionTask>(`${this.baseUrl}/api/internships/tasks/${taskId}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Approve (no reason) or deny (reason REQUIRED, enforced server-side too). */
  reviewTask(taskId: string, approve: boolean, comment?: string): Observable<CompanionTask> {
    return this.http
      .post<CompanionTask>(`${this.baseUrl}/api/internships/tasks/${taskId}/review`, {
        approve,
        comment: comment?.trim() ? comment.trim() : null,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * S6c — atomic bulk add/edit/delete across multiple students. The backend
   * validates every mutation before writing anything (all-or-nothing) and
   * returns a per-item result summary; sending the same `idempotencyKey` twice
   * replays the stored result instead of duplicating.
   */
  bulkTasks(mutations: BulkTaskMutation[], idempotencyKey: string): Observable<BulkTaskResult> {
    return this.http
      .post<BulkTaskResult>(`${this.baseUrl}/api/internships/tasks/bulk`, mutations, {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Delete one task (Admin or assigned Supervisor; out-of-scope is 404). */
  deleteTask(taskId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/internships/tasks/${taskId}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* ------------------------------------------------------------------ */
  /* S10c — AI task drafts review (AGENTS.md §7.4).                        */
  /* Drafts are server-side proposals, never real tasks until bulk-added. */
  /* Admin: any student. Supervisor: own students only (404 otherwise).   */
  /* ------------------------------------------------------------------ */

  /** Generate drafts from a specifications PDF for one reference student. */
  generateTaskDrafts(file: File, internshipId: string): Observable<TaskDraft[]> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('internshipId', internshipId);
    return this.http
      .post<TaskDraft[]>(`${this.baseUrl}/api/internships/tasks/drafts/generate`, form)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** List my drafts, optionally for one reference internship. */
  listTaskDrafts(internshipId?: string): Observable<TaskDraft[]> {
    let params = new HttpParams();
    if (internshipId) params = params.set('internshipId', internshipId);
    return this.http
      .get<TaskDraft[]>(`${this.baseUrl}/api/internships/tasks/drafts`, {
        params,
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Add one draft manually (works even when AI is unavailable). */
  addDraftManually(body: ManualDraftBody): Observable<TaskDraft> {
    return this.http
      .post<TaskDraft>(`${this.baseUrl}/api/internships/tasks/drafts`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Edit one draft manually (owner only, 404 otherwise). */
  updateDraft(id: string, body: UpdateDraftBody): Observable<TaskDraft> {
    return this.http
      .put<TaskDraft>(`${this.baseUrl}/api/internships/tasks/drafts/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Revise one draft with AI from a free-text instruction (owner only). */
  reviseDraft(id: string, instruction: string): Observable<TaskDraft> {
    return this.http
      .post<TaskDraft>(`${this.baseUrl}/api/internships/tasks/drafts/${id}/revise`, {
        instruction,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Delete one draft (owner only, 404 otherwise). */
  deleteDraft(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/internships/tasks/drafts/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Atomically bulk-add approved drafts to one or more students. The backend
   * validates every draft-student pair before writing anything
   * (all-or-nothing) and returns a per-item result; sending the same
   * idempotency key twice replays the stored result instead of duplicating.
   */
  bulkAddDrafts(body: BulkAddDraftsBody, idempotencyKey: string): Observable<BulkAddDraftsResult> {
    return this.http
      .post<BulkAddDraftsResult>(`${this.baseUrl}/api/internships/tasks/drafts/bulk-add`, body, {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* ------------------------------------------------------------------ */
  /* S10c — back-office chatbot (AGENTS.md §7.5, backend authoritative).  */
  /* ------------------------------------------------------------------ */

  /**
   * Role-scoped chatbot (ADMIN global, SUPERVISOR own scope — server-side).
   * The backend answers from curated knowledge + scoped live-data tools and
   * degrades to a friendly unavailable answer (`degraded: true`) when the
   * model is unreachable. History persists server-side, per user.
   */
  chatbotQuery(message: string): Observable<ChatbotResponse> {
    return this.http
      .post<ChatbotResponse>(`${this.baseUrl}/api/ai/chatbot/query`, {
        message: message.trim(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** My own conversation history (bounded server-side, oldest first). */
  chatbotHistory(): Observable<ChatHistory> {
    return this.http
      .get<ChatHistory>(`${this.baseUrl}/api/ai/chatbot/history`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Clear my own conversation history. */
  clearChatbotHistory(): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/ai/chatbot/history`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* ------------------------------------------------------------------ */
  /* S7 internship validation (Admin only, AGENTS.md §5.11).              */
  /* ------------------------------------------------------------------ */

  /** Validation queue: one server page (scope is Admin-global, server-side). */
  searchValidationQueue(query: ValidationQueueQuery): Observable<Page<ValidationQueueRow>> {
    let p = new HttpParams()
      .set('page', query.page)
      .set('size', Math.min(query.size, environment.pageSizeMax));
    if (query.sort) p = p.set('sort', query.sort);
    if (query.q?.trim()) p = p.set('q', query.q.trim());
    for (const s of query.statuses ?? []) p = p.append('statuses', s);
    if (query.supervisorUserId) p = p.set('supervisorUserId', query.supervisorUserId);
    if (query.universityId) p = p.set('universityId', query.universityId);
    if (query.type) p = p.set('type', query.type);
    return this.http
      .get<unknown>(`${this.baseUrl}/api/internship-validation/queue`, {
        params: p,
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<ValidationQueueRow>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Validation detail aggregate in one call (candidate, tasks, docs, runs, decisions, receipt). */
  getValidationDetail(internshipId: string): Observable<ValidationDetail> {
    return this.http
      .get<ValidationDetail>(`${this.baseUrl}/api/internship-validation/${internshipId}`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Run advisory AI verification on one document (never moves a status). */
  runVerification(internshipId: string, documentType: ValidationDocumentType): Observable<VerificationResult> {
    return this.http
      .post<VerificationResult>(`${this.baseUrl}/api/internship-validation/${internshipId}/verify`, {
        documentType,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Mandatory manual decision per document (REJECTED needs a comment, server-side too). */
  recordDecision(
    internshipId: string,
    documentType: ValidationDocumentType,
    decision: ValidationDecision,
    comment?: string,
  ): Observable<ValidationDetail> {
    return this.http
      .post<ValidationDetail>(`${this.baseUrl}/api/internship-validation/${internshipId}/decisions`, {
        documentType,
        decision,
        comment: comment?.trim() ? comment.trim() : null,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Generate the payment receipt PDF (idempotent; moves to RECEIPT_ISSUED). */
  generateReceipt(internshipId: string): Observable<ValidationReceipt> {
    return this.http
      .post<ValidationReceipt>(`${this.baseUrl}/api/internship-validation/${internshipId}/receipt`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Download a validation document (report/journal PDF) as a blob. */
  downloadValidationDocument(internshipId: string, documentType: ValidationDocumentType): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}/api/internship-validation/${internshipId}/documents/${documentType}/download`, {
        responseType: 'blob',
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Move a task to a new status (ADMIN/HR/participant). */
  updateTaskStatus(taskId: string, status: TaskStatus): Observable<CompanionTask> {
    return this.http
      .patch<CompanionTask>(`${this.baseUrl}/api/internships/tasks/${taskId}/status`, null, {
        params: new HttpParams().set('status', status),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Journal entries submitted from the Flutter app (ADMIN/HR/participant). */
  listJournalEntries(internshipId: string, page = 0, size = 50): Observable<Page<JournalEntry>> {
    return this.http
      .get<unknown>(`${this.baseUrl}/api/internships/${internshipId}/journal/entries`, {
        params: this.pageable(page, size, 'entryDate,desc'),
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<JournalEntry>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Supervisor journal review (ADMIN/HR/supervisor; comment optional). */
  validateJournalEntry(entryId: string, comment?: string): Observable<JournalEntry> {
    const body: JournalValidationBody = comment?.trim() ? { comment: comment.trim() } : {};
    return this.http
      .post<JournalEntry>(
        `${this.baseUrl}/api/internships/journal/entries/${entryId}/validate`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Reject a journal entry (ADMIN/HR/supervisor; reason mandatory UX-side). */
  rejectJournalEntry(entryId: string, comment: string): Observable<JournalEntry> {
    return this.http
      .post<JournalEntry>(`${this.baseUrl}/api/internships/journal/entries/${entryId}/reject`, {
        comment: comment.trim(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Report deliverables of an internship (ADMIN/HR/participant). */
  listDeliverables(internshipId: string, page = 0, size = 20): Observable<Page<DeliverableItem>> {
    return this.http
      .get<unknown>(`${this.baseUrl}/api/internships/${internshipId}/deliverables`, {
        params: this.pageable(page, size),
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<DeliverableItem>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Validate a deliverable (ADMIN/HR/supervisor). */
  validateDeliverable(deliverableId: string, comment?: string): Observable<DeliverableItem> {
    const body: JournalValidationBody = comment?.trim() ? { comment: comment.trim() } : {};
    return this.http
      .post<DeliverableItem>(
        `${this.baseUrl}/api/internships/deliverables/${deliverableId}/validate`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Reject a deliverable (ADMIN/HR/supervisor; reason mandatory UX-side). */
  rejectDeliverable(deliverableId: string, comment: string): Observable<DeliverableItem> {
    return this.http
      .post<DeliverableItem>(
        `${this.baseUrl}/api/internships/deliverables/${deliverableId}/reject`,
        {
          comment: comment.trim(),
        },
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Authenticated deliverable file download (blob keeps the JWT header). */
  downloadDeliverable(deliverableId: string): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}/api/internships/deliverables/${deliverableId}/download`, {
        responseType: 'blob',
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Evaluations of an internship (ADMIN/HR/participant). */
  listEvaluations(internshipId: string, page = 0, size = 20): Observable<Page<EvaluationItem>> {
    return this.http
      .get<unknown>(`${this.baseUrl}/api/internships/${internshipId}/evaluations`, {
        params: this.pageable(page, size),
        context: this.silentContext(),
      })
      .pipe(
        map((raw) => asPage<EvaluationItem>(raw as never)),
        catchError((e) => throwError(() => e)),
      );
  }

  /** Submit an evaluation (ADMIN/HR/supervisor; totalScore computed server-side). */
  createEvaluation(internshipId: string, body: EvaluationCreateBody): Observable<EvaluationItem> {
    return this.http
      .post<EvaluationItem>(`${this.baseUrl}/api/internships/${internshipId}/evaluations`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Scores of one evaluation (ADMIN/HR/participant). */
  listEvaluationScores(evaluationId: string): Observable<EvaluationScoreItem[]> {
    return this.http
      .get<EvaluationScoreItem[]>(`${this.baseUrl}/api/evaluations/${evaluationId}/scores`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Evaluation templates with criteria (ADMIN/HR/supervisor). */
  listEvaluationTemplates(): Observable<EvaluationTemplateItem[]> {
    return this.http
      .get<EvaluationTemplateItem[]>(`${this.baseUrl}/api/evaluation-templates`, {
        context: this.silentContext(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }
}
