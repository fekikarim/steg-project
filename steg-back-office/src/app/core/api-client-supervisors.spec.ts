import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';
import { environment } from '../../environments/environment';

/**
 * Supervisor Management contract (AGENTS.md §5.6): list/search/filter/sort run
 * SERVER-side on `GET /api/supervisors/manage` (never the whole list filtered
 * locally), mutations target the user-backed `/api/supervisors/{id}` routes,
 * and the `/manage` segment must not be mistaken for an id.
 */
describe('ApiClient supervisor management', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs /api/supervisors/manage with page, size, sort, search and status', () => {
    api
      .searchSupervisors({
        page: 1,
        size: 25,
        sort: 'createdAt,desc',
        q: 'superviseur@steg.tn',
        status: 'ACTIVE',
      })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/supervisors/manage'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('sort')).toBe('createdAt,desc');
    expect(req.request.params.get('q')).toBe('superviseur@steg.tn');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    req.flush({ content: [], page: { number: 1, size: 25, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('omits absent filters instead of sending empty parameters', () => {
    api.searchSupervisors({ page: 0, size: 20 }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/supervisors/manage'));
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('clamps the page size to the configured maximum', () => {
    api.searchSupervisors({ page: 0, size: 9999 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/supervisors/manage'));
    expect(req.request.params.get('size')).toBe(String(environment.pageSizeMax));
    req.flush({ content: [], page: { number: 0, size: 9999, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('normalizes the Spring 4 instance-model envelope into a flat Page', () => {
    const captured: { t: number; tp: number; n: number }[] = [];
    api
      .searchSupervisors({ page: 1, size: 20 })
      .subscribe((p) => captured.push({ t: p.totalElements, tp: p.totalPages, n: p.number }));

    const req = http.expectOne((r) => r.url.endsWith('/api/supervisors/manage'));
    req.flush({
      content: [{ id: 'u1', email: 'sup@steg.tn', role: 'SUPERVISOR', activeAssignmentsCount: 2 }],
      page: { number: 1, size: 20, totalElements: 42, totalPages: 3 },
    });

    expect(captured[0]?.t).toBe(42);
    expect(captured[0]?.tp).toBe(3);
    expect(captured[0]?.n).toBe(1);
    http.verify();
  });

  it('POSTs the new supervisor account and returns the one-time credentials', () => {
    const passwords: string[] = [];
    api
      .createSupervisor({ email: 'sup@steg.tn' })
      .subscribe((r) => passwords.push(r.temporaryPassword));

    const req = http.expectOne((r) => r.url.endsWith('/api/supervisors'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'sup@steg.tn' });
    req.flush({ email: 'sup@steg.tn', temporaryPassword: 'Aa1!bbbbccccdddd', emailSent: true });

    expect(passwords).toEqual(['Aa1!bbbbccccdddd']);
    http.verify();
  });

  it('PUTs only the changed fields on update', () => {
    api.updateSupervisor('u1', { status: 'INACTIVE' }).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/api/supervisors/u1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush({ id: 'u1', email: 'sup@steg.tn', role: 'SUPERVISOR', activeAssignmentsCount: 0 });
    http.verify();
  });

  it('DELETEs the supervisor by id', () => {
    api.deleteSupervisor('u1').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/api/supervisors/u1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.verify();
  });

  it('POSTs assign-candidate with the internship id and optional department', () => {
    api.assignCandidateToSupervisor('u1', { internshipId: 'i1', departmentId: null }).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/api/supervisors/u1/assign-candidate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ internshipId: 'i1', departmentId: null });
    req.flush(null);
    http.verify();
  });

  it('PUTs reassignment on the internship path with the new supervisor id', () => {
    api
      .reassignSupervisor('u2', 'i1', { newSupervisorUserId: 'u2', reason: 'leave' })
      .subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/api/supervisors/u2/reassign/i1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newSupervisorUserId: 'u2', reason: 'leave' });
    req.flush(null);
    http.verify();
  });

  it('keeps the selectable-supervisor directory on its own route', () => {
    api.listSupervisors().subscribe();
    const req = http.expectOne(`${environment.apiBaseUrl}/api/supervisors`);
    expect(req.request.method).toBe('GET');
    req.flush([{ userId: 'u1', email: 'admin@steg.tn', role: 'ADMIN' }]);
    http.verify();
  });
});