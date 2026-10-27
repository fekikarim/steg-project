import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, map, catchError, switchMap } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  InternshipDetail,
  InternshipClassification,
  InternshipAssignment,
  InternshipAssignmentRequest,
  InternshipCreateFromApplicationRequest,
  InternshipCreateManualRequest,
  InternshipUpdateDatesRequest,
  InternshipDocumentItem,
  DocumentType,
  CandidateDetail,
  CertificateInfo,
  Department,
  Employee,
  CompanionTask,
  JournalEntry,
  DeliverableItem,
  EvaluationItem,
  EvaluationCreateBody,
  TaskStatus,
} from '../../core/api-models';

export interface InternshipBundle {
  readonly internship: InternshipDetail;
  readonly candidate: CandidateDetail | null;
  readonly classification: InternshipClassification | null;
  readonly assignments: readonly InternshipAssignment[];
  readonly documents: readonly InternshipDocumentItem[];
  readonly tasks: readonly CompanionTask[];
  readonly journal: readonly JournalEntry[];
  readonly deliverables: readonly DeliverableItem[];
  readonly evaluations: readonly EvaluationItem[];
}

/** The currently effective assignment, if any. */
export function activeAssignment(
  assignments: readonly InternshipAssignment[],
): InternshipAssignment | null {
  return assignments.find((a) => a.status === 'ACTIVE') ?? null;
}

/**
 * Facade over ApiClient for the internship workspace. No business rules here —
 * classification, eligibility, the one-active-assignment rule and transition
 * legality stay backend-side. HTTP 403/409 surface as clean, actionable errors.
 */
@Injectable({ providedIn: 'root' })
export class InternshipService {
  private readonly api = inject(ApiClient);

  loadBundle(internshipId: string): Observable<InternshipBundle> {
    // S12b (#33): the internship workflow engine was deleted backend-side
    // (S6b) — no workflow instance is ever spawned, so no workflow history is
    // fetched. Per-document validation state lives in the S7 validation
    // workspace (`/validation/:id`), linked from the detail tab.
    return this.api.getInternship(internshipId).pipe(
      switchMap((internship) =>
        forkJoin({
          candidate: this.api.getCandidate(internship.candidateId).pipe(catchError(() => of(null))),
          classification: this.api.getClassification(internshipId).pipe(catchError(() => of(null))),
          assignments: this.api.listAssignments(internshipId).pipe(catchError(() => of([]))),
          documents: this.api.listInternshipDocuments(internshipId).pipe(catchError(() => of([]))),
          tasks: this.api.listTasks(internshipId).pipe(
            map((page) => page.content),
            catchError(() => of([] as readonly CompanionTask[])),
          ),
          journal: this.api.listJournalEntries(internshipId).pipe(
            map((page) => page.content),
            catchError(() => of([] as readonly JournalEntry[])),
          ),
          deliverables: this.api.listDeliverables(internshipId).pipe(
            map((page) => page.content),
            catchError(() => of([] as readonly DeliverableItem[])),
          ),
          evaluations: this.api.listEvaluations(internshipId).pipe(
            map((page) => page.content),
            catchError(() => of([] as readonly EvaluationItem[])),
          ),
        }).pipe(
          map(
            ({
              candidate,
              classification,
              assignments,
              documents,
              tasks,
              journal,
              deliverables,
              evaluations,
            }): InternshipBundle => ({
              internship,
              candidate,
              classification,
              assignments,
              documents,
              tasks,
              journal,
              deliverables,
              evaluations,
            }),
          ),
        ),
      ),
    );
  }

  /**
   * Current assignments for many internships (list-page join). Failures are
   * isolated per internship so one denied row never breaks the whole list.
   */
  loadAssignmentMap(ids: readonly string[]): Observable<Map<string, InternshipAssignment[]>> {
    if (ids.length === 0) return of(new Map());
    const entries = ids.map((id) =>
      this.api.listAssignments(id).pipe(
        map((rows): [string, InternshipAssignment[]] => [id, rows]),
        catchError((): Observable<[string, InternshipAssignment[]]> => of([id, []])),
      ),
    );
    return forkJoin(entries).pipe(map((pairs) => new Map(pairs)));
  }

  createFromApplication(
    body: InternshipCreateFromApplicationRequest,
  ): Observable<InternshipDetail> {
    return this.api.createInternshipFromApplication(body);
  }

