import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LoginComponent } from './login.component';
import { I18nService } from '../core/i18n.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

/**
 * Pre-check (a): the back-office login posts to the staff-only endpoint
 * `/api/auth/back-office-login`, and a CANDIDATE/INTERN account (valid
 * credentials, wrong surface) sees the clear localized "staff only" message
 * instead of a generic error.
 */
describe('LoginComponent (staff-only entry)', () => {
  async function setup() {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        provideRouter([{ path: 'dashboard', component: StubComponent }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }

  function submitAs(component: LoginComponent, email: string) {
    component.email = email;
    component.password = 'secret';
    component.submit();
  }

  it('posts credentials to the staff-only back-office-login endpoint', async () => {
    const { component, http } = await setup();
    submitAs(component, 'admin@steg.tn');
    const req = http.expectOne((r) => r.url.endsWith('/api/auth/back-office-login'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'admin@steg.tn', password: 'secret' });
    req.flush({ error: 'X', message: 'boom' }, { status: 500, statusText: 'Error' });
    expect(component.busy()).toBe(false);
    expect(component.errorMessage()).toBe('boom');
    http.verify();
  });

  it('shows the staff-only message for a CANDIDATE refusal', async () => {
    const { component, fixture, http } = await setup();
    submitAs(component, 'candidate@steg.tn');
    const req = http.expectOne((r) => r.url.endsWith('/api/auth/back-office-login'));
    req.flush(
      { error: 'BACK_OFFICE_DENIED', message: 'Back-office access is restricted.' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.errorMessage()).toBe(
      'Accès réservé aux rôles ADMIN et SUPERVISOR. Ce compte n’a pas accès au Back Office.',
    );
    expect(fixture.nativeElement.textContent as string).toContain('Accès réservé');
    http.verify();
  });

  it('shows the staff-only message for an INTERN refusal too', async () => {
    const { component, http } = await setup();
    submitAs(component, 'intern@steg.tn');
    http
      .expectOne((r) => r.url.endsWith('/api/auth/back-office-login'))
      .flush({ error: 'BACK_OFFICE_DENIED' }, { status: 403, statusText: 'Forbidden' });
    expect(component.errorMessage()).toContain('ADMIN et SUPERVISOR');
    http.verify();
  });

  it('still maps the legacy message-field code', async () => {
    const { component, http } = await setup();
    submitAs(component, 'candidate@steg.tn');
    http
      .expectOne((r) => r.url.endsWith('/api/auth/back-office-login'))
      .flush({ message: 'BACK_OFFICE_DENIED' }, { status: 403, statusText: 'Forbidden' });
    expect(component.errorMessage()).toContain('Back Office');
    http.verify();
  });

  it('keeps the invalid-credentials mapping for 401', async () => {
    const { component, http } = await setup();
    submitAs(component, 'nobody@steg.tn');
    http
      .expectOne((r) => r.url.endsWith('/api/auth/back-office-login'))
      .flush({ error: 'AUTHENTICATION_FAILED' }, { status: 422, statusText: 'Unprocessable' });
    expect(component.errorMessage()).toBe('AUTHENTICATION_FAILED');
    http.verify();
  });
});
