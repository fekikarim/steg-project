import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import { TaskDraftsService } from './task-drafts.service';
import type { TaskDraft } from '../../core/api-models';

/**
 * TaskDraftsService facade (AGENTS.md §7.4 — S10c UI): no rule lives here —
 * the backend owns scope (Admin any student, Supervisor own only),
 * validation, atomic bulk-add and 404s. The facade only shapes transport
 * (including the idempotency key) and reads error envelopes.
 */
describe('TaskDraftsService', () => {
  let service: TaskDraftsService;
  let api: ApiClient;

  const D1 = { id: 'd1', referenceInternshipId: 'int-A', title: 'Draft one' } as TaskDraft;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TaskDraftsService);
    api = TestBed.inject(ApiClient);
  });

  it('generates drafts from a PDF through the client', () => {
    const spy = vi.spyOn(api, 'generateTaskDrafts').mockReturnValue(of([D1]));
    const file = new File(['x'], 's.pdf', { type: 'application/pdf' });
    service.generate(file, 'int-A').subscribe();
    expect(spy).toHaveBeenCalledWith(file, 'int-A');
  });

  it('lists drafts with the optional internship filter', () => {
    const spy = vi.spyOn(api, 'listTaskDrafts').mockReturnValue(of([D1]));
    service.list('int-A').subscribe();
    expect(spy).toHaveBeenCalledWith('int-A');
  });

  it('adds, edits, revises and removes through the client', () => {
    const add = vi.spyOn(api, 'addDraftManually').mockReturnValue(of(D1));
    const edit = vi.spyOn(api, 'updateDraft').mockReturnValue(of(D1));
    const revise = vi.spyOn(api, 'reviseDraft').mockReturnValue(of(D1));
    const remove = vi.spyOn(api, 'deleteDraft').mockReturnValue(of(undefined as void));
    service.add({ referenceInternshipId: 'int-A', title: 'T' }).subscribe();
    service.edit('d1', { title: 'T2' }).subscribe();
    service.revise('d1', 'shorter please').subscribe();
    service.remove('d1').subscribe();
    expect(add).toHaveBeenCalledWith({ referenceInternshipId: 'int-A', title: 'T' });
    expect(edit).toHaveBeenCalledWith('d1', { title: 'T2' });
    expect(revise).toHaveBeenCalledWith('d1', 'shorter please');
    expect(remove).toHaveBeenCalledWith('d1');
  });

  it('sends draft bulk-add with the caller-supplied idempotency key', () => {
    const spy = vi.spyOn(api, 'bulkAddDrafts').mockReturnValue(of({ items: [] }));
    const body = { draftIds: ['d1'], internshipIds: ['int-A'] };
    service.bulkAdd(body, 'k-7').subscribe();
    expect(spy).toHaveBeenCalledWith(body, 'k-7');
  });

  it('loads students from the scoped internships endpoint', () => {
    const spy = vi.spyOn(api, 'listInternships').mockReturnValue(of([]));
    service.students().subscribe();
    expect(spy).toHaveBeenCalledWith();
  });

  it('generates a fresh idempotency key per bulk operation', () => {
    expect(TaskDraftsService.newIdempotencyKey()).toBeTruthy();
    expect(TaskDraftsService.newIdempotencyKey()).not.toBe(TaskDraftsService.newIdempotencyKey());
  });

  it('detects the AI-unavailable backend code', () => {
    expect(TaskDraftsService.isUnavailable({ error: { error: 'AI_UNAVAILABLE' } })).toBe(true);
    expect(TaskDraftsService.isUnavailable({ error: { error: 'DRAFT_TITLE_INVALID' } })).toBe(
      false,
    );
    expect(TaskDraftsService.isUnavailable({})).toBe(false);
  });

  it('reads the backend error code and message', () => {
    expect(TaskDraftsService.codeOf({ error: { error: 'AI_GENERATION_INVALID' } })).toBe(
      'AI_GENERATION_INVALID',
    );
    expect(TaskDraftsService.codeOf({})).toBeNull();
    expect(TaskDraftsService.messageOf({ error: { message: 'Boom' } }, 'fb')).toBe('Boom');
    expect(TaskDraftsService.messageOf({}, 'fb')).toBe('fb');
  });

  it('surfaces backend failures unchanged', () => {
    vi.spyOn(api, 'listTaskDrafts').mockReturnValue(
      throwError(() => ({ status: 404, error: { error: 'Not Found', message: 'gone' } })),
    );
    let seen = '';
    service.list().subscribe({ error: (e) => (seen = TaskDraftsService.messageOf(e, 'fb')) });
    expect(seen).toBe('gone');
  });
});
