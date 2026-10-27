import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';
import { environment } from '../../environments/environment';

/**
 * 'STEG intern' accounts contract (AGENTS.md §5.4): list/search/role-status
 * filters/sort run SERVER-side on `GET /api/intern-accounts/manage` (never the
 * whole list filtered locally), the literal `/manage` segment is used instead
 * of `/{id}`, and mutations target the real administration routes.
 */
describe('ApiClient intern accounts', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('GETs /api/intern-accounts/manage with page, size, sort, search, role and status', () => {
    api
      .searchInternAccounts({
        page: 1,
        size: 25,
        sort: 'createdAt,desc',
        q: 'amine',
        role: 'INTERN',
        status: 'ACTIVE',
      })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/intern-accounts/manage'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('sort')).toBe('createdAt,desc');
    expect(req.request.params.get('q')).toBe('amine');
    expect(req.request.params.get('role')).toBe('INTERN');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    req.flush({ content: [], page: { number: 1, size: 25, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('omits absent filters instead of sending empty parameters', () => {
    api.searchInternAccounts({ page: 0, size: 20 }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/intern-accounts/manage'));
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('role')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('clamps the page size to the configured maximum', () => {
    api.searchInternAccounts({ page: 0, size: 9999 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/intern-accounts/manage'));
    expect(req.request.params.get('size')).toBe(String(environment.pageSizeMax));
    req.flush({ content: [], page: { number: 0, size: 9999, totalElements: 0, totalPages: 0 } });
    http.verify();
  });

  it('normalizes the Spring 4 instance-model envelope into a flat Page', () => {
    const captured: { t: number; tp: number; n: number }[] = [];
    api
      .searchInternAccounts({ page: 2, size: 10 })
      .subscribe((p) => captured.push({ t: p.totalElements, tp: p.totalPages, n: p.number }));

    const req = http.expectOne((r) => r.url.endsWith('/api/intern-accounts/manage'));
    req.flush({
      content: [{ id: 'u1', email: 'intern@steg.tn', roles: ['INTERN'] }],
      page: { number: 2, size: 10, totalElements: 42, totalPages: 5 },
    });

    expect(captured[0]?.t).toBe(42);
    expect(captured[0]?.tp).toBe(5);
    expect(captured[0]?.n).toBe(2);
    http.verify();
  });

  it('POSTs the new account with its role and returns the one-time credentials', () => {
    const bodies: unknown[] = [];
    const passwords: string[] = [];
    api.createInternAccount({ email: 'intern@steg.tn', role: 'INTERN' }).subscribe((r) => {
      bodies.push(r.email);
      passwords.push(r.temporaryPassword);
    });

    const req = http.expectOne(`${environment.apiBaseUrl}/api/intern-accounts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'intern@steg.tn', role: 'INTERN' });
    req.flush({ email: 'intern@steg.tn', temporaryPassword: 'Aa1!bbbbccccdddd', emailSent: true });

    expect(bodies).toEqual(['intern@steg.tn']);
    expect(passwords).toEqual(['Aa1!bbbbccccdddd']);
    http.verify();
  });

  it('PUTs a partial update so untouched fields stay as they are', () => {
    api.updateInternAccount('u1', { status: 'INACTIVE' }).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/api/intern-accounts/u1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush({ id: 'u1', email: 'intern@steg.tn', roles: ['INTERN'] });
    http.verify();
  });

  it('PATCHes the status route with query parameters (activate/deactivate)', () => {
    api.setInternAccountStatus('u1', { enabled: false }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/intern-accounts/u1/status'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.params.get('enabled')).toBe('false');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ id: 'u1', email: 'intern@steg.tn', roles: ['INTERN'] });
    http.verify();
  });

  it('POSTs reset-password and returns the new one-time secret', () => {
    const passwords: string[] = [];
    api.resetInternAccountPassword('u1').subscribe((r) => passwords.push(r.temporaryPassword));

    const req = http.expectOne(`${environment.apiBaseUrl}/api/intern-accounts/u1/reset-password`);
    expect(req.request.method).toBe('POST');
    req.flush({
      email: 'intern@steg.tn',
      temporaryPassword: 'Zz9!rewrittenSecret',
      emailSent: false,
    });

    expect(passwords).toEqual(['Zz9!rewrittenSecret']);
    http.verify();
  });

  it('DELETEs the account by id', () => {
    api.deleteInternAccount('u1').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/api/intern-accounts/u1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.verify();
  });

  it('keeps the legacy search route used by the credentials-resend flow', () => {
    api.listInternAccounts('intern@steg.tn').subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/intern-accounts'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('intern@steg.tn');
    req.flush([{ id: 'u1', email: 'intern@steg.tn' }]);
    http.verify();
  });
});
