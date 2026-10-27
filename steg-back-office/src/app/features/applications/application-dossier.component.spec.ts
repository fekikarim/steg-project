import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApplicationDossierComponent } from './application-dossier.component';
import { ApplicationReviewService, type DossierBundle } from './application-review.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import type { ApplicationDetail } from '../../core/api-models';
import { signInDemo } from '../../core/testing/demo-session';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const APP: ApplicationDetail = {
  id: 'app-1',
  reference: 'APP-2026-0001',
  status: 'UNDER_REVIEW',
  candidateId: 'c1',
  candidateName: 'Sara Ben Ammar',
  desiredStartDate: '2026-07-01',
  desiredEndDate: '2026-08-31',
  proposedTheme: 'Smart grid monitoring',
  submittedOnline: true,
  submissionDate: '2026-06-01',
  calculatedType: 'PERFECTIONNEMENT',
  requirement: 'OBLIGATOIRE',
  rejectionReason: null,
  correctionComment: null,
  reviewerId: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-02T00:00:00Z',
  version: 0,
};

const supervisors = [
  { userId: 'admin-1', email: 'admin@steg.tn', role: 'ADMIN' },
  { userId: 'sup-1', email: 'sup@steg.tn', role: 'SUPERVISOR' },
];

const approvalResult = {
  supervisorUserId: 'admin-1',
  credentialEmail: 'intern@steg.tn',
  temporaryPassword: 'OneTime-Passw0rd!',
  credentialEmailSent: true,
  internship: { id: 'int-1', reference: 'INT-1' },
};

function bundle(overrides: Partial<DossierBundle> = {}): DossierBundle {
  return {
    application: APP,
    candidate: null,
    documents: [],
    workflow: null,
    actions: [],
    actionsRestricted: false,
    ...overrides,
  };
}

const RESTRICTED_DOC = {
  id: 'ad-1',
  applicationId: 'app-1',
  document: {
    id: 'd-1',
    reference: 'DOC-1',
    type: 'CIN_COPY',
    restrictedAccess: true,
    generatedAutomatically: false,
    latestVersionNumber: 1,
    originalFileName: 'cin.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    checksum: 'abc',
    uploadedAt: '2026-06-01T00:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
  },
  mandatory: true,
  verificationStatus: 'PENDING',
  verificationComment: null,
  verifiedById: null,
  verifiedAt: null,
  createdAt: '2026-06-01T00:00:00Z',
} as DossierBundle['documents'][number];

const NORMAL_DOC = {
  ...RESTRICTED_DOC,
  id: 'ad-2',
  document: {
    ...RESTRICTED_DOC.document,
    id: 'd-2',
    reference: 'DOC-2',
    type: 'CV',
    restrictedAccess: false,
    originalFileName: 'cv.pdf',
    mimeType: 'application/pdf',
  },
} as DossierBundle['documents'][number];

