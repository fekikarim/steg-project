import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

describe('ApiClient — C6 administration workspace', () => {
  let client: ApiClient;
  let http: HttpTestingController;
  const base = 'http://localhost:8080';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates/updates/deactivates departments with exact verbs and bodies', () => {
    client.createDepartment({ code: 'DSI', name: 'DSI' }).subscribe();
    const post = http.expectOne(`${base}/api/departments`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ code: 'DSI', name: 'DSI' });
    post.flush({ id: 'd1' });

    client.updateDepartment('d1', { code: 'DSI', name: 'DSI 2' }).subscribe();
    const put = http.expectOne(`${base}/api/departments/d1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ code: 'DSI', name: 'DSI 2' });
    put.flush({ id: 'd1' });

    client.deactivateDepartment('d1').subscribe();
    const del = http.expectOne(`${base}/api/departments/d1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('creates/updates/deactivates employees with exact verbs and bodies', () => {
    const body = {
      employeeNumber: 'EMP-1',
      firstName: 'Leila',
      lastName: 'Mansour',
      departmentId: 'd1',
      userId: null,
    };
    client.createEmployee(body).subscribe();
    const post = http.expectOne(`${base}/api/employees`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(body);
    post.flush({ id: 'e1' });

    client.updateEmployee('e1', body).subscribe();
    const put = http.expectOne(`${base}/api/employees/e1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(body);
    put.flush({ id: 'e1' });

    client.deactivateEmployee('e1').subscribe();
    const del = http.expectOne(`${base}/api/employees/e1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('searches audit with server-side filters and pagination', () => {
    client
      .searchAudit({
        action: 'APPLICATION_ACCEPTED',
        entityId: '',
        actorId: 'u1',
        page: 2,
        size: 20,
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === `${base}/api/audit`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('action')).toBe('APPLICATION_ACCEPTED');
    expect(req.request.params.get('actorId')).toBe('u1');
    expect(req.request.params.get('entityId')).toBeNull();
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ content: [] });

    client.getAuditEntry('a1').subscribe();
    http.expectOne(`${base}/api/audit/a1`).flush({ id: 'a1' });
  });

  it('sends calendar-day audit bounds as fromDate/toDate for server-side Tunis resolution', () => {
    client
      .searchAudit({ fromDate: '2026-10-01', toDate: '2026-10-03', page: 0, size: 20 })
      .subscribe();
    const req = http.expectOne((r) => r.url === `${base}/api/audit`);
    expect(req.request.params.get('fromDate')).toBe('2026-10-01');
    expect(req.request.params.get('toDate')).toBe('2026-10-03');
    expect(req.request.params.get('from')).toBeNull();
    expect(req.request.params.get('to')).toBeNull();
    req.flush({ content: [] });
  });
});
