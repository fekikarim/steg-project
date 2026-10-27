import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  CreateInternAccountBody,
  InternAccountQueueQuery,
  InternAccountRow,
  Page,
  ResetAccountPasswordResult,
  UpdateInternAccountBody,
} from '../../core/api-models';

/**
 * Facade over ApiClient for the 'STEG intern' accounts workspace (AGENTS.md §5.4).
 *
 * No business rule lives here: role allow-list, one-time secret generation,
 * the forced password change and the "reassign before delete" guard are all
 * enforced backend-side. This class only shapes transport. Supervisor accounts
 * are the SAME user rows as §5.6 — one identity, two screens.
 */
@Injectable({ providedIn: 'root' })
export class InternAccountsService {
  private readonly api = inject(ApiClient);

  /** Paged, searchable, filterable account list — one server page at a time. */
  search(query: InternAccountQueueQuery): Observable<Page<InternAccountRow>> {
    return this.api.searchInternAccounts(query);
  }

  /** Create an account; the one-time password is returned once and never stored. */
  create(
    email: string,
    role: CreateInternAccountBody['role'],
  ): Observable<ResetAccountPasswordResult> {
    const body: CreateInternAccountBody = { email: email.trim(), role };
    return this.api.createInternAccount(body);
  }

  /** Status / enabled update; absent fields are left untouched by the backend. */
  update(id: string, body: UpdateInternAccountBody): Observable<InternAccountRow> {
    return this.api.updateInternAccount(id, body);
  }

  /** New random secret, shown once and emailed (§5.3 shared dialog). */
  resetPassword(id: string): Observable<ResetAccountPasswordResult> {
    return this.api.resetInternAccountPassword(id);
  }

  activate(id: string): Observable<InternAccountRow> {
    return this.api.setInternAccountStatus(id, { status: 'ACTIVE', enabled: true });
  }

  deactivate(id: string): Observable<InternAccountRow> {
    return this.api.setInternAccountStatus(id, { enabled: false });
  }

  /** 409 `SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS` surfaces to the caller unchanged. */
  remove(id: string): Observable<void> {
    return this.api.deleteInternAccount(id);
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
