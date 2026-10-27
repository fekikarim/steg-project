import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SupervisorManagementService } from './supervisor-management.service';
import { ApiClient } from '../../core/api-client.service';
import type { InternshipDetail, SupervisorRow } from '../../core/api-models';

const ROW: SupervisorRow = {
  id: 'u1',
  email: 'sup@steg.tn',
  role: 'SUPERVISOR',
  status: 'ACTIVE',
  enabled: true,
  activeAssignmentsCount: 1,
  createdAt: '2026-06-01T00:00:00Z',
};

function internship(id: string, reference: string, status: InternshipDetail['status']): InternshipDetail {
  return {
    id,
    reference,
    startDate: '2026-06-01',
    endDate: '2026-07-31',
    status,
    type: 'PFE',
    requirement: 'OBLIGATOIRE',
    paymentEligible: true,
    subject: 'Stage',
    academicLevel: 'ING',
    candidateId: 'c1',
    candidateFullName: 'Sara Ben Ammar',
    applicationId: 'a1',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    version: 0,
  };
}

describe('SupervisorManagementService', () => {
  function setup(overrides: Record<string, unknown> = {}) {
    const calls = {
      search: [] as unknown[],
      listInternships: [] as unknown[][],
      createSupervisor: [] as unknown[][],
      updateSupervisor: [] as unknown[][],
      deleteSupervisor: [] as unknown[][],
      assign: [] as unknown[][],
      reassign: [] as unknown[][],
    };
    const api = {
      searchSupervisors: (...args: unknown[]) => {
        calls.search = args;
        return of({ content: [ROW], totalElements: 1, totalPages: 1, number: 0, size: 20 });
      },
      listInternships: (...args: unknown[]) => {
        calls.listInternships.push(args);
        return of([
          internship('i1', 'STG-2026-0002', 'IN_PROGRESS'),
          internship('i2', 'STG-2026-0001', 'CANCELLED'),
          internship('i3', 'STG-2026-0003', 'ARCHIVED'),
          internship('i4', 'STG-2026-0004', 'VALIDATED'),
        ]);
      },
      listSupervisors: () => of([{ userId: 'u1', email: 'admin@steg.tn', role: 'ADMIN' }]),
      createSupervisor: (...args: unknown[]) => {
        calls.createSupervisor.push(args);
        return of({ email: 'new@steg.tn', temporaryPassword: 'Aa1!bbbb', emailSent: true });
      },
      updateSupervisor: (...args: unknown[]) => {
        calls.updateSupervisor.push(args);
        return of(ROW);
      },
      deleteSupervisor: (...args: unknown[]) => {
        calls.deleteSupervisor.push(args);
        return of(undefined as void);
      },
      assignCandidateToSupervisor: (...args: unknown[]) => {
        calls.assign.push(args);
        return of(undefined as void);
      },
      reassignSupervisor: (...args: unknown[]) => {
        calls.reassign.push(args);
        return of(undefined as void);
      },
      ...overrides,
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    return { service: TestBed.inject(SupervisorManagementService), calls };
  }

  it('passes the search query through untouched (server-side filtering)', () => {
    const { service, calls } = setup();
    service.search({ page: 2, size: 10, q: 'sup', status: 'LOCKED', sort: 'email,asc' }).subscribe();
    expect(calls.search[0]).toEqual({ page: 2, size: 10, q: 'sup', status: 'LOCKED', sort: 'email,asc' });
  });

  it('never offers a cancelled or archived internship for assignment', () => {
    const { service } = setup();
    let rows: readonly InternshipDetail[] = [];
    service.assignableInternships().subscribe((r) => (rows = r));
    expect(rows.map((r) => r.id)).toEqual(['i1', 'i4']);
  });

  it('trims the email before creating the account', () => {
    const { service, calls } = setup();
    service.create('  new@steg.tn  ').subscribe();
    expect(calls.createSupervisor[0]).toEqual([{ email: 'new@steg.tn' }]);
  });

  it('assigns with the internship id and a null department by default', () => {
    const { service, calls } = setup();
    service.assign('u1', 'i1').subscribe();
    expect(calls.assign[0]).toEqual(['u1', { internshipId: 'i1', departmentId: null }]);
  });

  it('reassigns to the selected supervisor with a trimmed reason', () => {
    const { service, calls } = setup();
    service.reassign('u2', 'i1', '  leave  ').subscribe();
    expect(calls.reassign[0]).toEqual(['u2', 'i1', { newSupervisorUserId: 'u2', reason: 'leave' }]);
  });

  it('sends a null reason when none is given', () => {
    const { service, calls } = setup();
    service.reassign('u2', 'i1').subscribe();
    expect(calls.reassign[0]).toEqual(['u2', 'i1', { newSupervisorUserId: 'u2', reason: null }]);
  });

  it('propagates the 409 delete guard unchanged', () => {
    const conflict = { status: 409, error: { errorCode: 'SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS', message: 'busy' } };
    const { service } = setup({ deleteSupervisor: () => throwError(() => conflict) });
    let seen: unknown = null;
    service.remove('u1').subscribe({ error: (e: unknown) => (seen = e) });
    expect(seen).toBe(conflict);
  });

  it('recognises only the active-assignments conflict as the delete guard', () => {
    expect(
      SupervisorManagementService.isActiveAssignmentsConflict({
        status: 409,
        error: { errorCode: 'SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS' },
      }),
    ).toBe(true);
    expect(
      SupervisorManagementService.isActiveAssignmentsConflict({
        status: 409,
        error: { errorCode: 'CANDIDATE_NOT_APPROVED' },
      }),
    ).toBe(false);
    expect(SupervisorManagementService.isActiveAssignmentsConflict({ status: 500 })).toBe(false);
  });

  it('extracts the backend envelope message and falls back when absent', () => {
    expect(
      SupervisorManagementService.messageOf({ error: { message: 'nope' } }, 'fallback'),
    ).toBe('nope');
    expect(SupervisorManagementService.messageOf({}, 'fallback')).toBe('fallback');
  });
});