import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from './auth.service';
import { permissionGuard } from './guards';
import { permissionsFor, visibleNav, isBackOfficeRole } from './roles';
import { signInDemo } from './testing/demo-session';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const stubRoutes = [
  { path: 'dashboard', component: StubComponent },
  { path: 'supervisor', component: StubComponent },
  { path: 'login', component: StubComponent },
];

describe('AuthService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(stubRoutes)] });
    localStorage.clear();
  });

  it('starts signed out by default', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });

  it('demo sign-in sets role and permissions without persisting tokens', () => {
    const auth = TestBed.inject(AuthService);
    signInDemo(auth, 'admin@steg.tn', 'ADMIN');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('ADMIN');
    expect(auth.hasPermission('FINANCE_PAYMENT_APPROVE')).toBe(true);
    expect(auth.hasPermission('USER_MANAGE')).toBe(true);
    // Test helper now sets a dummy token so interceptors treat it as authenticated
    expect(auth.getAccessToken()).not.toBeNull();
    expect(localStorage.getItem('steg-bo-session') ?? '').not.toContain('token');
  });

  it('supervisor session carries only scoped permissions', () => {
    const auth = TestBed.inject(AuthService);
    signInDemo(auth, 'sup@steg.tn', 'SUPERVISOR');
    expect(auth.hasPermission('INTERNSHIP_VIEW')).toBe(true);
    expect(auth.hasPermission('TASK_MANAGE')).toBe(true);
    expect(auth.hasPermission('APPLICATION_VIEW')).toBe(false);
    expect(auth.hasPermission('CANDIDATE_VIEW')).toBe(true);
    expect(auth.hasPermission('AUDIT_VIEW')).toBe(false);
    expect(auth.hasPermission('NOTIFICATION_MANAGE')).toBe(true);
  });

  it('sign-out clears session', () => {
    const auth = TestBed.inject(AuthService);
    signInDemo(auth, 'admin@steg.tn', 'ADMIN');
    auth.setAccessToken('abc');
    auth.signOut();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });

  it('restored sessions under removed roles are dropped', () => {
    localStorage.setItem(
      'steg-bo-session',
      JSON.stringify({ email: 'x@steg.tn', displayName: 'x', role: 'HR', userId: 'u' }),
    );
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(isBackOfficeRole('HR')).toBe(false);
    expect(isBackOfficeRole('FINANCE')).toBe(false);
    expect(isBackOfficeRole('DIRECTOR')).toBe(false);
    expect(isBackOfficeRole('ADMIN')).toBe(true);
    expect(isBackOfficeRole('SUPERVISOR')).toBe(true);
  });
});

