import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';
import { environment } from '../../environments/environment';

/**
 * Candidates workspace contract (AGENTS.md §5.1): list/search/filters/sort run
 * SERVER-side on `GET /api/candidates/manage` (the literal `/manage` segment,
 * never `/{id}`), the detail aggregate arrives in ONE `/overview` call instead
 * of a client-side fan-out, and delete targets the real soft-delete route.
 */
describe('ApiClient candidates workspace', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs /api/candidates/manage with page, size, sort, search and every §5.1 filter', () => {
    api
      .searchCandidates({
        page: 1,
        size: 25,
        sort: 'firstName,asc',
        q: 'amine',
        university: 'ENIT',
        type: 'PFE',
        supervisor: 'sup-1',
        validation: 'ACTIVE',
        status: 'SUBMITTED',
        from: '2026-01-01',
        to: '2026-06-30',
      })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/candidates/manage'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('sort')).toBe('firstName,asc');
    expect(req.request.params.get('q')).toBe('amine');
    expect(req.request.params.get('university')).toBe('ENIT');
    expect(req.request.params.get('type')).toBe('PFE');
    expect(req.request.params.get('supervisor')).toBe('sup-1');
    expect(req.request.params.get('validation')).toBe('ACTIVE');
    expect(req.request.params.get('status')).toBe('SUBMITTED');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-06-30');
    req.flush({ content: [], page: { number: 1, size: 25, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('omits absent filters instead of sending empty parameters', () => {
    api.searchCandidates({ page: 0, size: 20 }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/candidates/manage'));
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('university')).toBe(false);
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.has('supervisor')).toBe(false);
    expect(req.request.params.has('validation')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('from')).toBe(false);
    expect(req.request.params.has('to')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('clamps the page size to the configured maximum', () => {
    api.searchCandidates({ page: 0, size: 9999 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/candidates/manage'));
    expect(req.request.params.get('size')).toBe(String(environment.pageSizeMax));
    req.flush({ content: [], page: { number: 0, size: 9999, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('normalizes the Spring 4 instance-model envelope into a flat Page', () => {
    const captured: { t: number; tp: number; n: number; c: number }[] = [];
    api.searchCandidates({ page: 2, size: 10 }).subscribe((p) =>
      captured.push({
        t: p.totalElements,
        tp: p.totalPages,
        n: p.number,
        c: p.content.length,
      }),
    );

    const req = http.expectOne((r) => r.url.endsWith('/api/candidates/manage'));
    req.flush({
      content: [
        {
          id: 'c1',
          firstName: 'Amine',
          lastName: 'A1',
          email: 'amine@example.tn',
          applicationCount: 2,
          latestApplicationStatus: 'SUBMITTED',
          supervisorEmail: 'sup@steg.tn',
          accountEnabled: true,
        },
      ],
      page: { number: 2, size: 10, totalElements: 42, totalPages: 5 },
    });

    expect(captured[0]?.t).toBe(42);
    expect(captured[0]?.tp).toBe(5);
    expect(captured[0]?.n).toBe(2);
    expect(captured[0]?.c).toBe(1);
    http.verify();
  });

  it('fetches the §5.1 detail aggregate from /overview in one call', () => {
    const captured: unknown[] = [];
    api.getCandidateOverview('c1').subscribe((o) => captured.push(o));

    const req = http.expectOne((r) => r.url.endsWith('/api/candidates/c1/overview'));
    expect(req.request.method).toBe('GET');
    req.flush({
      profile: { id: 'c1', firstName: 'Amine', nationalId: null },
      supervisor: { userId: 'u9', email: 'sup@steg.tn' },
      applications: [],
      internship: null,
      tasks: { total: 0, byStatus: {} },
      documents: [],
      certificate: null,
      receipt: null,
    });

    expect(captured[0]).toMatchObject({
      supervisor: { userId: 'u9', email: 'sup@steg.tn' },
    });
    http.verify();
  });

  it('soft-deletes through DELETE /api/candidates/{id}', () => {
    api.deleteCandidate('c1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/candidates/c1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.verify();
  });

  it('surfaces the 409 dependency guard untouched for the caller', () => {
    let failure: unknown = null;
    api.deleteCandidate('c1').subscribe({
      error: (e: unknown) => (failure = e),
    });
    const req = http.expectOne((r) => r.url.endsWith('/api/candidates/c1'));
    req.flush(
      { error: 'CANDIDATE_HAS_DEPENDENCIES', message: 'still has applications' },
      { status: 409, statusText: 'Conflict' },
    );
    expect((failure as { status?: number })?.status).toBe(409);
    http.verify();
  });
});
