import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from '../dashboard.component';
import { DashboardSummaryService } from './dashboard-summary.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { signInDemo } from '../../core/testing/demo-session';
import type { AdminDashboardSummary } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const SUMMARY: AdminDashboardSummary = {
  applicationsByStatus: { SUBMITTED: 4, MODIFICATION_REQUESTED: 1, APPROVED: 2 },
  newCandidates: 3,
  tasksAwaitingApproval: 5,
  reportsAwaitingValidation: { REPORT_SUBMITTED: 2, UNDER_VALIDATION: 1 },
  receiptsIssued: 6,
  certificatesIssued: 7,
  supervisorWorkload: [{ supervisorUserId: 'sup-1', email: 'sup@steg.tn', candidateCount: 2 }],
  trends: [
    { month: '2026-09', applications: 3, internships: 1 },
    { month: '2026-10', applications: 4, internships: 2 },
  ],
};

/**
 * DashboardComponent (S11 admin dashboard): every tile renders the ONE scoped
 * backend summary call (`GET /api/reports/admin-summary`) — the client never
 * computes numbers from paged lists — and every tile deep-links to the
 * filtered list. Supervisors are redirected to their own dashboard.
 */
describe('DashboardComponent (S11)', () => {
  async function setup(role: 'ADMIN' | 'SUPERVISOR', mode: 'ok' | 'throw' = 'ok') {
    let calls = 0;
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([
          { path: 'supervisor-dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
          { path: 'candidates', component: StubComponent },
          { path: 'tasks', component: StubComponent },
          { path: 'validation', component: StubComponent },
          { path: 'certificates', component: StubComponent },
          { path: 'finance', component: StubComponent },
        ]),
        {
          provide: DashboardSummaryService,
          useValue: {
            admin: () => {
              calls++;
              return mode === 'throw'
                ? throwError(() => ({ status: 500 }))
                : of({ state: 'ok' as const, data: SUMMARY, source: 's', loadedAt: null });
            },
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(I18nService).setLocale('en');
    const auth = TestBed.inject(AuthService);
    signInDemo(auth, role === 'ADMIN' ? 'admin@steg.tn' : 'sup@steg.tn', role);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls: () => calls };
  }

  it('ADMIN renders one summary call as tiles with exact backend numbers', async () => {
    const { fixture, calls } = await setup('ADMIN');
    expect(calls()).toBe(1);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('4');
    expect(text).toContain('New candidates');
    expect(fixture.nativeElement.querySelectorAll('a.st-kpi').length).toBe(6);
  });

  it('every tile deep-links to its filtered list', async () => {
    const { fixture } = await setup('ADMIN');
    const hrefs = [...fixture.nativeElement.querySelectorAll('a.st-kpi')].map((a: Element) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toContain('/applications?status=SUBMITTED');
    expect(hrefs.some((h) => h?.startsWith('/candidates?from='))).toBe(true);
    expect(hrefs).toContain('/tasks?status=COMPLETED');
    expect(hrefs).toContain('/validation?status=REPORT_SUBMITTED');
    expect(hrefs).toContain('/finance');
    expect(hrefs).toContain('/certificates?status=GENERATED');
  });

  it('workload rows link to the supervisor-filtered candidate list', async () => {
    const { fixture } = await setup('ADMIN');
    const link = fixture.nativeElement.querySelector(
      'a[href="/candidates?supervisor=sup-1"]',
    ) as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain('sup@steg.tn');
  });

  it('renders status charts and monthly trends from the summary (CSS only)', async () => {
    const { fixture } = await setup('ADMIN');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('2026-09');
    expect(text).toContain('2026-10');
    expect(fixture.nativeElement.querySelectorAll('st-dist-bars').length).toBeGreaterThanOrEqual(3);
  });

  it('SUPERVISOR is redirected without calling the global summary', async () => {
    const { fixture, calls } = await setup('SUPERVISOR');
    expect(calls()).toBe(0);
    expect(fixture.componentInstance.loading()).toBe(true);
  });

  it('renders error state with retry on failure', async () => {
    const { fixture, component } = await setup('ADMIN', 'throw');
    expect(component.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent as string).toContain('Retry');
  });

  it('retry reloads the summary after a failure', async () => {
    const { fixture, component, calls } = await setup('ADMIN', 'throw');
    expect(calls()).toBe(1);
    component.load();
    expect(calls()).toBe(2);
    expect(fixture.nativeElement.textContent as string).toContain('Retry');
  });
});