describe('permissionGuard (UX convenience; backend stays authoritative)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(stubRoutes)] });
    localStorage.clear();
  });

  function runGuard(permissions: Parameters<typeof permissionGuard>[0]) {
    return TestBed.runInInjectionContext(() =>
      permissionGuard(permissions)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('lets an Admin through the /supervisors guard (USER_MANAGE)', () => {
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    expect(runGuard(['USER_MANAGE'])).toBe(true);
  });

  it('redirects a Supervisor away from /supervisors to /forbidden (no access, no loop)', () => {
    signInDemo(TestBed.inject(AuthService), 'sup@steg.tn', 'SUPERVISOR');
    const result = runGuard(['USER_MANAGE']);
    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('lets an Admin through the /validation guard (VALIDATION_MANAGE, §5.11)', () => {
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    expect(runGuard(['VALIDATION_MANAGE'])).toBe(true);
  });

  it('redirects a Supervisor away from /validation to /forbidden (§5.11 Admin-only)', () => {
    signInDemo(TestBed.inject(AuthService), 'sup@steg.tn', 'SUPERVISOR');
    const result = runGuard(['VALIDATION_MANAGE']);
    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('lets an Admin through the /certificates guard (CERTIFICATE_MANAGE, §5.7)', () => {
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    expect(runGuard(['CERTIFICATE_MANAGE'])).toBe(true);
  });

  it('redirects a Supervisor away from /certificates to /forbidden (§5.7 Admin-only)', () => {
    signInDemo(TestBed.inject(AuthService), 'sup@steg.tn', 'SUPERVISOR');
    const result = runGuard(['CERTIFICATE_MANAGE']);
    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });
});

describe('roles', () => {
  it('SUPERVISOR sees validation + receipts only; ADMIN sees everything (UX only)', () => {
    const supPaths = visibleNav('SUPERVISOR').flatMap((s) => s.items.map((i) => i.path));
    expect(supPaths).toEqual([
      '/supervisor-dashboard',
      '/candidates',
      '/internships',
      '/supervisor',
      '/notifications',
      '/tasks',
    ]);
    const adminPaths = visibleNav('ADMIN').flatMap((s) => s.items.map((i) => i.path));
    for (const p of [
      '/dashboard',
      '/reports',
      '/applications',
      '/candidates',
      '/internships',
      '/supervisor',
      '/finance',
      '/notifications',
      '/tasks',
      '/audit',
      '/admin',
    ]) {
      expect(adminPaths).toContain(p);
    }
  });

  it('hides the Admin-only /supervisors route from a Supervisor and keeps it for an Admin (§5.6 / §3.4)', () => {
    const supPaths = visibleNav('SUPERVISOR').flatMap((s) => s.items.map((i) => i.path));
    expect(supPaths).not.toContain('/supervisors');
    const adminPaths = visibleNav('ADMIN').flatMap((s) => s.items.map((i) => i.path));
    expect(adminPaths).toContain('/supervisors');
  });

  it('hides the Admin-only /validation route from a Supervisor and keeps it for an Admin (§5.11 / §3.4)', () => {
    const supPaths = visibleNav('SUPERVISOR').flatMap((s) => s.items.map((i) => i.path));
    expect(supPaths).not.toContain('/validation');
    const adminPaths = visibleNav('ADMIN').flatMap((s) => s.items.map((i) => i.path));
    expect(adminPaths).toContain('/validation');
  });

  it('hides the Admin-only /certificates route from a Supervisor and keeps it for an Admin (§5.7 / §3.4)', () => {
    const supPaths = visibleNav('SUPERVISOR').flatMap((s) => s.items.map((i) => i.path));
    expect(supPaths).not.toContain('/certificates');
    const adminPaths = visibleNav('ADMIN').flatMap((s) => s.items.map((i) => i.path));
    expect(adminPaths).toContain('/certificates');
  });

  it('shows each role its own dashboard and hides the other (§8.3)', () => {
    const supPaths = visibleNav('SUPERVISOR').flatMap((s) => s.items.map((i) => i.path));
    expect(supPaths).toContain('/supervisor-dashboard');
    expect(supPaths).not.toContain('/dashboard');
    const adminPaths = visibleNav('ADMIN').flatMap((s) => s.items.map((i) => i.path));
    expect(adminPaths).toContain('/dashboard');
  });

  it('ADMIN holds admin permissions; SUPERVISOR holds scoped ones', () => {
    expect(permissionsFor('ADMIN')).toContain('APPLICATION_REVIEW');
    expect(permissionsFor('ADMIN')).toContain('USER_MANAGE');
    expect(permissionsFor('SUPERVISOR')).toContain('TASK_MANAGE');
    expect(permissionsFor('SUPERVISOR')).not.toContain('APPLICATION_REVIEW');
    expect(permissionsFor('SUPERVISOR')).not.toContain('INTERNSHIP_ASSIGN');
    expect(permissionsFor('SUPERVISOR')).not.toContain('REPORT_VIEW');
  });
});

describe('permissionGuard (UX convenience; backend stays authoritative)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(stubRoutes)] });
    localStorage.clear();
  });

  function runGuard(permissions: Parameters<typeof permissionGuard>[0]) {
    return TestBed.runInInjectionContext(() =>
      permissionGuard(permissions)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('lets an Admin through the /supervisors guard (USER_MANAGE)', () => {
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    expect(runGuard(['USER_MANAGE'])).toBe(true);
  });

  it('redirects a Supervisor away from /supervisors to /forbidden (denied, no access)', () => {
    signInDemo(TestBed.inject(AuthService), 'sup@steg.tn', 'SUPERVISOR');
    const result = runGuard(['USER_MANAGE']);
    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('lets both roles through the /tasks/drafts guard (TASK_MANAGE, §7.4)', () => {
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    expect(runGuard(['TASK_MANAGE'])).toBe(true);
    signInDemo(TestBed.inject(AuthService), 'sup@steg.tn', 'SUPERVISOR');
    expect(runGuard(['TASK_MANAGE'])).toBe(true);
  });
});
