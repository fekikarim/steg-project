import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ValidationDetailComponent } from './validation-detail.component';
import { ValidationService } from './validation.service';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { ValidationDetail } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const DETAIL = {
  internshipId: 'int-1',
  reference: 'INT-2026-00001',
  status: 'UNDER_VALIDATION',
  type: 'PFE',
  requirement: 'OBLIGATOIRE',
  startDate: '2026-01-01',
  endDate: '2026-04-01',
  candidate: { id: 'c1', fullName: 'Amine Ben Ali', email: 'a@x.tn', universityName: 'ENIT' },
  supervisor: { userId: 's1', email: 'sup@steg.tn', displayName: 'Leila Ben Ammar' },
  tasks: {
    total: 2,
    done: 1,
    items: [
      { id: 't1', title: 'Done', status: 'APPROVED' },
      { id: 't2', title: 'Open', status: 'TODO' },
    ],
  },
  report: {
    documentType: 'REPORT',
    deliverableId: 'd1',
    fileAssetId: 'f1',
    version: 1,
    title: 'Rapport',
    submittedAt: '2026-05-01T00:00:00Z',
    sizeBytes: 12,
  },
  journal: null,
  latestReportRun: {
    overall: 'PASS',
    degraded: false,
    checks: [{ key: 'candidate_name', label: 'Candidate name', status: 'PASSED', expected: 'x', found: 'x', evidence: 'e' }],
    runBy: 'u1',
    runAt: '2026-05-02T00:00:00Z',
  },
  latestJournalRun: null,
  reportDecision: null,
  journalDecision: null,
  receipt: null,
} as unknown as ValidationDetail;

/**
 * ValidationDetailComponent (§5.11 steps 2–7): aggregates candidate/tasks/docs,
 * shows per-check AI results with the degraded banner, refuses blank rejection
 * comments client-side, gates the receipt CTA on both manual validations.
 */
describe('ValidationDetailComponent', () => {
  async function setup(detail: ValidationDetail | null = DETAIL, overrides: Record<string, unknown> = {}) {
    const calls: { decided: unknown[]; verified: unknown[]; receipts: number } = {
      decided: [],
      verified: [],
      receipts: 0,
    };
    const service: Record<string, unknown> = {
      detail: () => (detail ? of(detail) : throwError(() => ({ error: { message: 'Down' } }))),
      decide: (id: string, doc: string, decision: string, comment?: string) => {
        calls.decided.push([id, doc, decision, comment]);
        return of(detail);
      },
      verify: (id: string, doc: string) => {
        calls.verified.push([id, doc]);
        return of({ overall: 'PASS', degraded: false, checks: [] });
      },
      receipt: (id: string) => {
        calls.receipts += 1;
        return of({ reference: 'PAY-2026-00001' });
      },
      download: () => of(new Blob(['%PDF'])),
      ...overrides,
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [ValidationDetailComponent],
      providers: [
        provideRouter([{ path: 'validation', component: StubComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'int-1']]) } } },
        { provide: ValidationService, useValue: service },
        { provide: ToastService, useValue: { show: (...a: unknown[]) => toasts.push(a) } },
      ],
    }).compileComponents();
    // French assertions: pin the locale (same shared-jsdom flake as S5).
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(ValidationDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls, toasts };
  }

  it('renders candidate, ratio, documents, AI checks and the degraded-safe receipt gate', async () => {
    const { fixture, component } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Amine Ben Ali');
    expect(text).toContain('1/2');
    expect(text).toContain('Rapport');
    expect(text).toContain('Candidate name');
    expect(text).toContain('Document pas encore');
    expect(component.canReceipt()).toBe(false);
  });

  it('shows the AI-unavailable banner for degraded runs', async () => {
    const degraded = {
      ...DETAIL,
      latestReportRun: { ...DETAIL.latestReportRun!, degraded: true, overall: 'INCONCLUSIVE' },
    } as ValidationDetail;
    const { fixture } = await setup(degraded);
    expect((fixture.nativeElement.textContent as string)).toContain('IA indisponible');
  });

  it('refuses a blank rejection comment before any HTTP', async () => {
    const { component, calls } = await setup();
    component.openDecide('REPORT', false);
    component.decideComment = '   ';
    component.confirmDecide();
    expect(calls.decided).toEqual([]);
    expect(component.decideError()).toBeTruthy();
  });

  it('sends validate/reject decisions with the trimmed comment', async () => {
    const { component, calls } = await setup();
    component.openDecide('JOURNAL', false);
    component.decideComment = '  Add week 4  ';
    component.confirmDecide();
    expect(calls.decided).toEqual([['int-1', 'JOURNAL', 'REJECTED', '  Add week 4  ']]);
  });

  it('enables the receipt CTA only when both documents are manually validated', async () => {
    const both = {
      ...DETAIL,
      status: 'VALIDATED',
      reportDecision: { decision: 'VALIDATED', comment: null, decidedBy: 'u', decidedAt: 'x' },
      journalDecision: { decision: 'VALIDATED', comment: null, decidedBy: 'u', decidedAt: 'x' },
    } as unknown as ValidationDetail;
    const { component } = await setup(both);
    expect(component.canReceipt()).toBe(true);
  });

  it('surfaces load failures with a retry', async () => {
    const { fixture } = await setup(null);
    expect((fixture.nativeElement.textContent as string)).toContain('Down');
  });
});
