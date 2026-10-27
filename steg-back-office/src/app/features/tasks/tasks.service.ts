import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  BulkTaskMutation,
  BulkTaskResult,
  CompanionTask,
  Page,
  TaskRequest,
  TaskStatus,
} from '../../core/api-models';

/**
 * Facade over ApiClient for the student-grouped tasks workspace
 * (AGENTS.md §5.5 for the Admin, §6.1 for the Supervisor — same screen).
 *
 * No business rule lives here: the Admin sees every student, a Supervisor
 * sees only his own candidates — both derived SERVER-side on
 * `GET /api/internships/tasks`; approve/deny (deny needs a reason), bulk
 * atomicity/idempotency and the 404-out-of-scope rule all live in the backend.
 * This class only shapes transport, including the idempotency key the bulk
 * endpoint needs for a safe double submit.
 */
@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly api = inject(ApiClient);

  /** Scoped task page — the component groups it by student for display. */
  list(page = 0, size = 50, status?: TaskStatus): Observable<Page<CompanionTask>> {
    return this.api.listAllTasks(page, size, status);
  }

  /** Add one task to one student's internship. */
  add(internshipId: string, body: TaskRequest): Observable<CompanionTask> {
    return this.api.createTask(internshipId, body);
  }

  /** Edit one task's details. */
  edit(taskId: string, body: TaskRequest): Observable<CompanionTask> {
    return this.api.updateTask(taskId, body);
  }

  /** Delete one task (confirmation is the caller's job). */
  remove(taskId: string): Observable<void> {
    return this.api.deleteTask(taskId);
  }

  /** Approve a completed task (no reason) or deny it (reason REQUIRED). */
  review(taskId: string, approve: boolean, reason?: string): Observable<CompanionTask> {
    return this.api.reviewTask(taskId, approve, reason);
  }

  /**
   * Atomic bulk add/edit/delete across multiple students. One idempotency key
   * per logical operation: generating it when the dialog opens (not on every
   * click) makes a double submit replay instead of duplicating.
   */
  bulk(mutations: BulkTaskMutation[], idempotencyKey: string): Observable<BulkTaskResult> {
    return this.api.bulkTasks(mutations, idempotencyKey);
  }

  /** Fresh idempotency key for one bulk operation. */
  static newIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `bulk-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }

  /** Backend error CODE of a failed task call, when present. */
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
}
