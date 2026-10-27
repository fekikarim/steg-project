import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

/**
 * Validation workspace contract (§5.11, Admin only): the queue renders one
 * server page (`GET /api/internship-validation/queue`), AI verification never
 * moves a status, manual decisions carry the comment, and the receipt call is
 * a bare POST (idempotency lives server-side).
 */
describe('ApiClient validation workspace', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs the queue with page, size, search and every §5.11 filter', () => {
    api
      .searchValidationQueue({
        page: 1,
        size: 25,
        sort: 'reference,asc',
        q: 'amine',
        statuses: ['REPORT_SUBMITTED', 'UNDER_VALIDATION'],
        supervisorUserId: 'sup-1',
        universityId: 'u-1',
        type: 'PFE',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internship-validation/queue'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('q')).toBe('amine');
    expect(req.request.params.getAll('statuses')).toEqual(['REPORT_SUBMITTED', 'UNDER_VALIDATION']);
    expect(req.request.params.get('supervisorUserId')).toBe('sup-1');
    expect(req.request.params.get('universityId')).toBe('u-1');
    expect(req.request.params.get('type')).toBe('PFE');
    req.flush({ content: [], page: { number: 1, size: 25, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('omits absent filters instead of sending empty parameters', () => {
    api.searchValidationQueue({ page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internship-validation/queue'));
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('statuses')).toBe(false);
    expect(req.request.params.has('supervisorUserId')).toBe(false);
    expect(req.request.params.has('type')).toBe(false);
    req.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('fetches the detail aggregate in one call', () => {
    api.getValidationDetail('int-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internship-validation/int-1'));
    expect(req.request.method).toBe('GET');
    req.flush({ internshipId: 'int-1' });
    http.verify();
  });

  it('POSTs AI verification per document without moving any status', () => {
    api.runVerification('int-1', 'REPORT').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internship-validation/int-1/verify'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ documentType: 'REPORT' });
    req.flush({ overall: 'PASS', degraded: false, checks: [] });
    http.verify();
  });

  it('POSTs manual decisions with the trimmed comment', () => {
    api.recordDecision('int-1', 'JOURNAL', 'REJECTED', '  Add week 4  ').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internship-validation/int-1/decisions'));
    expect(req.request.body).toMatchObject({
      documentType: 'JOURNAL',
      decision: 'REJECTED',
      comment: 'Add week 4',
    });
    req.flush({ internshipId: 'int-1' });
    http.verify();
  });

  it('POSTs receipt generation as a bare call (idempotency is server-side)', () => {
    api.generateReceipt('int-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internship-validation/int-1/receipt'));
    expect(req.request.method).toBe('POST');
    req.flush({ reference: 'PAY-2026-00001' });
    http.verify();
  });

  it('downloads validation documents as blobs', () => {
    api.downloadValidationDocument('int-1', 'REPORT').subscribe();
    const req = http.expectOne((r) =>
      r.url.endsWith('/api/internship-validation/int-1/documents/REPORT/download'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    http.verify();
  });
});
