import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SupervisorListComponent } from './supervisor-list.component';
import { SupervisorManagementService } from './supervisor-management.service';
import { ToastService } from '../../shared/ui/toast.service';
import type {
  InternshipDetail,
  InternshipStatus,
  SupervisorQueueQuery,
  SupervisorRow,
} from '../../core/api-models';

const ROWS: SupervisorRow[] = [
  {
    id: 'u1',
    email: 'amina@steg.tn',
    role: 'SUPERVISOR',
    status: 'ACTIVE',
    enabled: true,
    activeAssignmentsCount: 2,
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'u2',
    email: 'bilel@steg.tn',
    role: 'SUPERVISOR',
    status: 'INACTIVE',
    enabled: false,
    activeAssignmentsCount: 0,
    createdAt: '2026-02-03T00:00:00Z',
  },
];
const [ACTIVE_ROW, FREE_ROW] = ROWS as [SupervisorRow, SupervisorRow];

function internship(id: string, reference: string, status: InternshipStatus): InternshipDetail {
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

/** Minimal server stand-in: filtering happens SERVER-side, like the backend. */
function fakeSearch(query: SupervisorQueueQuery) {
  let content = [...ROWS];
  if (query.status) content = content.filter((r) => r.status === query.status);
  if (query.q) {
    const q = query.q.toLowerCase();
    content = content.filter((r) => r.email.toLowerCase().includes(q));
  }
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: query.page,
    size: query.size,
  };
}

