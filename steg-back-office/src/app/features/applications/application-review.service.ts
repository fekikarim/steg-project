import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, map, catchError, switchMap, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  ApplicationApprovalResult,
  ApplicationDetail,
  ApplicationDocumentItem,
  CandidateDetail,
  DocumentVerificationBody,
  DocumentAiValidationResponse,
  SupervisorOption,
  WorkflowActionResponse,
  WorkflowInstanceResponse,
} from '../../core/api-models';

export interface DossierBundle {
  readonly application: ApplicationDetail;
  readonly candidate: CandidateDetail | null;
  readonly documents: readonly ApplicationDocumentItem[];
  readonly workflow: WorkflowInstanceResponse | null;
  readonly actions: readonly WorkflowActionResponse[];
  /** True when the workflow history endpoint denied access (staff scope). */
  readonly actionsRestricted: boolean;
}

/**
 * Facade over ApiClient for the review workspace. No business rules here —
 * transition legality, classification and payment eligibility stay backend-side.
 * HTTP 403 from any mutation surfaces as a clean, actionable error.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationReviewService {
  private readonly api = inject(ApiClient);

  loadDossier(applicationId: string): Observable<DossierBundle> {
    return this.api.getApplication(applicationId).pipe(
      switchMap((application) =>
        forkJoin({
          candidate: this.api
            .getCandidate(application.candidateId)
            .pipe(catchError(() => of(null))),
          documents: this.api.getApplicationDocuments(applicationId).pipe(catchError(() => of([]))),
          workflow: this.api.getApplicationWorkflow(applicationId).pipe(catchError(() => of(null))),
        }).pipe(
          switchMap(({ candidate, documents, workflow }) => {
            if (!workflow) {
              return of({
                application,
                candidate,
                documents,
                workflow,
                actions: [],
                actionsRestricted: false,
              });
            }
            return this.api.listWorkflowActions(workflow.id).pipe(
              map((actions): DossierBundle => ({
                application,
                candidate,
                documents,
                workflow,
                actions,
                actionsRestricted: false,
              })),
              catchError((error: unknown) => {
                if (isForbidden(error)) {
                  return of({
                    application,
                    candidate,
                    documents,
                    workflow,
                    actions: [],
                    actionsRestricted: true,
                  });
                }
                return throwError(() => error);
              }),
            );
          }),
        ),
      ),
    );
  }

  /** SUBMITTED/RESUBMITTED → UNDER_REVIEW (optional two-step review). */
  beginReview(applicationId: string): Observable<WorkflowActionResponse> {
    return this.api.executeApplicationTransition(applicationId, {
      actionType: 'VALIDATION',
      targetStepCode: 'UNDER_REVIEW',
    });
  }

  /** Selectable supervisors for the approval dialog (Admin + Supervisors). */
  listSupervisors(): Observable<SupervisorOption[]> {
    return this.api.listSupervisors();
  }

  /**
   * SUBMITTED | RESUBMITTED | UNDER_REVIEW → APPROVED, atomically:
   * one backend transaction creates/updates the internship, assigns the
   * supervisor (defaults to the acting Admin) and provisions the mobile
   * account when the §5.3 policy applies. The one-time credential is in the
   * result and is never re-fetched.
   */
  approve(
    applicationId: string,
    supervisorUserId: string | null,
    departmentId: string,
  ): Observable<ApplicationApprovalResult> {
    return this.api.approveApplication(applicationId, { supervisorUserId, departmentId });
  }

  /** SUBMITTED | RESUBMITTED | UNDER_REVIEW → REJECTED. Trimmed comment = rejectionReason. */
  reject(applicationId: string, reason: string): Observable<WorkflowActionResponse> {
    return this.api.executeApplicationTransition(applicationId, {
      actionType: 'APPROVAL',
      targetStepCode: 'FINAL_DECISION',
      decision: 'REJECTED',
      comment: reason.trim(),
    });
  }

  /** Any reviewable status → MODIFICATION_REQUESTED. Backend stores a trimmed comment. */
  requestCorrection(applicationId: string, comment: string): Observable<WorkflowActionResponse> {
    return this.api.executeApplicationTransition(applicationId, {
      actionType: 'APPROVAL',
      targetStepCode: 'FINAL_DECISION',
      decision: 'MODIFICATION_REQUESTED',
      comment: comment.trim(),
    });
  }

  verifyDocument(
    applicationId: string,
    documentId: string,
    body: DocumentVerificationBody,
  ): Observable<ApplicationDocumentItem> {
    return this.api.verifyApplicationDocument(applicationId, documentId, body);
  }

  downloadDocument(documentId: string, restricted: boolean): Observable<Blob> {
    return this.api.downloadDocument(documentId, restricted);
  }

  validateStoredDocumentAi(
    documentId: string,
    expectedType?: string,
    fullName?: string,
  ): Observable<DocumentAiValidationResponse> {
    return this.api.validateStoredDocumentAi(documentId, { expectedType, fullName });
  }
}

function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 403
  );
}
