import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';
import { environment } from '../../environments/environment';

/**
 * Staff application queue contract (AGENTS.md §5.2): the client must hit
 * `GET /api/applications/manage` and send paging/search/filter/sort as query
 * parameters — never fetch the whole list and filter locally.
 */
describe('ApiClient staff application queue', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs /api/applications/manage with page, size, sort, search and filters', () => {
    api
      .searchApplications({
        page: 2,
        size: 25,
        sort: 'candidate.lastName,asc',
        q: 'ben ammar',
        status: 'SUBMITTED',
        type: 'PFE',
        university: 'ENIT',
        from: '2026-06-01',
        to: '2026-06-30',
      })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/applications/manage'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('sort')).toBe('candidate.lastName,asc');
    expect(req.request.params.get('q')).toBe('ben ammar');
    expect(req.request.params.get('status')).toBe('SUBMITTED');
    expect(req.request.params.get('type')).toBe('PFE');
    expect(req.request.params.get('university')).toBe('ENIT');
    expect(req.request.params.get('from')).toBe('2026-06-01');
    expect(req.request.params.get('to')).toBe('2026-06-30');
    req.flush({ content: [], page: { number: 2, size: 25, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('omits absent filters instead of sending empty parameters', () => {
    api.searchApplications({ page: 0, size: 20 }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/applications/manage'));
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.has('university')).toBe(false);
    expect(req.request.params.has('from')).toBe(false);
    expect(req.request.params.has('to')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('clamps the page size to the configured maximum', () => {
    api.searchApplications({ page: 0, size: 9999 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/applications/manage'));
    expect(req.request.params.get('size')).toBe(String(environment.pageSizeMax));
    req.flush({ content: [], page: { number: 0, size: 9999, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('normalizes the Spring 4 instance-model envelope into a flat Page', () => {
    const captured: {
      page: { totalElements: number; totalPages: number; number: number } | null;
    } = { page: null };
    api.searchApplications({ page: 1, size: 20 }).subscribe((p) => (captured.page = p));

    const req = http.expectOne((r) => r.url.endsWith('/api/applications/manage'));
    req.flush({
      content: [{ id: 'a1', reference: 'APP-2026-0001' }],
      page: { number: 1, size: 20, totalElements: 42, totalPages: 3 },
    });

    expect(captured.page).not.toBeNull();
    expect(captured.page?.totalElements).toBe(42);
    expect(captured.page?.totalPages).toBe(3);
    expect(captured.page?.number).toBe(1);
    http.verify();
  });
});
