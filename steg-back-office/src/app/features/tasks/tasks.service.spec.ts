import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import { TasksService } from './tasks.service';
import type { CompanionTask, BulkTaskResult, Page } from '../../core/api-models';

/**
 * TasksService facade (AGENTS.md §5.5/§6.1): no rule lives here — the backend
 * owns scope, approve/deny reasons, bulk atomicity and 404s. The facade only
 * shapes transport (including the idempotency key) and reads error envelopes.
 */
describe('TasksService', () => {
  let service: TasksService;
  let api: ApiClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TasksService);
    api = TestBed.inject(ApiClient);
  });

  it('lists the scoped page through the client', () => {
    const spy = vi
      .spyOn(api, 'listAllTasks')
      .mockReturnValue(of({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 50 }));
    service.list(1, 25, 'TODO').subscribe();
    expect(spy).toHaveBeenCalledWith(1, 25, 'TODO');
  });

  it('reviews through the client with the reason', () => {
    const spy = vi
      .spyOn(api, 'reviewTask')
      .mockReturnValue(of({ id: 't1' } as unknown as CompanionTask));
    service.review('t1', false, 'Not good enough').subscribe();
    expect(spy).toHaveBeenCalledWith('t1', false, 'Not good enough');
  });

  it('sends bulk mutations with the caller-supplied idempotency key', () => {
    const spy = vi
      .spyOn(api, 'bulkTasks')
      .mockReturnValue(of({ items: [] } as unknown as BulkTaskResult));
    const mutations = [{ action: 'DELETE' as const, taskId: 't1' }];
    service.bulk(mutations, 'k-1').subscribe();
    expect(spy).toHaveBeenCalledWith(mutations, 'k-1');
  });

  it('generates a fresh idempotency key per bulk operation', () => {
    expect(TasksService.newIdempotencyKey()).toBeTruthy();
    expect(TasksService.newIdempotencyKey()).not.toBe(TasksService.newIdempotencyKey());
  });

  it('reads the backend error code and message', () => {
    expect(TasksService.codeOf({ error: { error: 'BULK_TASK_INVALID' } })).toBe('BULK_TASK_INVALID');
    expect(TasksService.codeOf({})).toBeNull();
    expect(TasksService.messageOf({ error: { message: 'Boom' } }, 'fb')).toBe('Boom');
    expect(TasksService.messageOf({}, 'fb')).toBe('fb');
  });

  it('surfaces backend failures unchanged', () => {
    vi.spyOn(api, 'deleteTask').mockReturnValue(
      throwError(() => ({ status: 404, error: { error: 'Not Found', message: 'gone' } })),
    );
    let seen = '';
    service.remove('missing').subscribe({ error: (e) => (seen = TasksService.messageOf(e, 'fb')) });
    expect(seen).toBe('gone');
  });
});
