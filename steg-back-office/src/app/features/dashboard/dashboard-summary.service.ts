import { Injectable, inject } from '@angular/core';
import { Observable, of, map, catchError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type { AdminDashboardSummary, SupervisorDashboardSummary } from '../../core/api-models';

export type SummaryState = 'ok' | 'unavailable' | 'error';

export interface Summary<T> {
  readonly state: SummaryState;
  /** Backend summary; null when unavailable (403) or failed. Never client-invented. */
  readonly data: T | null;
  /** Reporting endpoint this summary traces to (auditability per dashboard). */
  readonly source: string;
  readonly loadedAt: string | null;
}

function ok<T>(data: T, source: string): Summary<T> {
  return { state: 'ok', data, source, loadedAt: new Date().toISOString() };
}

function unavailable<T>(source: string): Summary<T> {
  return { state: 'unavailable', data: null, source, loadedAt: null };
}

function failed<T>(source: string): Summary<T> {
  return { state: 'error', data: null, source, loadedAt: null };
}

function isForbidden(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const status =
      (error as { status?: number }).status ??
      (error as { error?: { status?: number } }).error?.status;
    return status === 403 || status === 401;
  }
  return false;
}

/**
 * S11 dashboard orchestration (AGENTS.md §8.3). Each dashboard renders ONE
 * scoped backend summary call — the client never computes numbers from paged
 * lists. 403 → `unavailable` (role-scoped, honest); other failures → `error`.
 */
@Injectable({ providedIn: 'root' })
export class DashboardSummaryService {
  private readonly api = inject(ApiClient);

  /** Admin dashboard: one global summary call. */
  admin(): Observable<Summary<AdminDashboardSummary>> {
    const source = 'GET /api/reports/admin-summary';
    return this.api.getAdminSummary().pipe(
      map((data) => ok(data, source)),
      catchError((e: unknown) =>
        of(
          isForbidden(e)
            ? unavailable<AdminDashboardSummary>(source)
            : failed<AdminDashboardSummary>(source),
        ),
      ),
    );
  }

  /** Supervisor dashboard: one own-scope summary call. */
  supervisor(): Observable<Summary<SupervisorDashboardSummary>> {
    const source = 'GET /api/reports/supervisor-summary';
    return this.api.getSupervisorSummary().pipe(
      map((data) => ok(data, source)),
      catchError((e: unknown) =>
        of(
          isForbidden(e)
            ? unavailable<SupervisorDashboardSummary>(source)
            : failed<SupervisorDashboardSummary>(source),
        ),
      ),
    );
  }
}
