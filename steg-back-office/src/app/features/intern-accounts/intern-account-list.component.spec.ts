import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InternAccountListComponent } from './intern-account-list.component';
import { InternAccountsService } from './intern-accounts.service';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { InternAccountQueueQuery, InternAccountRow } from '../../core/api-models';

const ROWS: InternAccountRow[] = [
  {
    id: 'u1',
    email: 'amina@steg.tn',
    roles: ['INTERN'],
    status: 'ACTIVE',
    enabled: true,
    mustChangePassword: true,
    fullName: 'Amina Ben Salah',
    candidateId: 'c1',
    internshipId: 'i1',
    createdAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'u2',
    email: 'bilel@steg.tn',
    roles: ['SUPERVISOR'],
    status: 'INACTIVE',
    enabled: false,
    mustChangePassword: false,
    fullName: null,
    candidateId: null,
    internshipId: null,
    createdAt: '2026-02-03T00:00:00Z',
  },
];
const [INTERN_ROW, SUPERVISOR_ROW] = ROWS as [InternAccountRow, InternAccountRow];

/** Minimal server stand-in: filtering happens SERVER-side, like the backend. */
function fakeSearch(query: InternAccountQueueQuery) {
  let content = [...ROWS];
  if (query.role) content = content.filter((r) => r.roles.includes(query.role as string));
  if (query.status) content = content.filter((r) => r.status === query.status);
  if (query.q) {
    const q = query.q.toLowerCase();
    content = content.filter(
      (r) =>
        r.email.toLowerCase().includes(q) || (r.fullName ?? '').toLowerCase().includes(q),
    );
  }
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: query.page,
    size: query.size,
  };
}

