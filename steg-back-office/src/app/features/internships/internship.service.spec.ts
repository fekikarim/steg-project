import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InternshipService, activeAssignment, type InternshipBundle } from './internship.service';
import { ApiClient } from '../../core/api-client.service';
import type { InternshipDetail } from '../../core/api-models';

function httpError(status: number): { status: number } {
  return { status };
}

const INTERNSHIP: InternshipDetail = {
  id: 'i1',
  reference: 'STAGE-2026-0001',
  startDate: '2026-07-01',
  endDate: '2026-09-30',
  status: 'IN_PROGRESS',
  type: 'PFE',
  requirement: 'OBLIGATOIRE',
  paymentEligible: true,
  subject: 'Grid',
  academicLevel: 'Engineer',
  candidateId: 'c1',
  candidateFullName: 'Sara Ben Ammar',
  applicationId: 'a1',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-02T00:00:00Z',
  version: 0,
};

describe('activeAssignment', () => {
  it('returns the ACTIVE assignment or null', () => {
    expect(activeAssignment([])).toBeNull();
    const rows = [
      { status: 'ENDED', supervisorName: 'Old' },
      { status: 'ACTIVE', supervisorName: 'New' },
    ] as unknown as InternshipBundle['assignments'];
    expect(activeAssignment(rows)?.supervisorName).toBe('New');
  });
});

describe('InternshipService', () => {
  function setup(stub: Partial<Record<string, (...args: never[]) => unknown>>): InternshipService {
    TestBed.configureTestingModule({
      providers: [
        InternshipService,
        {
          provide: ApiClient,
          useValue: {
            getInternship: () => of(INTERNSHIP),
            getCandidate: () => of(null),
            getClassification: () => of(null),
            listAssignments: () => of([]),
            listInternshipDocuments: () => of([]),
            listTasks: () => of({ content: [] }),
            listJournalEntries: () => of({ content: [] }),
            listDeliverables: () => of({ content: [] }),
            listEvaluations: () => of({ content: [] }),
            ...stub,
          },
        },
      ],
    });
    return TestBed.inject(InternshipService);
  }

  it('assembles the bundle from live endpoints only (no workflow fetch)', () => {
    const seen: string[] = [];
    const service = setup({
      getInternship: () => {
        seen.push('getInternship');
        return of(INTERNSHIP);
      },
    });
    let bundle!: InternshipBundle;
    service.loadBundle('i1').subscribe((b) => (bundle = b));
    expect(bundle.internship.reference).toBe('STAGE-2026-0001');
    expect(seen).toEqual(['getInternship']);
  });

  it('maps lifecycle transitions to the single-authority endpoint', () => {
    const seen: unknown[] = [];
    const service = setup({
      transitionInternshipStatus: (_id: unknown, target: unknown, comment: unknown) => {
        seen.push({ targetStatus: target, comment });
        return of({ id: 'i1' });
      },
    });
    service.activate('i1').subscribe();
    service.complete('i1').subscribe();
    expect(seen).toEqual([
      { targetStatus: 'IN_PROGRESS', comment: 'Started from the back office' },
      { targetStatus: 'REPORT_SUBMITTED', comment: 'Report submitted from the back office' },
    ]);
  });

  it('isolates per-internship assignment failures in the map', () => {
    const service = setup({
      listAssignments: (id: unknown) =>
        id === 'bad'
          ? throwError(() => httpError(403))
          : of([{ id: 'as-1', status: 'IN_PROGRESS' }]),
    });
    let map!: Map<string, unknown[]>;
    service.loadAssignmentMap(['ok', 'bad']).subscribe((m) => (map = m));
    expect(map.get('ok')?.length).toBe(1);
    expect(map.get('bad')).toEqual([]);
  });

  it('loads internship documents into the bundle and tolerates denial', async () => {
    const docs = [{ id: 'ad-1' }];
    const service = setup({ listInternshipDocuments: () => of(docs) });
    let bundle!: InternshipBundle;
    service.loadBundle('i1').subscribe((b) => (bundle = b));
    expect(bundle.documents).toEqual(docs);

    await TestBed.resetTestingModule();
    const denied = setup({ listInternshipDocuments: () => throwError(() => httpError(403)) });
    let fallback!: InternshipBundle;
    denied.loadBundle('i1').subscribe((b) => (fallback = b));
    expect(fallback.documents).toEqual([]);
    expect(fallback.internship.reference).toBe('STAGE-2026-0001');
  });

  it('chains upload metadata into the attach call', () => {
    const seen: { upload: unknown[]; attach: unknown[] } = { upload: [], attach: [] };
    const service = setup({
      uploadDocument: (type: unknown, file: unknown) => {
        seen.upload.push([type, file]);
        return of({ id: 'doc-9' });
      },
      attachInternshipDocument: (id: unknown, body: unknown) => {
        seen.attach.push([id, body]);
        return of({ id: 'ad-9' });
      },
    });
    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    let result!: unknown;
    service
      .uploadThenAttach('i1', 'STEG_INTERNSHIP_REPORT', file, true)
      .subscribe((r) => (result = r));
    expect(seen.upload).toEqual([['STEG_INTERNSHIP_REPORT', file]]);
    expect(seen.attach).toEqual([['i1', { documentId: 'doc-9', mandatory: true }]]);
    expect(result).toEqual({ id: 'ad-9' });
  });
});
