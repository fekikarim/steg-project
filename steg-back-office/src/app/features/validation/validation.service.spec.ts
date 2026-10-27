import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import { ValidationService } from './validation.service';
import type { Page, ValidationDetail } from '../../core/api-models';

/**
 * ValidationService facade (§5.11): no rule lives here — scope, advisory AI,
 * mandatory decisions and idempotent receipts are backend-owned. The facade
 * only shapes transport and reads error envelopes.
 */
describe('ValidationService', () => {
  let service: ValidationService;
  let api: ApiClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ValidationService);
    api = TestBed.inject(ApiClient);
  });

  it('queues one server page through the client', () => {
    const spy = vi.spyOn(api, 'searchValidationQueue').mockReturnValue(
      of({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 20 } as unknown as Page<never>),
    );
    service.queue({ page: 0, size: 20, q: 'x' }).subscribe();
    expect(spy).toHaveBeenCalledWith({ page: 0, size: 20, q: 'x' });
  });

  it('decides through the client with document, decision and comment', () => {
    const spy = vi
      .spyOn(api, 'recordDecision')
      .mockReturnValue(of({ internshipId: 'i' } as unknown as ValidationDetail));
    service.decide('i', 'REPORT', 'VALIDATED').subscribe();
    expect(spy).toHaveBeenCalledWith('i', 'REPORT', 'VALIDATED', undefined);
  });

  it('reads the backend error code and message', () => {
    expect(ValidationService.codeOf({ error: { error: 'DOCUMENT_MISSING' } })).toBe('DOCUMENT_MISSING');
    expect(ValidationService.codeOf({})).toBeNull();
    expect(ValidationService.messageOf({ error: { message: 'Boom' } }, 'fb')).toBe('Boom');
    expect(ValidationService.messageOf({}, 'fb')).toBe('fb');
  });

  it('surfaces backend failures unchanged', () => {
    vi.spyOn(api, 'generateReceipt').mockReturnValue(
      throwError(() => ({ status: 409, error: { error: 'INTERNSHIP_NOT_VALIDATED', message: 'nope' } })),
    );
    let seen = '';
    service.receipt('i').subscribe({ error: (e) => (seen = ValidationService.messageOf(e, 'fb')) });
    expect(seen).toBe('nope');
  });
});
