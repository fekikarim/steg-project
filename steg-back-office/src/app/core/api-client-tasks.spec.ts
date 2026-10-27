import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

/**
 * Tasks workspace contract (AGENTS.md §5.5/§6.1): the scoped list lives on
 * `GET /api/internships/tasks` (Admin all, Supervisor own — server-side),
 * approve/deny goes through the review endpoint (deny reason mandatory
 * server-side), bulk add/edit/delete is one atomic `POST .../tasks/bulk` call
 * carrying `X-Idempotency-Key`, and single delete is `DELETE .../tasks/{id}`.
 */
describe('ApiClient tasks workspace', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs the scoped task list with page, size and status', () => {
    api.listAllTasks(2, 25, 'COMPLETED').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('status')).toBe('COMPLETED');
    req.flush({ content: [], page: { number: 2, size: 25, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('omits the status filter when absent', () => {
    api.listAllTasks(0, 20).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks'));
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('POSTs approve/deny through the review endpoint', () => {
    api.reviewTask('task-1', true).subscribe();
    const approve = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/task-1/review'));
    expect(approve.request.method).toBe('POST');
    expect(approve.request.body).toMatchObject({ approve: true });
    approve.flush({ id: 'task-1' });
    http.verify();

    api.reviewTask('task-2', false, 'Too short').subscribe();
    const deny = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/task-2/review'));
    expect(deny.request.body).toMatchObject({ approve: false, comment: 'Too short' });
    deny.flush({ id: 'task-2' });
    http.verify();
  });

  it('PUTs task edits to the task route', () => {
    api.updateTask('task-9', { title: 'New title' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/task-9'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ title: 'New title' });
    req.flush({ id: 'task-9' });
    http.verify();
  });

  it('POSTs bulk mutations with the idempotency key header', () => {
    const mutations = [
      { action: 'CREATE' as const, internshipId: 'int-1', task: { title: 'T1' } },
      { action: 'DELETE' as const, taskId: 'task-7' },
    ];
    api.bulkTasks(mutations, 'key-123').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/bulk'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Idempotency-Key')).toBe('key-123');
    expect(req.request.body).toHaveLength(2);
    req.flush({ tasks: [], deletedCount: 1, items: [] });
    http.verify();
  });

  it('DELETEs one task on the task route', () => {
    api.deleteTask('task-3').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/task-3'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.verify();
  });
});