describe('InternAccountListComponent (workspace)', () => {
  async function setup(overrides: Record<string, unknown> = {}) {
    const queries: InternAccountQueueQuery[] = [];
    const calls = {
      create: [] as unknown[][],
      update: [] as unknown[][],
      reset: [] as unknown[][],
      activate: [] as unknown[][],
      deactivate: [] as unknown[][],
      remove: [] as unknown[][],
    };
    const service = {
      search: (query: InternAccountQueueQuery) => {
        queries.push(query);
        return of(fakeSearch(query));
      },
      create: (...args: unknown[]) => {
        calls.create.push(args);
        return of({ email: 'new@steg.tn', temporaryPassword: 'Aa1!bbbbcccc', emailSent: true });
      },
      update: (...args: unknown[]) => {
        calls.update.push(args);
        return of(INTERN_ROW);
      },
      resetPassword: (...args: unknown[]) => {
        calls.reset.push(args);
        return of({ email: INTERN_ROW.email, temporaryPassword: 'Zz9!rewritten', emailSent: true });
      },
      activate: (...args: unknown[]) => {
        calls.activate.push(args);
        return of(INTERN_ROW);
      },
      deactivate: (...args: unknown[]) => {
        calls.deactivate.push(args);
        return of(INTERN_ROW);
      },
      remove: (...args: unknown[]) => {
        calls.remove.push(args);
        return of(undefined as void);
      },
      ...overrides,
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [InternAccountListComponent],
      providers: [
        { provide: InternAccountsService, useValue: service },
        { provide: ToastService, useValue: { show: (...args: unknown[]) => toasts.push(args) } },
      ],
    }).compileComponents();
    // The assertions below are French: pin the locale so a sibling spec that
    // called setLocale('en') cannot leak through the shared jsdom localStorage.
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(InternAccountListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, queries, calls, toasts };
  }

  it('renders the server page returned for the default query', async () => {
    const { fixture, queries } = await setup();
    expect(queries[0]).toEqual({ page: 0, size: 20, sort: 'email,asc' });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('amina@steg.tn');
    expect(text).toContain('bilel@steg.tn');
    expect(text).toContain('Amina Ben Salah');
    expect(text).toContain('Étudiant (interne)');
    expect(text).toContain('Superviseur');
  });

  it('sends search, role and status filters to the server and resets the page', async () => {
    const { component, queries } = await setup();
    component.page.set(3);
    component.search.set('amina');
    component.role.set('INTERN');
    component.status.set('ACTIVE');
    component.onFilter();
    expect(queries.at(-1)).toEqual({
      page: 0,
      size: 20,
      sort: 'email,asc',
      q: 'amina',
      role: 'INTERN',
      status: 'ACTIVE',
    });
  });

  it('asks the server for the next page instead of filtering locally', async () => {
    const { component, queries } = await setup();
    component.setPage(1);
    expect(queries.at(-1)?.page).toBe(1);
  });

  it('maps column sort keys to backend sort properties', async () => {
    const { component, queries } = await setup();
    component.onSort({ key: 'createdAt', direction: 'desc' });
    expect(queries.at(-1)?.sort).toBe('createdAt,desc');
    component.onSort({ key: 'fullName', direction: 'asc' });
    // Not whitelisted: the sort parameter is omitted and the backend falls back to email ASC.
    expect(queries.at(-1)?.sort).toBeUndefined();
  });

  it('shows the one-time password once after creating an account and drops it on close', async () => {
    const { component, calls } = await setup();
    component.openCreate();
    component.createEmail = 'new@steg.tn';
    component.createRole = 'INTERN';
    component.submitCreate();

    expect(calls.create[0]).toEqual(['new@steg.tn', 'INTERN']);
    expect(component.credentials()?.password).toBe('Aa1!bbbbcccc');
    expect(component.credentials()?.email).toBe('new@steg.tn');

    component.closeCredentials();
    expect(component.credentials()).toBeNull();
  });

  it('resets the password and swaps the displayed secret in the shared dialog', async () => {
    const { component, calls } = await setup();
    component.askReset(INTERN_ROW);
    component.submitReset();

    expect(calls.reset[0]).toEqual([INTERN_ROW.id]);
    expect(component.credentials()?.password).toBe('Zz9!rewritten');
    component.closeCredentials();
    expect(component.credentials()).toBeNull();
  });

  it('clears the reset dialog when the backend fails (email/account errors are non-destructive)', async () => {
    const { component } = await setup({
      resetPassword: () => throwError(() => ({ status: 500, error: { message: 'boom' } })),
    });
    component.askReset(INTERN_ROW);
    component.submitReset();
    expect(component.resetting()).toBeNull();
    expect(component.credentials()).toBeNull();
  });

  it('activates and deactivates through the status API and reloads the page', async () => {
    const { component, calls } = await setup();
    component.activate(SUPERVISOR_ROW);
    component.deactivate(INTERN_ROW);
    expect(calls.activate[0]).toEqual([SUPERVISOR_ROW.id]);
    expect(calls.deactivate[0]).toEqual([INTERN_ROW.id]);
  });

  it('submits status and enabled from the edit dialog', async () => {
    const { component, calls } = await setup();
    component.openEdit(SUPERVISOR_ROW);
    expect(component.editStatus).toBe('INACTIVE');
    expect(component.editEnabled).toBe(false);
    component.editStatus = 'ACTIVE';
    component.editEnabled = true;
    component.submitEdit();
    expect(calls.update[0]).toEqual([SUPERVISOR_ROW.id, { status: 'ACTIVE', enabled: true }]);
    expect(component.editing()).toBeNull();
  });

  it('surfaces the reassignment-first message when delete is refused with 409', async () => {
    const { component, toasts, queries } = await setup({
      remove: () =>
        throwError(() => ({
          status: 409,
          error: { errorCode: 'SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS', message: 'busy' },
        })),
    });
    const before = queries.length;
    component.askDelete(SUPERVISOR_ROW);
    component.submitDelete();
    expect(component.deleting()).toBeNull();
    const lastToast = toasts.at(-1) as string[];
    expect(lastToast[0]).toBe('error');
    expect(lastToast[1]).toContain('réaffectez');
    // A refused delete does not force a pointless reload.
    expect(queries.length).toBe(before);
  });

  it('deletes successfully and refreshes the server page', async () => {
    const { component, calls, queries } = await setup();
    const before = queries.length;
    component.askDelete(INTERN_ROW);
    component.submitDelete();
    expect(calls.remove[0]).toEqual([INTERN_ROW.id]);
    expect(queries.length).toBe(before + 1);
  });
});