describe('SupervisorListComponent (management workspace)', () => {
  async function setup(overrides: Record<string, unknown> = {}) {
    const queries: SupervisorQueueQuery[] = [];
    const calls = {
      create: [] as unknown[][],
      update: [] as unknown[][],
      remove: [] as unknown[][],
      assign: [] as unknown[][],
      reassign: [] as unknown[][],
    };
    const service = {
      search: (query: SupervisorQueueQuery) => {
        queries.push(query);
        return of(fakeSearch(query));
      },
      create: (...args: unknown[]) => {
        calls.create.push(args);
        return of({ email: 'new@steg.tn', temporaryPassword: 'Aa1!bbbbcccc', emailSent: true });
      },
      update: (...args: unknown[]) => {
        calls.update.push(args);
        return of(ACTIVE_ROW);
      },
      remove: (...args: unknown[]) => {
        calls.remove.push(args);
        return of(undefined as void);
      },
      assign: (...args: unknown[]) => {
        calls.assign.push(args);
        return of(undefined as void);
      },
      reassign: (...args: unknown[]) => {
        calls.reassign.push(args);
        return of(undefined as void);
      },
      assignableInternships: () =>
        of([internship('i1', 'STG-2026-0001', 'IN_PROGRESS'), internship('i2', 'STG-2026-0002', 'CANCELLED')]),
      directory: () => of([{ userId: 'u1', email: 'admin@steg.tn', role: 'ADMIN' }]),
      ...overrides,
    };
    await TestBed.configureTestingModule({
      imports: [SupervisorListComponent],
      providers: [{ provide: SupervisorManagementService, useValue: service }],
    }).compileComponents();
    const fixture = TestBed.createComponent(SupervisorListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, queries, calls };
  }

  it('renders the server page returned for the default query', async () => {
    const { fixture, queries } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('amina@steg.tn');
    expect(text).toContain('bilel@steg.tn');
    expect(queries[0]).toEqual({ page: 0, size: 20, sort: 'email,asc', q: undefined, status: undefined });
  });

  it('sends search and status filters to the server and resets the page', async () => {
    const { fixture, queries } = await setup();
    const component = fixture.componentInstance;
    component.search.set('amina');
    component.status.set('ACTIVE');
    component.onFilter();

    expect(queries.at(-1)).toMatchObject({ q: 'amina', status: 'ACTIVE', page: 0 });
    expect(component.rows().length).toBe(1);
    expect(component.rows()[0]?.email).toBe('amina@steg.tn');
  });

  it('asks the server for the next page instead of filtering locally', async () => {
    const { fixture, queries } = await setup();
    fixture.componentInstance.setPage(1);
    expect(queries.at(-1)?.page).toBe(1);
    fixture.componentInstance.setPage(-3);
    expect(queries.at(-1)?.page).toBe(0);
  });

  it('maps column sort keys to backend sort properties', async () => {
    const { fixture, queries } = await setup();
    const component = fixture.componentInstance;
    component.onSort({ key: 'status', direction: 'desc' });
    expect(queries.at(-1)?.sort).toBe('status,desc');
    component.onSort({ key: 'createdAt', direction: 'asc' });
    expect(queries.at(-1)?.sort).toBe('createdAt,asc');
    // Role is not a backend property: no sort parameter is sent at all.
    component.onSort({ key: 'role', direction: 'asc' });
    expect(queries.at(-1)?.sort).toBeUndefined();
  });

  it('exposes only explicit IAM statuses in the filter', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.statuses).toEqual(['ACTIVE', 'INACTIVE', 'LOCKED']);
  });

  it('shows the one-time password once after creation and drops it on close', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.openCreate();
    component.createEmail = '  new@steg.tn ';
    component.submitCreate();

    expect(calls.create[0]).toEqual(['new@steg.tn']);
    expect(component.credentials()).toEqual({
      email: 'new@steg.tn',
      password: 'Aa1!bbbbcccc',
      emailSent: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Aa1!bbbbcccc');

    component.closeCredentials();
    expect(component.credentials()).toBeNull();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Aa1!bbbbcccc');
  });

  it('refuses to submit an invalid email', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.openCreate();
    component.createEmail = 'not-an-email';
    component.submitCreate();
    expect(calls.create).toHaveLength(0);
    expect(component.busy()).toBe(false);
  });

  it('sends the edited status and enabled flag', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.openEdit(ACTIVE_ROW);
    component.editStatus = 'INACTIVE';
    component.editEnabled = false;
    component.submitEdit();

    expect(calls.update[0]).toEqual(['u1', { status: 'INACTIVE', enabled: false }]);
    expect(component.editing()).toBeNull();
  });

  it('deletes a supervisor without active assignments', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.askDelete(FREE_ROW);
    component.submitDelete();

    expect(calls.remove[0]).toEqual(['u2']);
    expect(component.deleting()).toBeNull();
  });

  it('shows the reassignment message when the backend refuses with 409 active assignments', async () => {
    const conflict = {
      status: 409,
      error: { errorCode: 'SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS', message: 'busy' },
    };
    const { fixture } = await setup({ remove: () => throwError(() => conflict) });
    const component = fixture.componentInstance;
    component.askDelete(ACTIVE_ROW);
    component.submitDelete();

    const toast = TestBed.inject(ToastService);
    const last = toast.toasts().at(-1);
    expect(last?.kind).toBe('error');
    expect(last?.message).toBe(component.i18n.t('supervisors.hasAssignments'));
    expect(component.deleting()).toBeNull();
  });

  it('assigns the selected internship to the supervisor', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.openAssign(ACTIVE_ROW);
    expect(component.assignTarget()?.id).toBe('u1');
    // The picker renders exactly what the service offers (its own filtering
    // of cancelled/archived internships is proven in the service spec).
    expect(component.internships().map((i) => i.id)).toEqual(['i1', 'i2']);

    component.assignInternshipId = 'i1';
    component.submitAssign();
    expect(calls.assign[0]).toEqual(['u1', 'i1']);
    expect(component.assignTarget()).toBeNull();
  });

  it('lets an Admin be chosen as the new supervisor', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.openReassign(ACTIVE_ROW);
    expect(component.directory().map((d) => d.role)).toEqual(['ADMIN']);

    component.reassignInternshipId = 'i1';
    component.reassignSupervisorId = 'u1';
    component.reassignReason = ' leave ';
    component.submitReassign();

    expect(calls.reassign[0]).toEqual(['u1', 'i1', ' leave ']);
    expect(component.reassignTarget()).toBeNull();
  });

  it('shows the empty state when the server returns no supervisors', async () => {
    const { fixture } = await setup({ search: () => of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }) });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      fixture.componentInstance.i18n.t('common.empty.title'),
    );
  });
});