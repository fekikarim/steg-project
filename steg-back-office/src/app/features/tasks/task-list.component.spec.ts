import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TaskListComponent } from './task-list.component';
import { TasksService } from './tasks.service';
import { ToastService } from '../../shared/ui/toast.service';
import { ApiClient } from '../../core/api-client.service';
import { I18nService } from '../../core/i18n.service';
import type { CompanionTask } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const T1: CompanionTask = {
  id: 't1',
  internshipId: 'int-A',
  createdById: 'u1',
  createdByEmail: 'admin@steg.tn',
  assignedToId: null,
  assignedToEmail: null,
  title: 'Write report',
  description: 'Draft first',
  status: 'COMPLETED',
  dueDate: null,
  completedAt: '2026-06-01T00:00:00Z',
  reviewReason: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};
const T2: CompanionTask = {
  ...T1,
  id: 't2',
  internshipId: 'int-B',
  title: 'Fix figures',
  status: 'TODO',
};

/**
 * TaskListComponent (S6c workspace): groups the scoped server page by
 * student, approves/denies (deny needs a reason), adds/edits/deletes, and
 * runs bulk delete atomically with one idempotency key per operation.
 */
describe('TaskListComponent (workspace)', () => {
  async function setup(
    overrides: Record<string, unknown> = {},
    options: { routeParams?: Record<string, string> } = {},
  ) {
    const calls: {
      reviewed: unknown[];
      bulk: unknown[];
      removed: string[];
      added: unknown[];
      listed: unknown[];
    } = {
      reviewed: [],
      bulk: [],
      removed: [],
      added: [],
      listed: [],
    };
    const service: Record<string, unknown> = {
      list: (page: number, size: number, status?: string) => {
        calls.listed.push([page, size, status]);
        return of({ content: [T1, T2], totalElements: 2, totalPages: 1 });
      },
      review: (id: string, approve: boolean, reason?: string) => {
        calls.reviewed.push([id, approve, reason]);
        return of({ ...T1, id, status: approve ? 'APPROVED' : 'DENIED' } as CompanionTask);
      },
      bulk: (mutations: unknown, key: string) => {
        calls.bulk.push([mutations, key]);
        return of({ tasks: [], deletedCount: 2, items: [] });
      },
      remove: (id: string) => {
        calls.removed.push(id);
        return of(undefined as void);
      },
      add: (internshipId: string, body: unknown) => {
        calls.added.push([internshipId, body]);
        return of({ ...T1, id: 't-new' });
      },
      edit: (id: string) => of({ ...T1, id }),
      ...overrides,
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [TaskListComponent],
      providers: [
        { provide: TasksService, useValue: service },
        { provide: ApiClient, useValue: { listInternships: () => of([]) } },
        { provide: ToastService, useValue: { show: (...a: unknown[]) => toasts.push(a) } },
        // TaskListComponent links to the drafts workspace (S10c); RouterLink
        // needs a router in the harness — stub routes, no navigation asserted.
        provideRouter([{ path: 'tasks/drafts', component: StubComponent }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(options.routeParams ?? {}) } },
        },
      ],
    }).compileComponents();
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('fr');
    const fixture = TestBed.createComponent(TaskListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls, toasts };
  }

  it('groups the server page by student (one section per internship)', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Write report');
    expect(text).toContain('Fix figures');
    const sections = fixture.nativeElement.querySelectorAll('section.st-group');
    expect(sections.length).toBe(2);
  });

  it('shows approve/deny only for completed tasks', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Approuver');
    // T2 is TODO: no second approve button pair.
    const approves = [...fixture.nativeElement.querySelectorAll('button')].filter(
      (b: HTMLElement) => b.textContent?.includes('Approuver'),
    );
    expect(approves.length).toBe(1);
  });

  it('approves through the review endpoint without a reason', async () => {
    const { component, calls } = await setup();
    component.approve(T1);
    expect(calls.reviewed).toEqual([['t1', true, undefined]]);
  });

  it('refuses to deny without a reason (client-side, before any HTTP)', async () => {
    const { component, calls } = await setup();
    component.openDeny(T1);
    component.denyReason = '   ';
    component.confirmDeny();
    expect(calls.reviewed).toEqual([]);
    expect(component.denyError()).toBeTruthy();
  });

  it('denies with the trimmed reason', async () => {
    const { component, calls } = await setup();
    component.openDeny(T1);
    component.denyReason = 'Missing figures';
    component.confirmDeny();
    expect(calls.reviewed).toEqual([['t1', false, 'Missing figures']]);
  });

  it('requires a title to save the add/edit form', async () => {
    const { component, calls } = await setup();
    component.openAdd('int-A');
    component.formTitle = '   ';
    component.saveForm();
    expect(calls.added).toEqual([]);
    expect(component.formError()).toBeTruthy();
  });

  it('requires an internship for a new task', async () => {
    const { component, calls } = await setup();
    component.openAdd('');
    component.formTitle = 'Something';
    component.saveForm();
    expect(calls.added).toEqual([]);
  });

  it('bulk delete sends one atomic call with one idempotency key', async () => {
    const { component, calls } = await setup();
    component.toggleSelect('t1');
    component.toggleSelect('t2');
    component.openBulkDelete();
    component.confirmBulkDelete();
    expect(calls.bulk.length).toBe(1);
    const [mutations, key] = calls.bulk[0] as [unknown[], string];
    expect(mutations).toHaveLength(2);
    expect(key).toBeTruthy();
  });

  it('bulk add sends one CREATE mutation per checked student with one key', async () => {
    const { component, calls } = await setup();
    component.openBulkAdd();
    component.bulkTitle = 'Shared reading';
    component.toggleBulkTarget('int-A');
    component.toggleBulkTarget('int-B');
    component.confirmBulkAdd();
    expect(calls.bulk.length).toBe(1);
    const [mutations, key] = calls.bulk[0] as [{ action: string; internshipId: string }[], string];
    expect(mutations).toHaveLength(2);
    expect(mutations.every((m) => m.action === 'CREATE')).toBe(true);
    expect(new Set(mutations.map((m) => m.internshipId))).toEqual(new Set(['int-A', 'int-B']));
    expect(key).toBeTruthy();
  });

  it('bulk add refuses an empty title or no target before any HTTP', async () => {
    const { component, calls } = await setup();
    component.openBulkAdd();
    component.bulkTitle = '   ';
    component.toggleBulkTarget('int-A');
    component.confirmBulkAdd();
    component.bulkTitle = 'OK title';
    component.toggleBulkTarget('int-A');
    component.confirmBulkAdd();
    expect(calls.bulk).toEqual([]);
    expect(component.bulkError()).toBeTruthy();
  });

  it('bulk edit sends one UPDATE mutation per selected task with one key', async () => {
    const { component, calls } = await setup();
    component.toggleSelect('t1');
    component.toggleSelect('t2');
    component.openBulkEdit();
    component.bulkTitle = 'Renamed sprint';
    component.confirmBulkEdit();
    expect(calls.bulk.length).toBe(1);
    const [mutations, key] = calls.bulk[0] as [{ action: string; taskId: string }[], string];
    expect(mutations).toHaveLength(2);
    expect(mutations.every((m) => m.action === 'UPDATE')).toBe(true);
    expect(new Set(mutations.map((m) => m.taskId))).toEqual(new Set(['t1', 't2']));
    expect(key).toBeTruthy();
  });

  it('disables bulk delete with an empty selection', async () => {
    const { fixture } = await setup();
    const btn = [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLElement) =>
      b.textContent?.includes('Supprimer la sélection'),
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('surfaces load failures with a retry', async () => {
    const { fixture } = await setup({
      list: () => throwError(() => ({ error: { message: 'Down' } })),
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Down');
  });

  it('links to the AI drafts review workspace (S10c)', async () => {
    const { fixture } = await setup();
    const link = fixture.nativeElement.querySelector(
      'a[href="/tasks/drafts"]',
    ) as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
  });

  it('applies the dashboard drill-down preset as a server-side status filter', async () => {
    const { component, calls } = await setup({}, { routeParams: { status: 'COMPLETED' } });
    expect(component.status).toBe('COMPLETED');
    expect(calls.listed[0]).toEqual([0, 50, 'COMPLETED']);
  });

  it('ignores an unknown status preset instead of sending it', async () => {
    const { component, calls } = await setup({}, { routeParams: { status: 'BOGUS' } });
    expect(component.status).toBe('');
    expect(calls.listed[0]).toEqual([0, 50, undefined]);
  });

  it('openBulkEdit fetches and populates selected tasks into bulkEditItems', async () => {
    const { component } = await setup();
    component.toggleSelect('t1');
    component.toggleSelect('t2');
    component.openBulkEdit();
    expect(component.bulkEditItems()).toHaveLength(2);
    expect(component.bulkEditItems()[0]?.title).toBe('Write report');
    expect(component.bulkEditItems()[1]?.title).toBe('Fix figures');
  });

  it('openAdd with specific internship hides candidate selection and targets that candidate', async () => {
    const { component } = await setup();
    component.openAdd('int-A');
    expect(component.isSpecificStudentAdd()).toBe(true);
    expect(component.formCandidates().has('int-A')).toBe(true);
    expect(component.formInternship).toBe('int-A');
  });

  it('header openAdd allows selecting multiple candidates and saves via bulk CREATE', async () => {
    const { component, calls } = await setup();
    component.openAdd();
    expect(component.isSpecificStudentAdd()).toBe(false);
    component.formTitle = 'Global onboarding task';
    component.formDesc = 'Review security policy';
    component.toggleCandidateSelect('int-A');
    component.toggleCandidateSelect('int-B');
    component.saveForm();
    expect(calls.bulk.length).toBe(1);
    const [mutations, key] = calls.bulk[0] as [
      { action: string; internshipId: string; task: { title: string } }[],
      string,
    ];
    expect(mutations).toHaveLength(2);
    expect(
      mutations.every((m) => m.action === 'CREATE' && m.task.title === 'Global onboarding task'),
    ).toBe(true);
    expect(new Set(mutations.map((m) => m.internshipId))).toEqual(new Set(['int-A', 'int-B']));
    expect(key).toBeTruthy();
  });

  it('confirmBulkDelete clears selected tasks upon completion', async () => {
    const { component } = await setup();
    component.toggleSelect('t1');
    component.toggleSelect('t2');
    expect(component.selected().size).toBe(2);
    component.openBulkDelete();
    component.confirmBulkDelete();
    expect(component.selected().size).toBe(0);
  });
});
