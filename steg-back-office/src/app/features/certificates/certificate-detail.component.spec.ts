import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CertificateDetailComponent } from './certificate-detail.component';
import { CertificatesService } from './certificates.service';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { CertificateDetail } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const DETAIL = {
  certificate: {
    id: 'c1',
    reference: 'CERT-2026-00001',
    status: 'GENERATED',
    versionNumber: 2,
    issueDate: '2026-05-20',
    generatedAt: '2026-05-20T00:00:00Z',
    internshipId: 'int-1',
    internshipReference: 'INT-2026-00001',
    candidateName: 'Amine Ben Ali',
    candidateEmail: 'a@x.tn',
    universityName: 'ENIT',
    internshipType: 'PFE',
  },
  versions: [
    { versionNumber: 1, fileAssetId: 'f1', generatedAt: '2026-05-19T00:00:00Z' },
    { versionNumber: 2, fileAssetId: 'f2', generatedAt: '2026-05-20T00:00:00Z' },
  ],
} as unknown as CertificateDetail;

/**
 * CertificateDetailComponent (§5.7): current PDF + append-only version
 * history with per-version download, edit-and-regenerate (reference stable),
 * failures with retry.
 */
describe('CertificateDetailComponent', () => {
  async function setup(detail: CertificateDetail | null = DETAIL, overrides: Record<string, unknown> = {}) {
    const calls: { regenerated: unknown[]; downloaded: unknown[] } = { regenerated: [], downloaded: [] };
    const service: Record<string, unknown> = {
      detail: () => (detail ? of(detail) : throwError(() => ({ error: { message: 'Down' } }))),
      regenerate: (id: string, issueDate?: string) => {
        calls.regenerated.push([id, issueDate]);
        return of(detail);
      },
      download: () => of(new Blob(['%PDF'])),
      downloadVersion: (id: string, version: number) => {
        calls.downloaded.push([id, version]);
        return of(new Blob(['%PDF']));
      },
      ...overrides,
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [CertificateDetailComponent],
      providers: [
        provideRouter([{ path: 'certificates', component: StubComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'c1']]) } } },
        { provide: CertificatesService, useValue: service },
        { provide: ToastService, useValue: { show: (...a: unknown[]) => toasts.push(a) } },
      ],
    }).compileComponents();
    // French assertions: pin the locale (same shared-jsdom flake as S5).
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(CertificateDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls, toasts };
  }

  it('renders the certificate with its version history', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Amine Ben Ali');
    expect(text).toContain('CERT-2026-00001');
    expect(text).toContain('v2');
    expect(fixture.nativeElement.querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
  });

  it('regenerates with the edited issue date (reference stable, version bumped server-side)', async () => {
    const { component, calls } = await setup();
    component.openEdit();
    component.issueDate = '2026-06-01';
    component.confirmEdit();
    expect(calls.regenerated).toEqual([['c1', '2026-06-01']]);
  });

  it('downloads addressed history versions', async () => {
    const { component, calls } = await setup();
    component.downloadVersion(1);
    expect(calls.downloaded).toEqual([['c1', 1]]);
  });

  it('surfaces load failures with a retry', async () => {
    const { fixture } = await setup(null);
    expect((fixture.nativeElement.textContent as string)).toContain('Down');
  });
});
