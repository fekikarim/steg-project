import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import { DashboardSummaryService } from './dashboard-summary.service';
import type { AdminDashboardSummary, SupervisorDashboardSummary } from '../../core/api-models';

const ADMIN: AdminDashboardSummary = {
  applicationsByStatus: { SUBMITTED: 3 },
  newCandidates: 2,
  tasksAwaitingApproval: 4,
  reportsAwaitingValidation: { REPORT_SUBMITTED: 1 },
  receiptsIssued: 5,
  certificatesIssued: 6,
  supervisorWorkload: [],
  trends: [],
};

const SUPERVISOR: SupervisorDashboardSummary = {
  myCandidates: 2,
  candidatesByStatus: { IN_PROGRESS: 2 },
  tasksAwaitingApproval: 1,
  overdueTasks: 1,
  unreadNotifications: 2,
  recentNotifications: [],
};

/**
 * DashboardSummaryService (S11): each dashboard renders ONE scoped backend
 * summary call — the client never computes numbers from paged lists. 403 →
 * unavailable (role-scoped, honest); other failures → error.
 */
describe('DashboardSummaryService', () => {
  let service: DashboardSummaryService;
  let api: ApiClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(DashboardSummaryService);
    api = TestBed.inject(ApiClient);
  });

  it('loads the admin summary in one call', () => {
    const spy = vi.spyOn(api, 'getAdminSummary').mockReturnValue(of(ADMIN));
    let seen: unknown;
    service.admin().subscribe((s) => (seen = s));
    expect(spy).toHaveBeenCalledWith();
    expect(seen).toMatchObject({ state: 'ok', source: 'GET /api/reports/admin-summary' });
    expect((seen as { data: AdminDashboardSummary }).data.tasksAwaitingApproval).toBe(4);
  });

  it('loads the supervisor summary in one call', () => {
    const spy = vi.spyOn(api, 'getSupervisorSummary').mockReturnValue(of(SUPERVISOR));
    let seen: unknown;
    service.supervisor().subscribe((s) => (seen = s));
    expect(spy).toHaveBeenCalledWith();
    expect(seen).toMatchObject({ state: 'ok', source: 'GET /api/reports/supervisor-summary' });
    expect((seen as { data: SupervisorDashboardSummary }).data.overdueTasks).toBe(1);
  });

  it('maps 403 to unavailable and other failures to error', () => {
    vi.spyOn(api, 'getAdminSummary').mockReturnValue(throwError(() => ({ status: 403 })));
    let adminState = '';
    service.admin().subscribe((s) => (adminState = s.state));
    expect(adminState).toBe('unavailable');

    vi.spyOn(api, 'getSupervisorSummary').mockReturnValue(throwError(() => ({ status: 500 })));
    let supState = '';
    service.supervisor().subscribe((s) => (supState = s.state));
    expect(supState).toBe('error');
  });
});
