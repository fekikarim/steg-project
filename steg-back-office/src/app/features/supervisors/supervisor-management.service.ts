import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  AssignCandidateBody,
  CreateSupervisorBody,
  InternshipDetail,
  InternshipStatus,
  Page,
  ReassignSupervisorBody,
  ResetAccountPasswordResult,
  SupervisorOption,
  SupervisorQueueQuery,
  SupervisorRow,
  UpdateSupervisorBody,
} from '../../core/api-models';

/** Internship statuses the backend refuses to (re)assign (§5.6). */
const NOT_ASSIGNABLE: readonly InternshipStatus[] = ['CANCELLED', 'ARCHIVED'];

/**
 * Facade over ApiClient for the Supervisor Management workspace (AGENTS.md §5.6).
 *
 * No business rule lives here: "approved candidate only", "no cancelled
 * internship", "cannot delete an assigned supervisor" and "Admin may supervise"
 * are enforced backend-side. This class only shapes transport and filters the
 * assignable internships for the picker so the Admin is not offered rows the
 * backend would reject.
 */
@Injectable({ providedIn: 'root' })
export class SupervisorManagementService {
  private readonly api = inject(ApiClient);

  /** Paged, searchable supervisor list — one server page at a time. */
  search(query: SupervisorQueueQuery): Observable<Page<SupervisorRow>> {
    return this.api.searchSupervisors(query);
  }

  /**
   * Assignable internships for the pickers: cancelled/archived ones are left
   * out so the Admin sees exactly what the backend would accept. The
   * approved-application rule itself stays backend-side.
   */
  assignableInternships(): Observable<readonly InternshipDetail[]> {
    return this.api
      .listInternships()
      .pipe(
        map((rows) =>
          rows
            .filter((i) => !NOT_ASSIGNABLE.includes(i.status))
            .sort((a, b) => a.reference.localeCompare(b.reference)),
        ),
      );
  }

  /** Selectable supervisors for reassignment (Admin + Supervisors, §3.2). */
  directory(): Observable<SupervisorOption[]> {
    return this.api.listSupervisors();
  }

  /** Create an account; the one-time password is returned once and never stored. */
  create(email: string): Observable<ResetAccountPasswordResult> {
    const body: CreateSupervisorBody = { email: email.trim() };
    return this.api.createSupervisor(body);
  }

  update(
    id: string,
    body: { readonly status?: UpdateSupervisorBody['status']; readonly enabled?: boolean },
  ): Observable<SupervisorRow> {
    return this.api.updateSupervisor(id, body);
  }

  /** 409 `SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS` surfaces to the caller unchanged. */
  remove(id: string): Observable<void> {
    return this.api.deleteSupervisor(id);
  }

  assign(
    supervisorId: string,
    internshipId: string,
    departmentId: string | null = null,
  ): Observable<void> {
    const body: AssignCandidateBody = { internshipId, departmentId };
    return this.api.assignCandidateToSupervisor(supervisorId, body);
  }

  /** `newSupervisorUserId` may be the acting Admin (§3.2 Admin is a supervisor). */
  reassign(
    newSupervisorUserId: string,
    internshipId: string,
    reason: string | null = null,
  ): Observable<void> {
    const body: ReassignSupervisorBody = { newSupervisorUserId, reason: reason?.trim() || null };
    return this.api.reassignSupervisor(newSupervisorUserId, internshipId, body);
  }

  /** True when the failure is the backend delete guard rather than a transport error. */
  static isActiveAssignmentsConflict(error: unknown): boolean {
    const envelope = (error as { error?: { errorCode?: string } } | null)?.error;
    const status = (error as { status?: number } | null)?.status;
    return status === 409 && envelope?.errorCode === 'SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS';
  }

  /** Backend error envelope message, when present. */
  static messageOf(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null) {
      const envelope = (error as { error?: { message?: string } }).error;
      if (envelope?.message) return envelope.message;
    }
    return fallback;
  }
}
