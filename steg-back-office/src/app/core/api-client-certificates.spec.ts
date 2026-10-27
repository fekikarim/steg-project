import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

/**
 * Certificates workspace contract (§5.7, Admin only): the list renders one
 * server page (`GET /api/certificates`), detail carries the version history,
 * edit regenerates as a new version (reference stable), delete revokes, and
 * version downloads address `/versions/{n}/download`.
 */
describe('ApiClient certificates workspace', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs the workspace list with page, size, search and status', () => {
    api
      .searchCertificates({
        page: 1,
        size: 25,
        sort: 'reference,asc',
        q: 'amine',
        status: 'GENERATED',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/certificates'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('q')).toBe('amine');
    expect(req.request.params.get('status')).toBe('GENERATED');
    req.flush({ content: [], page: { number: 1, size: 25, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('omits absent filters instead of sending empty parameters', () => {
    api.searchCertificates({ page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/certificates'));
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('fetches the detail with version history in one call', () => {
    api.getCertificateDetail('cert-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/certificates/cert-1/detail'));
    expect(req.request.method).toBe('GET');
    req.flush({ certificate: { id: 'cert-1' }, versions: [] });
    http.verify();
  });

  it('PUTs edit-and-regenerate with the trimmed issue date', () => {
    api.regenerateCertificate('cert-1', ' 2026-05-20 ').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/certificates/cert-1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ issueDate: '2026-05-20' });
    req.flush({ certificate: { id: 'cert-1' }, versions: [] });
    http.verify();
  });

  it('DELETEs (revokes) on the certificate route', () => {
    api.revokeCertificate('cert-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/certificates/cert-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.verify();
  });

  it('downloads the latest PDF and addressed history versions as blobs', () => {
    api.downloadCertificateVersion('cert-1').subscribe();
    http.expectOne((r) => r.url.endsWith('/api/certificates/cert-1')).flush(new Blob());
    api.downloadCertificateVersion('cert-1', 1).subscribe();
    const req = http.expectOne((r) =>
      r.url.endsWith('/api/certificates/cert-1/versions/1/download'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob());
    http.verify();
  });
});