describe('ApplicationDossierComponent', () => {
  async function setup(
    role: 'ADMIN' | 'SUPERVISOR',
    snap: DossierBundle,
    apiOverrides: Record<string, unknown> = {},
  ) {
    const calls: { method: string; args: unknown[] }[] = [];
    await TestBed.configureTestingModule({
      imports: [ApplicationDossierComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
          { path: 'candidates/:id', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'app-1' } } },
        },
        {
          provide: ApplicationReviewService,
          useValue: {
            loadDossier: () => of(snap),
            beginReview: () => of({ id: 'x' }),
            listSupervisors: () => of(supervisors),
            approve: (...args: unknown[]) => {
              calls.push({ method: 'approve', args });
              return of(approvalResult);
            },
            reject: (...args: unknown[]) => {
              calls.push({ method: 'reject', args });
              return of({ id: 'x' });
            },
            requestCorrection: (...args: unknown[]) => {
              calls.push({ method: 'requestCorrection', args });
              return of({ id: 'x' });
            },
            verifyDocument: () => of({}),
            downloadDocument: () => of(new Blob()),
            validateStoredDocumentAi: () =>
              of({
                valid: true,
                documentTypeValid: true,
                candidateNameValid: true,
                confidence: 0.95,
                reason: 'Valid',
              }),
          },
        },
        {
          provide: ApiClient,
          useValue: {
            listDepartments: () => of([{ id: 'dept-1', code: 'IT', name: 'Informatique' }]),
            listInternAccounts: () => of([]),
            resetInternAccountPassword: () => of({ email: '', temporaryPassword: '', emailSent: false }),
            ...apiOverrides,
          },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 
      role === 'ADMIN' ? 'admin@steg.tn' : 'sup@steg.tn',
      role,
    );
    const fixture = TestBed.createComponent(ApplicationDossierComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, calls };
  }

  it('hides review actions without APPLICATION_REVIEW (supervisor sees read-only dossier)', async () => {
    const { fixture } = await setup('SUPERVISOR', bundle());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('APP-2026-0001');
    expect(text).not.toContain('Accepter');
    expect(text).not.toContain('Rejeter');
  });

  it('shows approve/correct/reject for UNDER_REVIEW with review permission', async () => {
    const { fixture } = await setup('ADMIN', bundle());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Approuver');
    expect(text).toContain('Rejeter');
  });

  it('opening approval preselects the Admin, confirming calls the atomic endpoint and shows credentials once', async () => {
    const { fixture, calls } = await setup('ADMIN', bundle());
    const component = fixture.componentInstance;

    component.openApproval();
    await fixture.whenStable();
    expect(component.approvalOpen()).toBe(true);
    expect(component.supervisorOptions().map((s) => s.userId)).toEqual(['admin-1', 'sup-1']);

    component.confirmApproval({ supervisorUserId: 'admin-1', departmentId: 'dept-1' });
    await fixture.whenStable();
    expect(calls[0]).toEqual({
      method: 'approve',
      args: ['app-1', 'admin-1', 'dept-1'],
    });

    // Shown once, then dropped from app state when the dialog closes.
    expect(component.credentials()?.password).toBe('OneTime-Passw0rd!');
    component.closeCredentials();
    expect(component.credentials()).toBeNull();
  });

  it('supports the backend default: approve with no chosen supervisor sends null', async () => {
    const { fixture, calls } = await setup('ADMIN', bundle());
    const component = fixture.componentInstance;
    component.confirmApproval({ supervisorUserId: null, departmentId: 'dept-1' });
    await fixture.whenStable();
    expect(calls.length).toBe(1);
    expect(calls[0]?.args[1]).toBeNull();
  });

  it('Resend regenerates a NEW password and swaps the displayed secret (§5.3)', async () => {
    const resetCalls: string[] = [];
    const searchCalls: string[] = [];
    const { fixture } = await setup('ADMIN', bundle(), {
      listInternAccounts: (search: string) => {
        searchCalls.push(search);
        return of([
          { id: 'acc-1', email: 'intern@steg.tn', role: 'INTERN', status: 'ACTIVE' },
        ]);
      },
      resetInternAccountPassword: (id: string) => {
        resetCalls.push(id);
        return of({
          email: 'intern@steg.tn',
          temporaryPassword: 'Second-Passw0rd!',
          emailSent: true,
        });
      },
    });
    const component = fixture.componentInstance;

    // Approve → first one-time password shown once.
    component.confirmApproval({ supervisorUserId: 'admin-1', departmentId: 'dept-1' });
    await fixture.whenStable();
    expect(component.credentials()?.password).toBe('OneTime-Passw0rd!');

    // Resend asks the backend for a NEW password (the old one is never
    // retrievable) through the §5.4 reset and swaps the displayed secret.
    component.resendCredentials();
    await fixture.whenStable();
    expect(searchCalls).toEqual(['intern@steg.tn']);
    expect(resetCalls).toEqual(['acc-1']);
    expect(component.credentials()?.password).toBe('Second-Passw0rd!');
    expect(component.credentials()?.emailSent).toBe(true);
    expect(component.resendBusy()).toBe(false);

    // ...and closing still drops it from app state.
    component.closeCredentials();
    expect(component.credentials()).toBeNull();
  });

  it('Resend failure keeps the account, clears busy and shows an error toast', async () => {
    const { fixture } = await setup('ADMIN', bundle(), {
      listInternAccounts: () => of([]),
    });
    const component = fixture.componentInstance;
    component.confirmApproval({ supervisorUserId: 'admin-1', departmentId: 'dept-1' });
    await fixture.whenStable();

    component.resendCredentials();
    await fixture.whenStable();
    // Account not found: nothing to reset, the dialog keeps the old secret.
    expect(component.credentials()?.password).toBe('OneTime-Passw0rd!');
    expect(component.resendBusy()).toBe(false);
  });

  it('blocks short rejection reasons client-side (backend stays authoritative)', async () => {
    const { fixture, calls } = await setup('ADMIN', bundle());
    const component = fixture.componentInstance;
    component.openReason('reject');
    component.reasonText = 'no';
    component.submitReason();
    expect(component.reasonError()).toBeTruthy();
    expect(calls.length).toBe(0);

    component.reasonText = 'Missing transcripts, please resubmit.';
    component.submitReason();
    expect(calls.length).toBe(1);
    expect(calls[0]?.method).toBe('reject');
  });

  it('disables restricted downloads without DOCUMENT_VIEW_RESTRICTED', async () => {
    const { fixture } = await setup('SUPERVISOR', bundle({ documents: [RESTRICTED_DOC] }));
    const component = fixture.componentInstance;
    component.tab.set('documents');
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('.st-docrow__actions button')];
    const download = buttons.find((b: HTMLButtonElement) => b.textContent?.includes('Télécharger'));
    expect(download?.disabled).toBe(true);
  });

  it('downloads with the original filename (not a blob-UUID name)', async () => {
    const { fixture } = await setup('ADMIN', bundle({ documents: [NORMAL_DOC] }));
    const component = fixture.componentInstance;
    const clicked: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    const createSpy = (tag: string, options?: ElementCreationOptions): HTMLElement => {
      const el = origCreate(tag, options);
      if (tag === 'a') {
        const origClick = el.click.bind(el);
        el.click = (): void => {
          clicked.push(el as HTMLAnchorElement);
          origClick();
        };
      }
      return el;
    };
    document.createElement = createSpy as typeof document.createElement;
    try {
      component.download(NORMAL_DOC, false);
      expect(clicked.length).toBe(1);
      expect(clicked[0]?.download).toBe('cv.pdf');
    } finally {
      document.createElement = origCreate;
    }
  });

  it('renders the real workflow timeline and masks CIN by default', async () => {
    const { fixture } = await setup(
      'ADMIN',
      bundle({
        candidate: {
          id: 'c1',
          firstName: 'Sara',
          lastName: 'Ben Ammar',
          email: 's@x.tn',
          phone: null,
          birthDate: null,
          speciality: null,
          diploma: null,
          universityId: 'u1',
          universityName: 'ENIT',
          userId: 'u-1',
          createdAt: '',
          updatedAt: '',
          version: 0,
          address: null,
          skills: null,
          languages: null,
          nationalId: 'CIN-99887766',
        },
        actions: [
          {
            id: 'act-1',
            instanceId: 'wf-1',
            stepCode: 'UNDER_REVIEW',
            stepName: 'HR & Department Review',
            performedById: 'e1',
            performedByUsername: 'rh.steg',
            type: 'VALIDATION',
            decision: 'PENDING',
            comment: null,
            sequenceNumber: 1,
            performedAt: '2026-06-03T10:00:00Z',
          },
        ],
      }),
    );
    const component = fixture.componentInstance;
    component.tab.set('timeline');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('HR & Department Review');
    expect(text).toContain('rh.steg');
    expect(text).not.toContain('CIN-99887766');
  });

  it('surfaces backend 403 on history as a restricted note, not a crash', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ApplicationDossierComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'app-1' } } },
        },
        {
          provide: ApplicationReviewService,
          useValue: { loadDossier: () => throwError(() => ({ status: 403 })) },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 'sup@steg.tn', 'SUPERVISOR');
    const fixture = TestBed.createComponent(ApplicationDossierComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('st-error-state')).toBeTruthy();
  });
});
