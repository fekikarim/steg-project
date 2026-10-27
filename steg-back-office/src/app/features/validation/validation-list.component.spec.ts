import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ValidationListComponent } from './validation-list.component';
import { ValidationService } from './validation.service';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const ROWS = [
  {
    internshipId: 'int-1',
    reference: 'INT-2026-00001',
    status: 'REPORT_SUBMITTED',
    type: 'PFE',
    candidateName: 'Amine Ben Ali',
    universityName: 'ENIT',
  },
  {
    internshipId: 'int-2',
    reference: 'INT-2026-00002',
    status: 'UNDER_VALIDATION',
    type: 'PERFECTIONNEMENT',
    candidateName: 'Bilel Trabelsi',
    universityName: 'INSAT',
  },
];

/**
 * ValidationListComponent (§5.11 step 1): one server page at a time, filters
 * reset the page, rows link to the detail workspace, failures show a retry.
 */
describe('ValidationListComponent (queue)', () => {
  async function setup(
    overrides: Record<string, unknown> = {},
    routeParams: Record<string, string> = {},
  ) {
    const queries: unknown[] = [];
    const service: Record<string, unknown> = {
      queue: (q: unknown) => {
        queries.push(q);
        return of({ content: ROWS, totalElements: ROWS.length, totalPages: 1 });
      },
      ...overrides,
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [ValidationListComponent],
      providers: [
        provideRouter([{ path: 'validation', component: StubComponent }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(routeParams) } },
        },
        { provide: ValidationService, useValue: service },
        { provide: ToastService, useValue: { show: (...a: unknown[]) => toasts.push(a) } },
      ],
    }).compileComponents();
    // French assertions: pin the locale so a sibling spec's setLocale('en')
    // cannot leak through the shared jsdom localStorage (same flake as S5).
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(ValidationListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, queries, toasts };
  }

  it('renders the server page with status badges and detail links', async () => {
    const { fixture, queries } = await setup();
    expect(queries[0]).toEqual({ page: 0, size: 20, q: undefined, statuses: undefined, type: undefined });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Amine Ben Ali');
    expect(text).toContain('Bilel Trabelsi');
    expect(text).toContain('REPORT_SUBMITTED');
    expect(fixture.nativeElement.querySelectorAll('li.st-row').length).toBe(2);
  });

  it('sends search, status and type to the server and resets the page', async () => {
    const { component, queries } = await setup();
    component.page.set(3);
    component.search = 'amine';
    component.status = 'REPORT_SUBMITTED';
    component.type = 'PFE';
    component.onFilterChange();
    expect(queries.at(-1)).toEqual({
      page: 0,
      size: 20,
      q: 'amine',
      statuses: ['REPORT_SUBMITTED'],
      type: 'PFE',
    });
  });

  it('surfaces load failures with a retry', async () => {
    const { fixture } = await setup({
      queue: () => throwError(() => ({ error: { message: 'Down' } })),
    });
    expect((fixture.nativeElement.textContent as string)).toContain('Down');
  });

  it('applies the dashboard drill-down preset as a server-side status filter', async () => {
    const { component, queries } = await setup({}, { status: 'REPORT_SUBMITTED' });
    expect(component.status).toBe('REPORT_SUBMITTED');
    expect(queries[0]).toMatchObject({ page: 0, statuses: ['REPORT_SUBMITTED'] });
  });

  it('ignores an unknown status preset instead of sending it', async () => {
    const { component, queries } = await setup({}, { status: 'BOGUS' });
    expect(component.status).toBe('');
    expect(queries[0]).toMatchObject({ page: 0, statuses: undefined });
  });
});
