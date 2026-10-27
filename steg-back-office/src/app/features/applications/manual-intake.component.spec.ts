import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ManualIntakeComponent } from './manual-intake.component';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import { signInDemo } from '../../core/testing/demo-session';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

describe('ManualIntakeComponent', () => {
  async function setup(api: Partial<Record<string, (...args: never[]) => unknown>>) {
    await TestBed.configureTestingModule({
      imports: [ManualIntakeComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
        ]),
        {
          provide: ApiClient,
          useValue: {
            listUniversities: () => of([{ id: 'u1', code: 'ENIT', name: 'ENIT', active: true }]),
            submitManualApplication: () =>
              of({ reference: 'APP-2026-0099', status: 'SUBMITTED', trackingToken: 'tok-123' }),
            ...api,
          },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    const fixture = TestBed.createComponent(ManualIntakeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function fill(component: ManualIntakeComponent): void {
    Object.assign(component.fields, {
      firstName: 'Walk',
      lastName: 'In',
      email: 'walk.in@example.tn',
      nationalId: 'CIN-11223344',
      universityId: 'u1',
      desiredStartDate: '2026-07-01',
      desiredEndDate: '2026-08-31',
    });
  }

  it('submits fields + files and reveals reference with tracking token', async () => {
    const received: { fields?: unknown; files?: readonly File[] } = {};
    const fixture = await setup({
      submitManualApplication: (fields: never, files: never) => {
        received.fields = fields;
        received.files = files as readonly File[];
        return of({ reference: 'APP-2026-0099', status: 'SUBMITTED', trackingToken: 'tok-123' });
      },
    });
    const component = fixture.componentInstance;
    fill(component);
    const file1 = new File(['%PDF'], 'demande.pdf', { type: 'application/pdf' });
    const input1 = document.createElement('input');
    Object.defineProperty(input1, 'files', { value: [file1] });
    component.onFile({ target: input1 } as unknown as Event, 'application');

    const file2 = new File(['%PDF'], 'affectation.pdf', { type: 'application/pdf' });
    const input2 = document.createElement('input');
    Object.defineProperty(input2, 'files', { value: [file2] });
    component.onFile({ target: input2 } as unknown as Event, 'assignment');

    component.submit();
    expect(received?.fields).toMatchObject({ firstName: 'Walk', universityId: 'u1' });
    expect(received.files).toBeTruthy();
    expect(received.files?.length).toBe(2);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('APP-2026-0099');
    expect(text).toContain('tok-123');
  });

  it('rejects oversized files before any backend call', async () => {
    let called = false;
    const fixture = await setup({
      submitManualApplication: () => {
        called = true;
        return of({});
      },
    });
    const component = fixture.componentInstance;
    const big = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [big] });
    component.onFile({ target: input } as unknown as Event, 'application');
    expect(component.applicationLetterError()).toBeTruthy();
    expect(called).toBe(false);
  });

  it('maps backend fieldErrors onto the form without inventing rules', async () => {
    const fixture = await setup({
      submitManualApplication: () =>
        throwError(() => ({
          error: {
            message: 'Validation failed',
            fieldErrors: [{ field: 'nationalId', message: 'Already used' }],
          },
        })),
    });
    const component = fixture.componentInstance;
    fill(component);
    component.submit();
    expect(component.fieldErrors()).toEqual([{ field: 'nationalId', message: 'Already used' }]);
    expect(component.formError()).toContain('Validation failed');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent as string).toContain('Already used');
  });
});
