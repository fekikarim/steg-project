import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SupervisorDashboardComponent } from './supervisor-dashboard.component';
import { InternshipService } from './internship.service';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import type {
  CompanionTask,
  EvaluationItem,
  EvaluationType,
  InternshipAssignment,
  InternshipDetail,
  InternshipStatus,
  JournalEntry,
  JournalEntryStatus,
  Page,
  TaskStatus,
} from '../../core/api-models';
import { signInDemo } from '../../core/testing/demo-session';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

function internship(
  id: string,
  reference: string,
  name: string,
  status: InternshipStatus,
): InternshipDetail {
  return {
    id,
    reference,
    startDate: '2026-01-05',
    endDate: '2026-06-30',
    status,
    type: 'PFE',
    requirement: 'OBLIGATOIRE',
    paymentEligible: true,
    subject: 'Suivi de stages',
    academicLevel: 'ENGINEERING',
    candidateId: `cand-${id}`,
    candidateFullName: name,
    applicationId: `app-${id}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 1,
  };
}

const ROWS: InternshipDetail[] = [
  internship('ship-42', 'STAGE-2026-000042', 'Sami Ben Ali', 'VALIDATED'),
  internship('ship-43', 'STAGE-2026-000043', 'Nour Trabelsi', 'IN_PROGRESS'),
];

function assignment(internshipId: string, name: string): InternshipAssignment {
  return {
    id: `as-${internshipId}`,
    internshipId,
    departmentId: 'dep-1',
    departmentName: 'DSI',
    supervisorId: `emp-${internshipId}`,
    supervisorName: name,
    assignedById: 'emp-9',
    assignedByName: 'HR Karim',
    assignedAt: '2026-01-05',
    startDate: '2026-01-05',
    endDate: '2026-06-30',
    status: 'ACTIVE',
    assignmentReason: 'Encadrement',
    endedAt: null,
    createdAt: '2026-01-05T00:00:00Z',
    version: 1,
  };
}

function page<T>(content: T[]): Page<T> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 };
}

function task(id: string, status: TaskStatus): CompanionTask {
  return {
    id,
    internshipId: 'ship-42',
    createdById: null,
    createdByEmail: null,
    assignedToId: null,
    assignedToEmail: null,
    title: `Tâche ${id}`,
    description: null,
    status,
    dueDate: null,
    completedAt: null,
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  };
}

function journal(id: string, status: JournalEntryStatus): JournalEntry {
  return {
    id,
    journalId: null,
    authorId: null,
    authorEmail: null,
    validatedById: null,
    validatedByName: null,
    title: `Semaine ${id}`,
    description: null,
    status,
    entryDate: '2026-02-07',
    submittedAt: null,
    validatedAt: null,
    createdAt: '2026-02-07T00:00:00Z',
    updatedAt: '2026-02-07T00:00:00Z',
  };
}

function evaluation(id: string, type: EvaluationType): EvaluationItem {
  return {
    id,
    internshipId: 'ship-43',
    evaluatorId: null,
    evaluatorEmail: null,
    templateId: null,
    templateName: null,
    type,
    evaluationDate: '2026-06-30',
    feedback: null,
    totalScore: null,
    createdAt: '2026-06-30T00:00:00Z',
    updatedAt: '2026-06-30T00:00:00Z',
  };
}

describe('SupervisorDashboardComponent', () => {
  async function setup() {
    localStorage.removeItem('st-mine-supervisor');
    await TestBed.configureTestingModule({
      imports: [SupervisorDashboardComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'supervisor-dashboard', component: StubComponent },
          { path: 'internships', component: StubComponent },
          { path: 'internships/:id', component: StubComponent },
          { path: 'finance/:id', component: StubComponent },
        ]),
        {
          provide: ApiClient,
          useValue: {
            listInternships: () => of(ROWS),
            listFinanceCases: () => of(page([])),
            listTasks: (id: string) =>
              of(
                page(
                  id === 'ship-43'
                    ? [task('t1', 'COMPLETED'), task('t2', 'TODO')]
                    : [task('t1', 'COMPLETED')],
                ),
              ),
            listJournalEntries: (id: string) =>
              of(
                page(
                  id === 'ship-43' ? [journal('j1', 'SUBMITTED')] : [journal('j1', 'VALIDATED')],
                ),
              ),
            // ship-42 completed with no FINAL report, ship-43 has a mid-term one.
            listEvaluations: (id: string) =>
              of(page(id === 'ship-43' ? [evaluation('e1', 'MID_TERM')] : [])),
            getCandidate: () => of({}),
          },
        },
        {
          provide: InternshipService,
          useValue: {
            loadAssignmentMap: (ids: string[]) => {
              const map = new Map<string, InternshipAssignment[]>();
              for (const id of ids) {
                map.set(id, [assignment(id, 'Leila Mansour')]);
              }
              return of(map);
            },
          },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(SupervisorDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('no longer renders the "Needs attention first" alert block', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Needs attention first');
    expect(fixture.nativeElement.querySelector('st-alert')).toBeNull();
    // The triage surface replaced it: filter + per-row flag + the missing badge.
    expect(text).toContain('Action required');
    expect(text).toContain('Missing');
  });

  it('flags the intern awaiting a final evaluation and keeps the row in the table', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    const flagged = component.attention().map((r) => r.candidateFullName);
    // Sami: completed without a FINAL report. Nour: journal entry still to review.
    expect(flagged).toEqual(['Sami Ben Ali', 'Nour Trabelsi']);
    expect(component.awaitingEvaluation()).toBe(1);
    const rows = [...fixture.nativeElement.querySelectorAll('tbody tr')];
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.querySelector('tbody tr.st-row--attn')).toBeTruthy();
  });

  it('renders the supervision table through the shared data-table component', async () => {
    const fixture = await setup();
    const table = fixture.nativeElement.querySelector('st-data-table table.st-table');
    expect(table).toBeTruthy();
    const headers = [...fixture.nativeElement.querySelectorAll('thead th')].map((th: Element) =>
      (th.textContent ?? '').trim(),
    );
    expect(headers[0]).toBe('Intern');
    expect(headers.join(' ')).toContain('Journal');
    expect(fixture.nativeElement.querySelector('st-pagination')).toBeTruthy();
  });

  it('triage filter narrows to the interns needing action', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.filtered().length).toBe(2);
    component.setView('attention');
    fixture.detectChanges();
    expect(component.filtered().length).toBe(2);
    component.setView('all');
    fixture.detectChanges();
    expect(component.page()).toBe(0);
  });

  it('sorts by column and keeps the attention flag first by default', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.sort()).toEqual({ key: 'flag', direction: 'desc' });
    // Default triage order: flagged rows first, alphabetical within a flag level
    // (both fixtures need action, hence the name order).
    expect(component.filtered().map((r) => r.candidateFullName)).toEqual([
      'Nour Trabelsi',
      'Sami Ben Ali',
    ]);
    component.onSort({ key: 'candidate', direction: 'asc' });
    expect(component.filtered()[0]?.candidateFullName).toBe('Nour Trabelsi');
    // Journal: Sami has nothing pending, Nour has one entry to review.
    component.onSort({ key: 'journal', direction: 'desc' });
    expect(component.filtered()[0]?.candidateFullName).toBe('Nour Trabelsi');
    // Tasks: Nour still has one open task.
    component.onSort({ key: 'tasks', direction: 'desc' });
    expect(component.filtered()[0]?.candidateFullName).toBe('Nour Trabelsi');
  });
});