  createManual(body: InternshipCreateManualRequest): Observable<InternshipDetail> {
    return this.api.createManualInternship(body);
  }

  updateDates(id: string, body: InternshipUpdateDatesRequest): Observable<InternshipDetail> {
    return this.api.updateInternshipDates(id, body);
  }

  cancel(id: string): Observable<InternshipDetail> {
    return this.api.cancelInternship(id);
  }

  /** APPROVED → IN_PROGRESS through the single authority (§4). */
  activate(id: string): Observable<InternshipDetail> {
    return this.api.transitionInternshipStatus(id, 'IN_PROGRESS', 'Started from the back office');
  }

  /**
   * IN_PROGRESS → REPORT_SUBMITTED through the single authority (§4 + S7a.1).
   * The work phase ends when the report is submitted; validation itself lives
   * in the dedicated validation workspace (no VALIDATED/RECEIPT_ISSUED here —
   * the backend refuses them with 422).
   */
  complete(id: string): Observable<InternshipDetail> {
    return this.api.transitionInternshipStatus(
      id,
      'REPORT_SUBMITTED',
      'Report submitted from the back office',
    );
  }

  /** Task status change (supervisor review of intern progress). */
  setTaskStatus(taskId: string, status: TaskStatus): Observable<CompanionTask> {
    return this.api.updateTaskStatus(taskId, status);
  }

  /** Create a task on an internship (ADMIN/HR/supervisor participant). */
  createTask(
    internshipId: string,
    title: string,
    dueDate: string | null,
  ): Observable<CompanionTask> {
    return this.api.createTask(internshipId, {
      title,
      ...(dueDate ? { dueDate } : {}),
    });
  }

  /** Download a deliverable file (latest version). */
  downloadDeliverable(deliverableId: string): Observable<Blob> {
    return this.api.downloadDeliverable(deliverableId);
  }

  /** Supervisor journal review. */
  validateJournal(entryId: string, comment?: string): Observable<JournalEntry> {
    return this.api.validateJournalEntry(entryId, comment);
  }

  /** Supervisor journal rejection (reason mandatory). */
  rejectJournal(entryId: string, comment: string): Observable<JournalEntry> {
    return this.api.rejectJournalEntry(entryId, comment);
  }

  /** Supervisor deliverable review. */
  validateDeliverable(deliverableId: string, comment?: string): Observable<DeliverableItem> {
    return this.api.validateDeliverable(deliverableId, comment);
  }

  /** Supervisor deliverable rejection (reason mandatory). */
  rejectDeliverable(deliverableId: string, comment: string): Observable<DeliverableItem> {
    return this.api.rejectDeliverable(deliverableId, comment);
  }

  /** Supervisor final review (type FINAL recommended for completion). */
  submitEvaluation(internshipId: string, body: EvaluationCreateBody): Observable<EvaluationItem> {
    return this.api.createEvaluation(internshipId, body);
  }

  assign(id: string, body: InternshipAssignmentRequest): Observable<InternshipAssignment> {
    return this.api.assignInternship(id, body);
  }

  referenceData(): Observable<{ departments: Department[]; employees: Employee[] }> {
    return forkJoin({
      departments: this.api.listDepartments().pipe(catchError(() => of([]))),
      employees: this.api.listEmployees().pipe(catchError(() => of([]))),
    });
  }

  generateCertificate(id: string): Observable<CertificateInfo> {
    return this.api.generateCertificate(id);
  }

  downloadCertificate(certificateId: string): Observable<Blob> {
    return this.api.downloadCertificate(certificateId);
  }

  /**
   * Staff upload-then-attach (ADMIN only for the attach step). The upload
   * returns backend-validated metadata; the attach links it to the internship.
   */
  uploadThenAttach(
    internshipId: string,
    type: DocumentType,
    file: File,
    mandatory: boolean,
  ): Observable<InternshipDocumentItem> {
    return this.api.uploadDocument(type, file).pipe(
      switchMap((meta) =>
        this.api.attachInternshipDocument(internshipId, {
          documentId: meta.id,
          mandatory,
        }),
      ),
    );
  }

  downloadDocument(documentId: string, restricted: boolean): Observable<Blob> {
    return this.api.downloadDocument(documentId, restricted);
  }
}

export function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 403
  );
}
