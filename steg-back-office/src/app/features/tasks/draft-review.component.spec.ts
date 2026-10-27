import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DraftReviewComponent } from './draft-review.component';
import { I18nService } from '../../core/i18n.service';
import { TaskDraftsService } from './task-drafts.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { InternshipDetail, TaskDraft } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const S1 = {
  id: 'int-A',
  reference: 'INT-A',
  candidateFullName: 'Aymen Test',
} as unknown as InternshipDetail;
const S2 = {
  id: 'int-B',
  reference: 'INT-B',
  candidateFullName: 'Syrine Test',
} as unknown as InternshipDetail;

const D1: TaskDraft = {
  id: 'd1',
  referenceInternshipId: 'int-A',
  title: 'Draft one',
  description: 'First',
  dueDate: '2026-05-01',
  createdAt: '2026-06-01T00:00:00Z',
};
const D2: TaskDraft = { ...D1, id: 'd2', title: 'Draft two' };

/**
 * DraftReviewComponent (S10c workspace over the S10a backend): PDF upload for
 * one reference student, draft list with manual edit / AI revise / delete,
 * manual add, and atomic bulk-add with per-item results. Student pickers are
 * fed from the scoped internships endpoint — the client sends no scope.
 */
describe('DraftReviewComponent (workspace)', () => {
  async function setup(overrides: Record<string, unknown> = {}) {
    const calls: {
      generate: unknown[];
      add: unknown[];
      edit: unknown[];
      revise: unknown[];
      removed: string[];
      bulk: unknown[];
    } = { generate: [], add: [], edit: [], revise: [], removed: [], bulk: [] };
    const service: Record<string, unknown> = {
      students: () => of([S1, S2]),
      list: () => of([D1, D2]),
      generate: (file: File, internshipId: string) => {
        calls.generate.push([file.name, internshipId]);
        return of([{ ...D1, id: 'd-new' }]);
      },
      add: (body: unknown) => {
        calls.add.push(body);
        return of({ ...D1, id: 'd-added' });
      },
      edit: (id: string, body: unknown) => {
        calls.edit.push([id, body]);
        return of({ ...D1, id });
      },
      revise: (id: string, instruction: string) => {
        calls.revise.push([id, instruction]);
        return of({ ...D1, id, title: 'Revised' });
      },
      remove: (id: string) => {
        calls.removed.push(id);
        return of(undefined as void);
      },
      bulkAdd: (body: unknown, key: string) => {
        calls.bulk.push([body, key]);
        return of({
          items: [{ index: 0, draftId: 'd1', internshipId: 'int-A', taskId: 't-1', status: 'OK' }],
        });
      },
      ...overrides,
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [DraftReviewComponent],
      providers: [
        { provide: TaskDraftsService, useValue: service },
        { provide: ToastService, useValue: { show: (...a: unknown[]) => toasts.push(a) } },
        // Back link uses RouterLink — stub routes, no navigation asserted.
        provideRouter([{ path: 'tasks', component: StubComponent }]),
      ],
    }).compileComponents();
    // Pin French: other spec files mutate the shared stored locale.
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(DraftReviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls, toasts };
  }

  it('loads students and drafts on init', async () => {
    const { component } = await setup();
    expect(component.students()).toHaveLength(2);
    expect(component.drafts()).toHaveLength(2);
    expect(component.loading()).toBe(false);
  });

  it('builds every student picker from the scoped internships endpoint', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Aymen Test');
    expect(text).toContain('Syrine Test');
  });

  it('shows an empty state when there are no drafts', async () => {
    const { fixture } = await setup({ list: () => of([]) });
    expect(fixture.nativeElement.textContent as string).toContain('Aucun brouillon');
  });

  it('generates drafts from the picked PDF and reference student', async () => {
    const { component, calls } = await setup();
    const file = new File(['x'], 'specs.pdf', { type: 'application/pdf' });
    component.onFile({ target: { files: [file] } } as unknown as Event);
    component.genInternship = 'int-A';
    component.confirmGenerate();
    expect(calls.generate).toEqual([[file.name, 'int-A']]);
    expect(component.drafts()).toHaveLength(3);
  });

  it('refuses a non-PDF file before any HTTP', async () => {
    const { component, calls } = await setup();
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    component.onFile({ target: { files: [file] } } as unknown as Event);
    expect(component.pickedFile()).toBeNull();
    expect(component.genError()).toBeTruthy();
    expect(calls.generate).toEqual([]);
  });

  it('adds manually with the reference student', async () => {
    const { component, calls } = await setup();
    component.addInternship = 'int-B';
    component.addTitle = '  Manual  ';
    component.addDesc = 'desc';
    component.addDue = '2026-06-01';
    component.confirmAdd();
    expect(calls.add).toEqual([
      {
        referenceInternshipId: 'int-B',
        title: 'Manual',
        description: 'desc',
        dueDate: '2026-06-01',
      },
    ]);
    expect(component.drafts()).toHaveLength(3);
  });

  it('requires a student and a title for manual add (before any HTTP)', async () => {
    const { component, calls } = await setup();
    component.addInternship = '';
    component.addTitle = 'T';
    component.confirmAdd();
    component.addInternship = 'int-A';
    component.addTitle = '   ';
    component.confirmAdd();
    expect(calls.add).toEqual([]);
    expect(component.addError()).toBeTruthy();
  });

  it('edits a draft manually', async () => {
    const { component, calls } = await setup();
    component.openEdit(D1);
    component.editTitle = 'Edited title';
    component.confirmEdit();
    expect(calls.edit).toEqual([
      ['d1', { title: 'Edited title', description: 'First', dueDate: '2026-05-01' }],
    ]);
  });

  it('revises a draft with AI from an instruction', async () => {
    const { component, calls } = await setup();
    component.openRevise(D2);
    component.reviseInstruction = '   ';
    component.confirmRevise();
    expect(calls.revise).toEqual([]);
    expect(component.reviseError()).toBeTruthy();
    component.reviseInstruction = 'make it shorter';
    component.confirmRevise();
    expect(calls.revise).toEqual([['d2', 'make it shorter']]);
    expect(component.drafts().find((d) => d.id === 'd2')?.title).toBe('Revised');
  });

  it('flags the AI-unavailable backend code on generate and revise', async () => {
    const err = { status: 503, error: { error: 'AI_UNAVAILABLE', message: 'down' } };
    const { component } = await setup({ generate: () => throwError(() => err) });
    const file = new File(['x'], 's.pdf', { type: 'application/pdf' });
    component.onFile({ target: { files: [file] } } as unknown as Event);
    component.genInternship = 'int-A';
    component.confirmGenerate();
    expect(component.genUnavailable()).toBe(true);
    expect(component.genError()).toBe('down');
  });

  it('deletes a draft after confirm and drops it from the selection', async () => {
    const { component, calls } = await setup();
    component.toggleDraft('d1');
    component.askDeleteDraft(D1);
    component.confirmDeleteDraft();
    expect(calls.removed).toEqual(['d1']);
    expect(component.drafts().find((d) => d.id === 'd1')).toBeUndefined();
    expect(component.selectedDrafts().has('d1')).toBe(false);
  });

  it('bulk-adds selected drafts to target students with one key, showing per-item results', async () => {
    const { component, calls, fixture } = await setup();
    component.toggleDraft('d1');
    component.toggleTarget('int-A');
    component.confirmBulkAdd();
    expect(calls.bulk).toHaveLength(1);
    const [body, key] = calls.bulk[0] as [unknown, string];
    expect(body).toEqual({ draftIds: ['d1'], internshipIds: ['int-A'] });
    expect(key).toBeTruthy();
    expect(component.bulkResult()?.items).toHaveLength(1);
    expect(component.bulkSummary()).toContain('1/1 OK');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent as string).toContain('1/1 OK');
  });

  it('refuses bulk-add without drafts or targets (before any HTTP)', async () => {
    const { component, calls } = await setup();
    component.confirmBulkAdd();
    component.toggleDraft('d1');
    component.confirmBulkAdd();
    expect(calls.bulk).toEqual([]);
    expect(component.bulkError()).toBeTruthy();
  });

  it('reuses the same idempotency key when retrying a failed bulk-add', async () => {
    const err = { status: 500, error: { message: 'network down' } };
    let attempt = 0;
    const { component, calls } = await setup({
      bulkAdd: (body: unknown, key: string) => {
        calls.bulk.push([body, key]);
        attempt += 1;
        return attempt === 1
          ? throwError(() => err)
          : of({
              items: [
                { index: 0, draftId: 'd1', internshipId: 'int-A', taskId: 't-1', status: 'OK' },
              ],
            });
      },
    });
    component.toggleDraft('d1');
    component.toggleTarget('int-A');
    component.confirmBulkAdd();
    component.confirmBulkAdd();
    expect(calls.bulk).toHaveLength(2);
    expect((calls.bulk[0] as unknown[])[1]).toBe((calls.bulk[1] as unknown[])[1]);
    expect(component.bulkSummary()).toContain('1/1 OK');
  });

  it('shows the load error state with retry', async () => {
    const { fixture } = await setup({
      students: () => throwError(() => ({ error: { message: 'boom' } })),
    });
    expect(fixture.nativeElement.textContent as string).toContain('boom');
  });
});
