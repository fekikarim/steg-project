import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

/**
 * S10c client contract: AI task drafts (AGENTS.md §7.4) and the role-scoped
 * chatbot (AGENTS.md §7.5). The backend owns scope, validation, atomicity
 * and degradation — these specs pin URLs, verbs, multipart shape, params,
 * headers and bodies only.
 */
describe('ApiClient S10c AI endpoints', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('POSTs specs PDF + internshipId as multipart to /drafts/generate', () => {
    const file = new File(['%PDF fake'], 'specs.pdf', { type: 'application/pdf' });
    api.generateTaskDrafts(file, 'int-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts/generate'));
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('internshipId')).toBe('int-1');
    const sent = body.get('file') as File;
    expect(sent.name).toBe('specs.pdf');
    req.flush([]);
    http.verify();
  });

  it('GETs drafts with the optional internship filter', () => {
    api.listTaskDrafts('int-9').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('internshipId')).toBe('int-9');
    req.flush([]);
    http.verify();
  });

  it('omits the internship filter when absent', () => {
    api.listTaskDrafts().subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts'));
    expect(req.request.params.has('internshipId')).toBe(false);
    req.flush([]);
    http.verify();
  });

  it('POSTs manual drafts to the collection route', () => {
    api
      .addDraftManually({ referenceInternshipId: 'int-1', title: 'T', dueDate: '2026-05-01' })
      .subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ referenceInternshipId: 'int-1', title: 'T' });
    req.flush({ id: 'd1' });
    http.verify();
  });

  it('PUTs manual edits to the draft route', () => {
    api.updateDraft('d-1', { title: 'New' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts/d-1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ title: 'New' });
    req.flush({ id: 'd-1' });
    http.verify();
  });

  it('POSTs revise instructions to the draft revise route', () => {
    api.reviseDraft('d-2', 'shorter').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts/d-2/revise'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ instruction: 'shorter' });
    req.flush({ id: 'd-2' });
    http.verify();
  });

  it('DELETEs one draft on the draft route', () => {
    api.deleteDraft('d-3').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts/d-3'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.verify();
  });

  it('POSTs draft bulk-add with the idempotency key header', () => {
    const body = { draftIds: ['d-1', 'd-2'], internshipIds: ['int-1'] };
    api.bulkAddDrafts(body, 'key-9').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/drafts/bulk-add'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Idempotency-Key')).toBe('key-9');
    expect(req.request.body).toEqual(body);
    req.flush({ items: [] });
    http.verify();
  });

  it('POSTs chatbot questions trimmed to /api/ai/chatbot/query', () => {
    api.chatbotQuery('  hello  ').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/ai/chatbot/query'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'hello' });
    req.flush({ answer: 'hi', degraded: false, toolsUsed: [] });
    http.verify();
  });

  it('GETs chatbot history and DELETEs it on the history route', () => {
    api.chatbotHistory().subscribe();
    const get = http.expectOne((r) => r.url.endsWith('/api/ai/chatbot/history'));
    expect(get.request.method).toBe('GET');
    get.flush({ turns: [] });
    http.verify();

    api.clearChatbotHistory().subscribe();
    const del = http.expectOne((r) => r.url.endsWith('/api/ai/chatbot/history'));
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    http.verify();
  });
});
