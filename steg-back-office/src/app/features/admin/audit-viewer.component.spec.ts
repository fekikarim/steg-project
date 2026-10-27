import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuditViewerComponent } from './audit-viewer.component';
import { AdminService } from './admin.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { signInDemo } from '../../core/testing/demo-session';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

function httpError(status: number): { status: number } {
  return { status };
}

const ROW = {
  id: 'log1',
  createdAt: '2026-10-01T10:00:00Z',
  action: 'APPLICATION_ACCEPTED',
  entityType: 'InternshipApplication',
  entityId: 'a1',
  oldValues: null,
  newValues: '{"status":"ACCEPTED"}',
  actorId: 'u1',
  actorEmail: 'rh@steg.tn',
  ipAddress: '10.0.0.1',
};

/**
 * S1b: the audit log is APPEND-ONLY history. Rows written before the legacy
 * status removal keep their original action codes (`APPLICATION_ACCEPTED`,
 * `APPLICATION_NEEDS_CORRECTION`); new rows use the explicit codes
 * (`APPLICATION_MODIFICATION_REQUESTED`). The viewer must render BOTH from the
 * raw string — it must never translate an action through a status enum that no
 * longer exists, or historical rows would silently lose their meaning.
 */
const HISTORICAL_ROW = {
  ...ROW,
  id: 'log2',
  action: 'APPLICATION_NEEDS_CORRECTION',
  newValues: '{"status":"NEEDS_CORRECTION"}',
};
const CURRENT_ROW = {
  ...ROW,
  id: 'log3',
  action: 'APPLICATION_MODIFICATION_REQUESTED',
  newValues: '{"status":"MODIFICATION_REQUESTED"}',
};

describe('AuditViewerComponent', () => {
  async function setup(searchImpl?: (q: unknown) => unknown) {
    const seen: unknown[] = [];
    await TestBed.configureTestingModule({
      imports: [AuditViewerComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'audit', component: StubComponent },
        ]),
        {
          provide: AdminService,
          useValue: {
            searchAudit: (q: unknown) => {
              seen.push(q);
              return searchImpl
                ? (searchImpl(q) as never)
                : of({ content: [ROW], number: 0, totalPages: 1 });
            },
            getAuditEntry: () => of(ROW),
          },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(AuditViewerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, seen };
  }

  it('queries the server with action/entity/actor filters and pagination', async () => {
    const { fixture, seen } = await setup();
    const component = fixture.componentInstance;
    component.action.set('APPLICATION_ACCEPTED');
    component.actorId.set('u1');
    component.onServerFilter();
    expect(seen.length).toBe(2);
    expect(seen[1]).toMatchObject({ action: 'APPLICATION_ACCEPTED', actorId: 'u1', page: 0 });
    expect(fixture.nativeElement.textContent as string).toContain('APPLICATION_ACCEPTED');
  });

  it('sends source, entity-type and date-range filters to the server in one query', async () => {
    const { fixture, seen } = await setup();
    const component = fixture.componentInstance;
    component.action.set('AI_VERIFICATION_RUN');
    component.entityType.set('Internship');
    component.source.set('AI');
    component.from.set('2026-10-01');
    component.to.set('2026-10-03');
    component.onServerFilter();
    expect(seen.at(-1)).toMatchObject({
      action: 'AI_VERIFICATION_RUN',
      entityType: 'Internship',
      source: 'AI',
      fromDate: '2026-10-01',
      toDate: '2026-10-03',
      page: 0,
    });
  });

  it('renders the source channel per row and in the detail drawer', async () => {
    const { fixture } = await setup(() =>
      of({ content: [{ ...ROW, source: 'MOBILE' }], totalElements: 1, totalPages: 1 }),
    );
    expect(fixture.nativeElement.textContent as string).toContain('MOBILE');
  });

  it('is read-only: no edit or delete affordance exists', async () => {
    const { fixture } = await setup();
    const labels = [...fixture.nativeElement.querySelectorAll('button')].map(
      (b: HTMLButtonElement) => b.textContent?.trim(),
    );
    for (const label of labels) {
      expect(label).not.toMatch(/delete|remove|edit/i);
    }
    expect(fixture.nativeElement.querySelector('st-drawer')).toBeTruthy();
  });

  it('renders historical and current action codes verbatim (append-only audit history)', async () => {
    const { fixture } = await setup(() =>
      of({
        content: [ROW, HISTORICAL_ROW, CURRENT_ROW],
        totalElements: 3,
        totalPages: 1,
        number: 0,
        size: 20,
      }),
    );
    const text = fixture.nativeElement.textContent as string;
    // The historical code predates the legacy-status removal and must stay
    // readable; the current code replaces it for new rows.
    expect(text).toContain('APPLICATION_NEEDS_CORRECTION');
    expect(text).toContain('APPLICATION_MODIFICATION_REQUESTED');
    expect(text).toContain('APPLICATION_ACCEPTED');
  });

  it('truncates sensitive payloads for cautious display', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    expect(component.preview('x'.repeat(2000)).length).toBeLessThan(2000);
    expect(component.preview(null)).toBe('');
  });

  it('handles ADMIN-only 403 gracefully without leaking data', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AuditViewerComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'audit', component: StubComponent },
        ]),
        {
          provide: AdminService,
          useValue: { searchAudit: () => throwError(() => httpError(403)) },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 'sup@steg.tn', 'SUPERVISOR');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(AuditViewerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Restricted access');
    expect(text).not.toContain('APPLICATION_ACCEPTED');
  });
});
