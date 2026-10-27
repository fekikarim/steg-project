import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CandidateListComponent } from './candidate-list.component';
import { CandidatesService } from './candidates.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { CandidateQueueQuery, CandidateQueueRow } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const ROWS: CandidateQueueRow[] = [
  {
    id: 'c1',
    firstName: 'Amine',
    lastName: 'A1-2026',
    email: 'amine@example.tn',
    phone: null,
    speciality: 'Informatique',
    diploma: 'Licence',
    universityId: 'u1',
    universityName: 'ENIT',
    userId: 'acc-1',
    accountEnabled: true,
    applicationCount: 1,
    latestApplicationStatus: 'SUBMITTED',
    supervisorUserId: 's1',
    supervisorEmail: 'sup@steg.tn',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    version: 0,
  },
  {
    id: 'c2',
    firstName: 'Bilel',
    lastName: 'B2-2026',
    email: 'bilel@example.tn',
    phone: null,
    speciality: null,
    diploma: null,
    universityId: 'u1',
    universityName: 'ENIT',
    userId: null,
    accountEnabled: null,
    applicationCount: 0,
    latestApplicationStatus: null,
    supervisorUserId: null,
    supervisorEmail: null,
    createdAt: '2026-06-02T00:00:00Z',
    updatedAt: '2026-06-02T00:00:00Z',
    version: 0,
  },
];
const [CANDIDATE_ROW] = ROWS as [CandidateQueueRow, CandidateQueueRow];

