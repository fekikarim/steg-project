import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InternAccountsService } from './intern-accounts.service';
import { ApiClient } from '../../core/api-client.service';
import type { InternAccountRow } from '../../core/api-models';

const ROW: InternAccountRow = {
  id: 'u1',
  email: 'intern@steg.tn',
  roles: ['INTERN'],
  status: 'ACTIVE',
  enabled: true,
  mustChangePassword: true,
  fullName: 'Sara Ben Ammar',
  candidateId: 'c1',
  internshipId: 'i1',
  createdAt: '2026-06-01T00:00:00Z',
};

describe('InternAccountsService', () => {
  function setup(overrides: Record<string, unknown> = {}) {
    const calls = {
      search: [] as unknown[],
      create: [] as unknown[][],
      update: [] as unknown[][],
      reset: [] as unknown[][],
      status: [] as unknown[][],
      remove: [] as unknown[][],
    };
    const api = {
      searchInternAccounts: (...args: unknown[]) => {
        calls.search = args;
        return of({ content: [ROW], totalElements: 1, totalPages: 1, number: 0, size: 20 });
      },
      createInternAccount: (...args: unknown[]) => {
        calls.create.push(args);
        return of({ email: 'new@steg.tn', temporaryPassword: 'Aa1!bbbb', emailSent: true });
      },
      updateInternAccount: (...args: unknown[]) => {
        calls.update.push(args);
        return of(ROW);
      },
      resetInternAccountPassword: (...args: unknown[]) => {
        calls.reset.push(args);
        return of({ email: ROW.email, temporaryPassword: 'Zz9!newSecret', emailSent: true });
      },
      setInternAccountStatus: (...args: unknown[]) => {
        calls.status.push(args);
        return of(ROW);
      },
      deleteInternAccount: (...args: unknown[]) => {
        calls.remove.push(args);
        return of(undefined as void);
      },
      ...overrides,
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    return { service: TestBed.inject(InternAccountsService), calls };
  }

  it('passes the server-side query through untouched (no local filtering)', () => {
    const { service, calls } = setup();
    service
      .search({ page: 2, size: 10, q: 'sara', role: 'INTERN', status: 'LOCKED', sort: 'email,asc' })
      .subscribe();
    expect(calls.search[0]).toEqual({
      page: 2,
      size: 10,
      q: 'sara',
      role: 'INTERN',
      status: 'LOCKED',
      sort: 'email,asc',
    });
  });

  it('trims the email and forwards the chosen role when creating', () => {
    const { service, calls } = setup();
    service.create('  intern@steg.tn  ', 'INTERN').subscribe();
    expect(calls.create[0]).toEqual([{ email: 'intern@steg.tn', role: 'INTERN' }]);
  });

  it('updates only the fields the caller provides', () => {
    const { service, calls } = setup();
    service.update('u1', { enabled: false }).subscribe();
    expect(calls.update[0]).toEqual(['u1', { enabled: false }]);
  });

  it('resets the password through the dedicated endpoint', () => {
    const { service, calls } = setup();
    let password = '';
    service.resetPassword('u1').subscribe((r) => (password = r.temporaryPassword));
    expect(calls.reset[0]).toEqual(['u1']);
    expect(password).toBe('Zz9!newSecret');
  });

  it('activates with ACTIVE + enabled and deactivates with enabled=false', () => {
    const { service, calls } = setup();
    service.activate('u1').subscribe();
    service.deactivate('u1').subscribe();
    expect(calls.status[0]).toEqual(['u1', { status: 'ACTIVE', enabled: true }]);
    expect(calls.status[1]).toEqual(['u1', { enabled: false }]);
  });

  it('propagates the 409 delete guard unchanged', () => {
    const conflict = { status: 409, error: { errorCode: 'SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS', message: 'busy' } };
    const { service } = setup({ deleteInternAccount: () => throwError(() => conflict) });
    let seen: unknown = null;
    service.remove('u1').subscribe({ error: (e: unknown) => (seen = e) });
    expect(seen).toBe(conflict);
  });

  it('recognises only the active-assignments conflict as the delete guard', () => {
    expect(
      InternAccountsService.isActiveAssignmentsConflict({
        status: 409,
        error: { errorCode: 'SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS' },
      }),
    ).toBe(true);
    expect(
      InternAccountsService.isActiveAssignmentsConflict({ status: 409, error: { errorCode: 'INVALID_ROLE' } }),
    ).toBe(false);
    expect(InternAccountsService.isActiveAssignmentsConflict({ status: 500 })).toBe(false);
  });

  it('extracts the backend envelope message and falls back when absent', () => {
    expect(InternAccountsService.messageOf({ error: { message: 'nope' } }, 'fallback')).toBe('nope');
    expect(InternAccountsService.messageOf({}, 'fallback')).toBe('fallback');
  });
});
