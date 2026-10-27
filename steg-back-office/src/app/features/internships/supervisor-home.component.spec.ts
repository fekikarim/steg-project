import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SupervisorHomeComponent } from './supervisor-home.component';
import { DashboardSummaryService } from '../dashboard/dashboard-summary.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { signInDemo } from '../../core/testing/demo-session';
import type { SupervisorDashboardSummary } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const SUMMARY: SupervisorDashboardSummary = {
  myCandidates: 2,
  candidatesByStatus: { IN_PROGRESS: 1, REPORT_SUBMITTED: 1, VALIDATED: 0 },
  tasksAwaitingApproval: 3,
  overdueTasks: 1,
  unreadNotifications: 2,
  recentNotifications: [{ id: 'n1', title: 'Task completed', createdAt: '2026-09-01T10:00:00Z' }],
};

/**
 * SupervisorHomeComponent (S11 supervisor dashboard): every tile renders the
 * ONE own-scope backend summary call
 * (`GET /api/reports/supervisor-summary`) — the client never computes numbers
 * from paged lists and never re-implements scope.
 */
describe('SupervisorHomeComponent (S11)', () => {
  async function setup(mode: 'ok' | 'throw' = 'ok') {
    let calls = 0;
    await TestBed.configureTestingModule({
      imports: [SupervisorHomeComponent],
      providers: [
        provideRouter([
          { path: 'candidates', component: StubComponent },
          { path: 'tasks', component: StubComponent },
          { path: 'notifications', component: StubComponent },
        ]),
        {
          provide: DashboardSummaryService,
          useValue: {
            supervisor: () => {
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
    signInDemo(auth, 'sup@steg.tn', 'SUPERVISOR');
    const fixture = TestBed.createComponent(SupervisorHomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls: () => calls };
  }

  it('renders one summary call as own-scope tiles', async () => {
    const { fixture, calls } = await setup();
    expect(calls()).toBe(1);
    const links = [...fixture.nativeElement.querySelectorAll('a.st-kpi')].map((a: Element) =>
      a.getAttribute('href'),
    );
    expect(links).toContain('/candidates');
    expect(links).toContain('/tasks?status=COMPLETED');
    expect(links).toContain('/tasks');
    expect(links).toContain('/notifications');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Task completed');
  });

  it('renders the candidates-by-status chart from the summary (CSS only)', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelectorAll('st-dist-bars').length).toBe(1);
  });

  it('renders error state with retry on failure', async () => {
    const { fixture, component } = await setup('throw');
    expect(component.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent as string).toContain('Retry');
  });
});
