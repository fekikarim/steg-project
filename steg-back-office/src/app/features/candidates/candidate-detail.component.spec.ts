import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CandidateDetailComponent } from './candidate-detail.component';
import { CandidatesService } from './candidates.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { CandidateDetail, CandidateOverview } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const PROFILE: CandidateDetail = {
  id: 'c1',
  firstName: 'Amine',
  lastName: 'A1-2026',
  email: 'amine@example.tn',
  phone: '22334455',
  birthDate: '2000-01-02',
  address: 'Tunis',
  speciality: 'Informatique',
  diploma: 'Licence',
  skills: 'Java',
  languages: 'FR',
  nationalId: '12345678',
  universityId: 'u1',
  universityName: 'ENIT',
  userId: 'acc-1',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  version: 0,
};

const OVERVIEW: CandidateOverview = {
  profile: PROFILE,
  supervisor: { userId: 's1', email: 'sup@steg.tn' },
  applications: [
    {
      id: 'app-1',
      reference: 'APP-2026-0001',
      status: 'SUBMITTED',
      type: 'PFE',
      submissionDate: '2026-06-01',
      createdAt: '2026-06-01T00:00:00Z',
    },
  ],
  internship: {
    id: 'int-1',
    reference: 'INT-2026-0001',
    status: 'APPROVED',
    type: 'PFE',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
  },
  tasks: { total: 3, byStatus: { TODO: 2, APPROVED: 1 } },
  documents: [
    {
      id: 'd-1',
      reference: 'DOC-2026-0001',
      type: 'CV',
      source: 'APPLICATION',
      restrictedAccess: false,
      createdAt: '2026-06-01T00:00:00Z',
    },
  ],
  certificate: {
    id: 'cert-1',
    reference: 'CERT-2026-0001',
    status: 'GENERATED',
    issueDate: '2026-09-30',
    generatedAt: '2026-09-30T00:00:00Z',
  },
  receipt: null,
};

describe('CandidateDetailComponent (§5.1 aggregate)', () => {
  async function setup(
    overrides: Record<string, unknown> = {},
    overview: CandidateOverview = OVERVIEW,
  ) {
    const calls = {
      overview: [] as string[],
      update: [] as { id: string; body: Record<string, unknown> }[],
      universities: 0,
    };
    const toasts: unknown[][] = [];
    const service = {
      overview: (id: string) => {
        calls.overview.push(id);
        return overrides['overview']
          ? (overrides['overview'] as (id: string) => ReturnType<CandidatesService['overview']>)(
              id,
            )
          : of(overview);
      },
      update: (id: string, body: Record<string, unknown>) => {
        calls.update.push({ id, body });
        return of(overview.profile);
      },
      universities: () => {
        calls.universities += 1;
        return of([{ id: 'u1', code: 'ENIT', name: 'ENIT', active: true }]);
      },
    };
    await TestBed.configureTestingModule({
      imports: [CandidateDetailComponent],
      providers: [
        provideRouter([{ path: 'candidates', component: StubComponent }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'c1' }) } },
        },
        { provide: CandidatesService, useValue: service },
        { provide: ToastService, useValue: { show: (...args: unknown[]) => toasts.push(args) } },
        {
          provide: AuthService,
          useValue: {
            hasPermission: () => true,
            // Keeps the real RealtimeService disconnected in tests.
            isAuthenticated: () => false,
            getAccessToken: () => null,
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CandidateDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls, toasts };
  }

  it('loads the whole §5.1 aggregate in ONE backend call (no client fan-out)', async () => {
    const { calls } = await setup();
    expect(calls.overview).toEqual(['c1']);
    expect(calls.overview.length).toBe(1);
  });

  it('renders supervisor, applications, internship, tasks, documents and certificate from the aggregate', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Amine A1-2026');
    expect(text).toContain('sup@steg.tn');
    expect(text).toContain('APP-2026-0001');
    expect(text).toContain('INT-2026-0001');
    expect(text).toContain('DOC-2026-0001');
    expect(text).toContain('CERT-2026-0001');
    expect(text).toContain('TODO · 2');
  });

  it('masks the CIN by default and reveals it only on demand', async () => {
    const { fixture, component } = await setup();
    expect((fixture.nativeElement.textContent as string).includes('12345678')).toBe(false);
    component.cinRevealed.set(true);
    fixture.detectChanges();
    expect((fixture.nativeElement.textContent as string).includes('12345678')).toBe(true);
  });

  it('never shows a CIN the backend redacted (Supervisor view)', async () => {
    const redacted = { ...OVERVIEW, profile: { ...PROFILE, nationalId: null } };
    const { fixture, component } = await setup({}, redacted);
    component.cinRevealed.set(true);
    fixture.detectChanges();
    expect((fixture.nativeElement.textContent as string).includes('12345678')).toBe(false);
  });

  it('edits the profile without a CIN — blank keeps the stored value', async () => {
    const { component, calls, fixture } = await setup();
    component.openEdit();
    component.editForm.firstName = 'Amine Updated';
    component.editForm.nationalId = '';
    expect(component.editValid()).toBe(true);

    component.saveEdit();
    await fixture.whenStable();

    expect(calls.update).toHaveLength(1);
    expect(calls.update[0]?.id).toBe('c1');
    expect(calls.update[0]?.body['firstName']).toBe('Amine Updated');
    expect(calls.update[0]?.body['nationalId']).toBeNull();
  });

  it('shows the error state when the aggregate cannot be read (e.g. 404 out of scope)', async () => {
    const { fixture } = await setup({
      overview: () => throwError(() => ({ status: 404 })),
    });
    expect(fixture.componentInstance.error()).toBe(true);
    expect((fixture.nativeElement.textContent as string)).not.toContain('sup@steg.tn');
  });
});
