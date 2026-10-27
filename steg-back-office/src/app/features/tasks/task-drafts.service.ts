import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  BulkAddDraftsBody,
  BulkAddDraftsResult,
  InternshipDetail,
  ManualDraftBody,
  TaskDraft,
  UpdateDraftBody,
} from '../../core/api-models';

/**
 * Facade over ApiClient for the AI task-draft review workspace
 * (AGENTS.md §7.4 — S10c UI over the S10a backend).
 *
 * No business rule lives here: the Admin may use any student while a
 * Supervisor is limited to his own (404 otherwise), drafts validate
 * server-side (schema, lengths, dates in period), and bulk-add is atomic
 * with per-item results — all enforced by the backend. This class only
 * shapes transport, including the idempotency key the bulk-add endpoint
 * needs for a safe double submit, and reads backend error envelopes.
 *
 * Student pickers are fed from `GET /api/internships` (scoped server-side:
 * Admin sees all, Supervisor only his assigned) — the client never filters
 * across scope, so a supervisor's picker shows only his own students.
 */
@Injectable({ providedIn: 'root' })
export class TaskDraftsService {
  private readonly api = inject(ApiClient);

  /** Students for every picker: the backend scopes this list by role. */
  students(): Observable<InternshipDetail[]> {
    return this.api.listInternships();
  }

  /** Generate drafts from a specifications PDF for one reference student. */
  generate(file: File, internshipId: string): Observable<TaskDraft[]> {
    return this.api.generateTaskDrafts(file, internshipId);
  }

  /** List my drafts, optionally for one reference internship. */
  list(internshipId?: string): Observable<TaskDraft[]> {
    return this.api.listTaskDrafts(internshipId);
  }

  /** Add one draft manually (works even when AI is unavailable). */
  add(body: ManualDraftBody): Observable<TaskDraft> {
    return this.api.addDraftManually(body);
  }

  /** Edit one draft manually (owner only, 404 otherwise). */
  edit(id: string, body: UpdateDraftBody): Observable<TaskDraft> {
    return this.api.updateDraft(id, body);
  }

  /** Revise one draft with AI from a free-text instruction (owner only). */
  revise(id: string, instruction: string): Observable<TaskDraft> {
    return this.api.reviseDraft(id, instruction);
  }

  /** Delete one draft (confirmation is the caller's job). */
  remove(id: string): Observable<void> {
    return this.api.deleteDraft(id);
  }

  /**
   * Atomically bulk-add approved drafts to one or more students. One
   * idempotency key per logical operation: generating it when the dialog
   * opens (not on every click) makes a double submit replay instead of
   * duplicating.
   */
  bulkAdd(body: BulkAddDraftsBody, idempotencyKey: string): Observable<BulkAddDraftsResult> {
    return this.api.bulkAddDrafts(body, idempotencyKey);
  }

  /** Fresh idempotency key for one bulk-add operation. */
  static newIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `draft-bulk-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }

  /** Backend error CODE of a failed draft call, when present. */
  static codeOf(error: unknown): string | null {
    const envelope = (error as { error?: { error?: string } } | null)?.error;
    return envelope?.error ?? null;
  }

  /** Backend error envelope message, when present. */
  static messageOf(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null) {
      const envelope = (error as { error?: { message?: string } }).error;
      if (envelope?.message) return envelope.message;
    }
    return fallback;
  }

  /** True when the backend reports the AI service as unavailable. */
  static isUnavailable(error: unknown): boolean {
    return TaskDraftsService.codeOf(error) === 'AI_UNAVAILABLE';
  }
}
