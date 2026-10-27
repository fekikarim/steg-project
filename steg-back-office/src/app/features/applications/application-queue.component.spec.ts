import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationsComponent } from './application-queue.component';
import { ApplicationQueueStore } from './application-queue-store';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import type {
  ApplicationQueueQuery,
  ApplicationQueueRow,
} from '../../core/api-models';
import { signInDemo } from '../../core/testing/demo-session';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const ROWS: ApplicationQueueRow[] = [
  {
    id: 'a1',
    reference: 'APP-2026-0001',
    status: 'SUBMITTED',
    candidateId: 'c1',
    candidateName: 'Sara Ben Ammar',
    candidateEmail: 'sara@example.tn',
    universityName: 'ENIT',
    submittedOnline: true,
    submissionDate: '2026-06-01',
    calculatedType: 'PERFECTIONNEMENT',
    requirement: 'OBLIGATOIRE',
    rejectionReason: null,
    correctionComment: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    version: 0,
  },
  {
    id: 'a2',
    reference: 'APP-2026-0002',
    status: 'MODIFICATION_REQUESTED',
    candidateId: 'c2',
    candidateName: 'Omar Trabelsi',
    candidateEmail: 'omar@example.tn',
    universityName: 'INSAT',
    submittedOnline: false,
    submissionDate: '2026-06-02',
    calculatedType: 'OBSERVATION',
    requirement: 'OPTIONAL',
    rejectionReason: null,
    correctionComment: 'Blurry scan',
    createdAt: '2026-06-02T00:00:00Z',
    updatedAt: '2026-06-02T00:00:00Z',
    version: 0,
  },
];

const CANDIDATES = [
  { id: 'c1', universityName: 'ENIT' },
  { id: 'c2', universityName: 'INSAT' },
];

/** Minimal server stand-in: filtering happens SERVER-side, like the backend. */
function fakeSearch(query: ApplicationQueueQuery): { content: ApplicationQueueRow[]; totalElements: number; totalPages: number; number: number; size: number } {
  let rows = [...ROWS];
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.q) {
    const q = query.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        r.candidateName.toLowerCase().includes(q) ||
        (r.candidateEmail ?? '').toLowerCase().includes(q),
    );
  }
  return {
    content: rows,
    totalElements: rows.length,
    totalPages: 1,
    number: query.page,
    size: query.size,
  };
}

describe('ApplicationsComponent (queue)', () => {
  async function setup(queryStatus: string | null = null) {
    const queries: ApplicationQueueQuery[] = [];
    await TestBed.configureTestingModule({
      imports: [ApplicationsComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
          { path: 'applications/new', component: StubComponent },
          { path: 'applications/:id', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => queryStatus } } },
        },
        {
          provide: ApiClient,
          useValue: {
            searchApplications: (query: ApplicationQueueQuery) => {
              queries.push(query);
              return of(fakeSearch(query));
            },
            listCandidates: () => of(CANDIDATES),
          },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    const fixture = TestBed.createComponent(ApplicationsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, queries };
  }

  it('renders the server page (candidate + university join come in the row)', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('APP-2026-0001');
    expect(text).toContain('ENIT');
    expect(text).toContain('INSAT');
  });

  it('never renders CIN values in the queue', async () => {
    const { fixture } = await setup();
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('nationalId');
    expect(html).not.toContain('CIN-');
    expect(html.toLowerCase()).not.toContain('cin');
  });

  it('applies the dashboard drill-down preset as a server-side status filter', async () => {
    const { fixture, queries } = await setup('MODIFICATION_REQUESTED');
    const component = fixture.componentInstance;
    expect(component.status()).toBe('MODIFICATION_REQUESTED');

    const last = queries.at(-1);
    expect(last?.status).toBe('MODIFICATION_REQUESTED');
    // The mock server filtered: only the matching row is rendered.
    expect(component.rows().length).toBe(1);
    expect(component.rows()[0]?.reference).toBe('APP-2026-0002');
  });

  it('ignores a legacy status preset instead of sending ACCEPTED/NEEDS_CORRECTION', async () => {
    const { fixture, queries } = await setup('NEEDS_CORRECTION');
    expect(fixture.componentInstance.status()).toBe('');
    expect(queries.at(-1)?.status).toBeUndefined();
  });

  it('exposes only explicit statuses in the filter (no legacy values)', async () => {
    const { fixture } = await setup();
    const statuses = fixture.componentInstance.statuses;
    expect(statuses).toContain('APPROVED');
    expect(statuses).toContain('MODIFICATION_REQUESTED');
    expect(statuses).toContain('RESUBMITTED');
    expect(statuses).not.toContain('ACCEPTED');
    expect(statuses).not.toContain('NEEDS_CORRECTION');
  });

  it('sends search, status and dates to the server on filter', async () => {
    const { fixture, queries } = await setup();
    const component = fixture.componentInstance;
    component.search.set('sara');
    component.status.set('SUBMITTED');
    component.onFilter();
    component.onDates({ from: '2026-06-01', to: '2026-06-30' });

    const last = queries.at(-1);
    expect(last?.q).toBe('sara');
    expect(last?.status).toBe('SUBMITTED');
    expect(last?.from).toBe('2026-06-01');
    expect(last?.to).toBe('2026-06-30');
    // Filters and paging are server-side: page resets to 0 on filter change.
    expect(component.page()).toBe(0);
  });

  it('requests the next page from the server when paging', async () => {
    const { fixture, queries } = await setup();
    fixture.componentInstance.setPage(1);
    expect(queries.at(-1)?.page).toBe(1);
    fixture.componentInstance.setPage(0);
    expect(queries.at(-1)?.page).toBe(0);
  });

  it('maps column sort keys to backend sort properties', async () => {
    const { fixture, queries } = await setup();
    fixture.componentInstance.onSort({ key: 'candidateName', direction: 'asc' });
    expect(queries.at(-1)?.sort).toBe('candidate.lastName,asc');

    fixture.componentInstance.onSort({ key: 'reference', direction: 'desc' });
    expect(queries.at(-1)?.sort).toBe('reference,desc');

    // A key the backend does not whitelist sends no sort at all.
    fixture.componentInstance.onSort({ key: 'source', direction: 'asc' });
    expect(queries.at(-1)?.sort).toBeUndefined();
  });

  it('preserves filters/search in the store across navigation', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    component.search.set('sara');
    component.onFilter();
    const store = TestBed.inject(ApplicationQueueStore);
    expect(store.get().search).toBe('sara');

    // Simulate leaving and coming back: new component instance restores state.
    const fixture2 = TestBed.createComponent(ApplicationsComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(fixture2.componentInstance.search()).toBe('sara');
    expect(fixture2.componentInstance.rows().length).toBe(1);
  });

  it('shows the manual intake entry point only with APPLICATION_REVIEW', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('a[href="/applications/new"]')).toBeTruthy();
  });

  it('shows the empty state when the server returns no rows', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.search.set('no-such-candidate');
    fixture.componentInstance.onFilter();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.rows().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(
      fixture.componentInstance.i18n.t('common.empty.title'),
    );
  });
});
