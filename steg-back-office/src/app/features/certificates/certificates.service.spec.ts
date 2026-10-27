import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import { CertificatesService } from './certificates.service';
import type { CertificateDetail, Page } from '../../core/api-models';

/**
 * CertificatesService facade (§5.7): no rule lives here — eligibility,
 * stable references, versioned regeneration and revocation are
 * backend-owned. The facade only shapes transport and reads envelopes.
 */
describe('CertificatesService', () => {
  let service: CertificatesService;
  let api: ApiClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CertificatesService);
    api = TestBed.inject(ApiClient);
  });

  it('searches one server page through the client', () => {
    const spy = vi.spyOn(api, 'searchCertificates').mockReturnValue(
      of({
        content: [],
        totalElements: 0,
        totalPages: 1,
        number: 0,
        size: 20,
      } as unknown as Page<never>),
    );
    service.search({ page: 0, size: 20, q: 'x' }).subscribe();
    expect(spy).toHaveBeenCalledWith({ page: 0, size: 20, q: 'x' });
  });

  it('regenerates through the client with the issue date', () => {
    const spy = vi
      .spyOn(api, 'regenerateCertificate')
      .mockReturnValue(of({ certificate: { id: 'c' } } as unknown as CertificateDetail));
    service.regenerate('c', '2026-05-20').subscribe();
    expect(spy).toHaveBeenCalledWith('c', '2026-05-20');
  });

  it('reads the backend error code and message', () => {
    expect(CertificatesService.codeOf({ error: { error: 'INTERNSHIP_NOT_VALIDATED' } })).toBe(
      'INTERNSHIP_NOT_VALIDATED',
    );
    expect(CertificatesService.codeOf({})).toBeNull();
    expect(CertificatesService.messageOf({ error: { message: 'Boom' } }, 'fb')).toBe('Boom');
    expect(CertificatesService.messageOf({}, 'fb')).toBe('fb');
  });

  it('surfaces backend failures unchanged', () => {
    vi.spyOn(api, 'revokeCertificate').mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { error: 'CERTIFICATE_ALREADY_REVOKED', message: 'gone' },
      })),
    );
    let seen = '';
    service
      .remove('c')
      .subscribe({ error: (e) => (seen = CertificatesService.messageOf(e, 'fb')) });
    expect(seen).toBe('gone');
  });
});
