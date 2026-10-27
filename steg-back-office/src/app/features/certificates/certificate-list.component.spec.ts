import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CertificateListComponent } from './certificate-list.component';
import { CertificatesService } from './certificates.service';
import { ValidationService } from '../validation/validation.service';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const ROWS = [
  {
    id: 'c1',
    reference: 'CERT-2026-00001',
    status: 'GENERATED',
    versionNumber: 1,
    issueDate: '2026-05-20',
    generatedAt: '2026-05-20T00:00:00Z',
    internshipId: 'int-1',
    internshipReference: 'INT-2026-00001',
    candidateName: 'Amine Ben Ali',
    candidateEmail: 'a@x.tn',
    universityName: 'ENIT',
    internshipType: 'PFE',
  },
  {
    id: 'c2',
    reference: 'CERT-2026-00002',
    status: 'REVOKED',
    versionNumber: 1,
    issueDate: '2026-05-21',
    generatedAt: '2026-05-21T00:00:00Z',
    internshipId: 'int-2',
    internshipReference: 'INT-2026-00002',
    candidateName: 'Bilel Trabelsi',
    candidateEmail: 'b@x.tn',
    universityName: 'INSAT',
    internshipType: 'PERFECTIONNEMENT',
  },
];

/**
 * CertificateListComponent (§5.7): one server page at a time, filters reset
 * the page, generate targets a VALIDATED internship, delete is confirmed.
 */
describe('CertificateListComponent (workspace)', () => {
  async function setup(
    overrides: Record<string, unknown> = {},
    routeParams: Record<string, string> = {},
  ) {
    const queries: unknown[] = [];
    const calls: { removed: string[]; generated: unknown[] } = { removed: [], generated: [] };
    const service: Record<string, unknown> = {
      search: (q: unknown) => {
        queries.push(q);
        return of({ content: ROWS, totalElements: ROWS.length, totalPages: 1 });
      },
      generate: (internshipId: string) => {
        calls.generated.push(internshipId);
        return of({ id: 'c-new' });
      },
      remove: (id: string) => {
        calls.removed.push(id);
        return of(undefined as void);
      },
      ...overrides,
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [CertificateListComponent],
      providers: [
        provideRouter([{ path: 'certificates', component: StubComponent }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(routeParams) } },
        },
        { provide: CertificatesService, useValue: service },
        {
          provide: ValidationService,
          useValue: { queue: () => of({ content: [] }) },
        },
        { provide: ToastService, useValue: { show: (...a: unknown[]) => toasts.push(a) } },
      ],
    }).compileComponents();
    // French assertions: pin the locale (same shared-jsdom flake as S5).
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(CertificateListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, queries, calls, toasts };
  }

  it('renders the server page with references and status badges', async () => {
    const { fixture, queries } = await setup();
    expect(queries[0]).toEqual({ page: 0, size: 20, q: undefined, status: undefined });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('CERT-2026-00001');
    expect(text).toContain('Amine Ben Ali');
    expect(fixture.nativeElement.querySelectorAll('li.st-row').length).toBe(2);
  });

  it('sends search and status to the server and resets the page', async () => {
    const { component, queries } = await setup();
    component.page.set(3);
    component.search = 'amine';
    component.status = 'GENERATED';
    component.onFilterChange();
    expect(queries.at(-1)).toEqual({ page: 0, size: 20, q: 'amine', status: 'GENERATED' });
  });

  it('requires a validated internship before generating', async () => {
    const { component, calls } = await setup();
    component.openGenerate();
    component.generateInternship = '';
    component.confirmGenerate();
    expect(calls.generated).toEqual([]);
    component.generateInternship = 'int-9';
    component.confirmGenerate();
    expect(calls.generated).toEqual(['int-9']);
  });

  it('confirms delete before calling the backend', async () => {
    const { component, calls } = await setup();
    component.askDelete(ROWS[0] as never);
    expect(calls.removed).toEqual([]);
    component.confirmDelete();
    expect(calls.removed).toEqual(['c1']);
  });

  it('surfaces load failures with a retry', async () => {
    const { fixture } = await setup({
      search: () => throwError(() => ({ error: { message: 'Down' } })),
    });
    expect(fixture.nativeElement.textContent as string).toContain('Down');
  });

  it('applies the dashboard drill-down preset as a server-side status filter', async () => {
    const { component, queries } = await setup({}, { status: 'GENERATED' });
    expect(component.status).toBe('GENERATED');
    expect(queries[0]).toMatchObject({ page: 0, status: 'GENERATED' });
  });

  it('ignores an unknown status preset instead of sending it', async () => {
    const { component, queries } = await setup({}, { status: 'BOGUS' });
    expect(component.status).toBe('');
    expect(queries[0]).toMatchObject({ page: 0, status: undefined });
  });
});
