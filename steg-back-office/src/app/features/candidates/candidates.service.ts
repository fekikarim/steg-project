import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  CandidateOverview,
  CandidateQueueQuery,
  CandidateQueueRow,
  CandidateUpdateBody,
  CandidateDetail,
  StaffCandidateCreateBody,
  Page,
  SupervisorOption,
  University,
} from '../../core/api-models';

/**
 * Facade over ApiClient for the candidates workspace (AGENTS.md §5.1 / §6.2).
 *
 * No business rule lives here: scoping (Admin all, Supervisor own), filters,
 * sort and paging are all enforced backend-side on
 * `GET /api/candidates/manage`; the detail aggregate arrives in ONE call
 * (`/overview`); the delete guard is the backend 409
 * `CANDIDATE_HAS_DEPENDENCIES`. This class only shapes transport.
 */
@Injectable({ providedIn: 'root' })
export class CandidatesService {
  private readonly api = inject(ApiClient);

  /** Paged, searchable, filterable candidate list — one server page at a time. */
  search(query: CandidateQueueQuery): Observable<Page<CandidateQueueRow>> {
    return this.api.searchCandidates(query);
  }

  /** §5.1 detail aggregate: profile + supervisor + applications + internship +
   * tasks summary + documents + certificate/receipt in one backend call. */
  overview(id: string): Observable<CandidateOverview> {
    return this.api.getCandidateOverview(id);
  }

  /** Staff profile correction (CIN optional: blank keeps the stored value). */
  update(id: string, body: CandidateUpdateBody): Observable<CandidateDetail> {
    return this.api.updateCandidate(id, body);
  }

  /**
   * Staff creation of a profile on behalf of somebody (S6a). No rule lives
   * here: the backend requires the CIN, refuses a duplicate CIN, scopes the
   * manager (Admin may choose, Supervisor gets himself) and returns the profile
   * with `userId` null until the owner claims it by registering.
   */
  create(body: StaffCandidateCreateBody): Observable<CandidateDetail> {
    return this.api.createCandidateByStaff(body);
  }

  /** Soft delete; a 409 dependency conflict surfaces to the caller unchanged. */
  remove(id: string): Observable<void> {
    return this.api.deleteCandidate(id);
  }

  /** Active universities feeding the university filter (public reference data). */
  universities(): Observable<University[]> {
    return this.api.listUniversities();
  }

  /** Supervisor directory feeding the supervisor filter (Admin surfaces). */
  supervisors(): Observable<SupervisorOption[]> {
    return this.api.listSupervisors();
  }

  /**
   * Backend error CODE of a failed staff creation, when present. The form maps
   * it to an actionable message (`CANDIDATE_NATIONAL_ID_DUPLICATE` =
   * "this CIN already belongs to a profile", ...).
   */
  static codeOf(error: unknown): string | null {
    const envelope = (error as { error?: { error?: string } } | null)?.error;
    return envelope?.error ?? null;
  }

  /** True when the failure is the backend delete guard, not a transport error. */
  static isDependencyConflict(error: unknown): boolean {
    const envelope = (error as { error?: { error?: string } } | null)?.error;
    const status = (error as { status?: number } | null)?.status;
    return status === 409 && envelope?.error === 'CANDIDATE_HAS_DEPENDENCIES';
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
