import { TestBed } from '@angular/core/testing';
import { ApprovalDialogComponent } from './approval-dialog.component';
import { CredentialsDialogComponent } from './credentials-dialog.component';
import type { Department } from '../../core/api-models';

const SUPERVISORS = [
  { userId: 'admin-1', email: 'admin@steg.tn', role: 'ADMIN' },
  { userId: 'sup-1', email: 'sup@steg.tn', role: 'SUPERVISOR' },
];
const DEPARTMENTS: readonly Department[] = [
  {
    id: 'dept-1',
    code: 'IT',
    name: 'Informatique',
    description: null,
    active: true,
    parentDepartmentId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 0,
  },
  {
    id: 'dept-2',
    code: 'FIN',
    name: 'Finance',
    description: null,
    active: true,
    parentDepartmentId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 0,
  },
];

describe('ApprovalDialogComponent', () => {
  async function setup(): Promise<ApprovalDialogComponent> {
    await TestBed.configureTestingModule({ imports: [ApprovalDialogComponent] }).compileComponents();
    return TestBed.createComponent(ApprovalDialogComponent).componentInstance;
  }

  it('preselects the acting Admin and confirms with the selection', async () => {
    const component = await setup();
    component.supervisors = SUPERVISORS;
    component.departments = DEPARTMENTS;
    component.preselectedUserId = 'admin-1';
    component.open = true;
    component.ngOnChanges();

    expect(component.supervisorId()).toBe('admin-1');
    expect(component.departmentId()).toBe('dept-1');

    let selection: unknown = null;
    component.confirmed.subscribe((s) => (selection = s));
    component.supervisorId.set('sup-1');
    component.confirm();
    expect(selection).toEqual({ supervisorUserId: 'sup-1', departmentId: 'dept-1' });
  });

  it('falls back to the first supervisor when the acting Admin is absent from the list', async () => {
    const component = await setup();
    component.supervisors = [{ userId: 'sup-1', email: 'sup@steg.tn', role: 'SUPERVISOR' }];
    component.departments = DEPARTMENTS;
    component.preselectedUserId = 'admin-1';
    component.open = true;
    component.ngOnChanges();

    expect(component.supervisorId()).toBe('sup-1');
  });

  it('cannot confirm without supervisor and department (empty lists)', async () => {
    const component = await setup();
    component.open = true;
    component.ngOnChanges();
    expect(component.canConfirm()).toBe(false);

    let emitted = false;
    component.confirmed.subscribe(() => (emitted = true));
    component.confirm();
    expect(emitted).toBe(false);
  });
});

describe('CredentialsDialogComponent', () => {
  async function setup(): Promise<CredentialsDialogComponent> {
    await TestBed.configureTestingModule({
      imports: [CredentialsDialogComponent],
    }).compileComponents();
    return TestBed.createComponent(CredentialsDialogComponent).componentInstance;
  }

  it('copies the one-time password and flips the copied flag', async () => {
    const component = await setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    component.open = true;
    component.password = 'OneTime-Passw0rd!';
    component.ngOnChanges();
    component.copy();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('OneTime-Passw0rd!');
    expect(component.copied()).toBe(true);
  });

  it('surfaces the email status and emits a resend request', async () => {
    const component = await setup();
    component.open = true;
    component.email = 'intern@steg.tn';
    component.emailSent = false;
    component.ngOnChanges();

    let resent = false;
    component.resendRequested.subscribe(() => (resent = true));
    component.resendRequested.emit();
    expect(resent).toBe(true);
  });

  it('does not attempt a copy without a password', async () => {
    const component = await setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    component.open = true;
    component.password = '';
    component.ngOnChanges();
    component.copy();
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('renders the email-failed alert when the credentials email did not send, and the OK flag when it did', async () => {
    await TestBed.configureTestingModule({
      imports: [CredentialsDialogComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(CredentialsDialogComponent);
    const component = fixture.componentInstance;

    component.open = true;
    component.email = 'intern@steg.tn';
    component.password = 'OneTime-Passw0rd!';
    component.emailSent = false;
    component.ngOnChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.st-flag--ok')).toBeNull();

    // Update through the input API (how the dossier feeds it) and let the
    // fixture settle before asserting the branch swap.
    fixture.componentRef.setInput('emailSent', true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.st-flag--ok')).toBeTruthy();
  });
});