describe('CandidateListComponent (workspace)', () => {
  async function setup(
    overrides: Record<string, unknown> = {},
    options: { canManage?: boolean; role?: 'ADMIN' | 'SUPERVISOR'; routeParams?: Record<string, string> } = {},
  ) {
    const canManage = options.canManage ?? true;
    const queries: CandidateQueueQuery[] = [];
    const calls = { remove: [] as string[], supervisors: 0, created: [] as unknown[] };
    const service: Record<string, unknown> = {
      search: (query: CandidateQueueQuery) => {
        queries.push(query);
        return of({ content: ROWS, totalElements: ROWS.length, totalPages: 1 });
      },
      universities: () => of([{ id: 'u1', code: 'ENIT', name: 'ENIT', active: true }]),
      supervisors: () => {
        calls.supervisors += 1;
        return of([{ userId: 's1', email: 'sup@steg.tn', role: 'SUPERVISOR' }]);
      },
      remove: (id: string) => {
        calls.remove.push(id);
        return of(undefined as void);
      },
      create: (body: unknown) => {
        calls.created.push(body);
        return of({
          id: 'c-new',
          firstName: 'New',
          lastName: 'Person',
          email: 'new@example.tn',
          phone: null,
          birthDate: null,
          address: null,
          speciality: null,
          diploma: null,
          skills: null,
          languages: null,
          nationalId: '12345678',
          universityId: 'u1',
          universityName: 'ENIT',
          userId: null,
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-01T00:00:00Z',
          version: 0,
        });
      },
      ...overrides,
    };
    Object.assign(service, overrides);
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [CandidateListComponent],
      providers: [
        provideRouter([
          { path: 'candidates', component: StubComponent },
          { path: 'applications/new', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(options.routeParams ?? {}) } },
        },
        { provide: CandidatesService, useValue: service },
        { provide: ToastService, useValue: { show: (...args: unknown[]) => toasts.push(args) } },
        {
          provide: AuthService,
          useValue: {
            hasPermission: (p: string) => canManage && p === 'USER_MANAGE',
            role: () => (options.role ?? (canManage ? 'ADMIN' : 'SUPERVISOR')),
            // The real RealtimeService watches auth; unauthenticated keeps it
            // disconnected so `candidateUpdates$` stays a quiet subject.
            isAuthenticated: () => false,
            getAccessToken: () => null,
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CandidateListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, queries, calls, toasts };
  }

  it('renders the server page returned for the default query', async () => {
    const { fixture, queries } = await setup();
    expect(queries[0]).toEqual({ page: 0, size: 20, sort: 'createdAt,desc' });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Amine A1-2026');
    expect(text).toContain('bilel@example.tn');
    expect(text).toContain('sup@steg.tn');
    expect(text).toContain('ENIT');
  });

  it('sends search, status, type, validation, university and dates to the server and resets the page', async () => {
    const { component, queries } = await setup();
    component.page.set(3);
    component.search = 'amine';
    component.status = 'SUBMITTED';
    component.type = 'PFE';
    component.validation = 'ACTIVE';
    component.university = 'ENIT';
    component.onFilter();
    component.onDates({ from: '2026-01-01', to: '2026-06-30' });

    expect(queries.at(-1)).toEqual({
      page: 0,
      size: 20,
      sort: 'createdAt,desc',
      q: 'amine',
      status: 'SUBMITTED',
      type: 'PFE',
      validation: 'ACTIVE',
      university: 'ENIT',
      from: '2026-01-01',
      to: '2026-06-30',
    });
  });

  it('offers the supervisor filter only to USER_MANAGE callers and loads the directory then', async () => {
    const { fixture, calls } = await setup();
    expect(calls.supervisors).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('sup@steg.tn');
    const selects: NodeListOf<HTMLSelectElement> =
      fixture.nativeElement.querySelectorAll('select');
    expect([...selects].length).toBeGreaterThan(0);
  });

  it('hides the supervisor filter for a Supervisor and never fetches the directory', async () => {
    const { fixture, calls } = await setup({}, { canManage: false });
    expect(calls.supervisors).toBe(0);
    const labels: string = fixture.nativeElement.textContent as string;
    // Column header stays (rendered), the filter select is what disappears.
    const selects: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('select');
    const hasSupervisorFilter = [...selects].some((s) =>
      (s.closest('label')?.textContent ?? '').includes('Superviseur'),
    );
    expect(hasSupervisorFilter).toBe(false);
    expect(labels).toContain('Amine'); // the queue itself still renders
  });

  it('asks the server for the next page instead of filtering locally', async () => {
    const { component, queries } = await setup();
    component.setPage(1);
    expect(queries.at(-1)?.page).toBe(1);
    // Still exactly one server page in the DOM — no client-side slicing.
    expect(queries.length).toBe(2);
  });

  it('maps column sort keys to backend sort properties', async () => {
    const { component, queries } = await setup();
    component.onSort({ key: 'name', direction: 'asc' });
    expect(queries.at(-1)?.sort).toBe('firstName,asc');

    component.onSort({ key: 'email', direction: 'desc' });
    expect(queries.at(-1)?.sort).toBe('email,desc');

    component.onSort({ key: 'universityName', direction: 'asc' });
    expect(queries.at(-1)?.sort).toBeUndefined();
  });

  it('confirms before deleting, then reloads and toasts', async () => {
    const { component, queries, calls, toasts, fixture } = await setup();
    const before = queries.length;

    component.askDelete(CANDIDATE_ROW);
    fixture.detectChanges();
    expect(component.deleting()?.id).toBe('c1');

    component.submitDelete();
    await fixture.whenStable();

    expect(calls.remove).toEqual(['c1']);
    expect(toasts.at(-1)).toEqual(['success', 'Profil candidat supprimé.']);
    expect(queries.length).toBe(before + 1);
    expect(component.deleting()).toBeNull();
  });

  it('surfaces the 409 dependency guard with its dedicated message', async () => {
    const { component, toasts } = await setup({
      remove: () =>
        throwError(() => ({
          status: 409,
          error: { error: 'CANDIDATE_HAS_DEPENDENCIES', message: 'has applications' },
        })),
    });

    component.askDelete(CANDIDATE_ROW);
    component.submitDelete();

    expect(toasts.at(-1)?.[0]).toBe('error');
    expect(String(toasts.at(-1)?.[1])).toContain('candidatures');
  });

  it('shows the error state with the server message when the queue fails', async () => {
    const { fixture } = await setup({
      search: () => throwError(() => ({ error: { message: 'boom' } })),
    });
    expect(fixture.componentInstance.error()).toBe(true);
    expect(fixture.componentInstance.serverMessage()).toBe('boom');
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Amine');
  });

  it('shows the empty state when the server returns no rows', async () => {
    const { fixture } = await setup({
      search: () => of({ content: [], totalElements: 0, totalPages: 0 }),
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Amine');
    expect(fixture.componentInstance.rows().length).toBe(0);
  });

  /* ---------------- candidate creation ---------------- */

  it('links to /applications/new to add candidate with manual intake application', async () => {
    const { fixture } = await setup();
    const link = fixture.nativeElement.querySelector('a[routerLink="/applications/new"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('routerLink')).toBe('/applications/new');
  });

  it('applies the dashboard new-candidates drill-down as a server-side date filter', async () => {
    const { queries } = await setup({}, { routeParams: { from: '2026-09-04' } });
    expect(queries[0]).toMatchObject({ page: 0, from: '2026-09-04' });
  });

  it('ignores a malformed date preset instead of sending it', async () => {
    const { queries } = await setup({}, { routeParams: { from: 'not-a-date' } });
    expect(queries[0]).toEqual({ page: 0, size: 20, sort: 'createdAt,desc' });
  });
});
