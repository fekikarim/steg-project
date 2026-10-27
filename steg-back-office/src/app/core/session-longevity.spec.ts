import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import type { TestRequest } from '@angular/common/http/testing';
import { AuthService, isTerminalRefreshFailure } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * S1 — the premature-session-expiration regression suite for the back office.
 *
 * The failure being pinned down: users were dropped to the login screen minutes
 * after signing in. Two mechanisms caused it, and both are covered here —
 * a transient refresh failure destroying a perfectly good session, and a burst
 * of parallel 401s each starting its own rotation.
 */
@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const stubRoutes = [
  { path: 'dashboard', component: StubComponent },
  { path: 'supervisor-dashboard', component: StubComponent },
  { path: 'login', component: StubComponent },
];

describe('S1 session longevity (AuthService)', () => {
  let auth: AuthService;
  let httpMock: HttpTestingController;

  const URL_REFRESH = `${environment.apiBaseUrl}/api/auth/refresh`;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // handleAuthResponse() navigates after a successful refresh; the
        // targets must exist or the navigation rejects as an unhandled error.
        provideRouter(stubRoutes),
      ],
    });
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    auth.cancelRenewal();
  });

  /**
   * A JWT expiring in `ttlSeconds`, carrying a STAFF role.
   *
   * The role claim is required: the back office refuses any token without one
   * (BACK_OFFICE_DENIED), so a role-less fixture would be testing the role gate
   * rather than the session lifecycle.
   */
  function jwt(ttlSeconds: number, roles: string[] = ['ROLE_ADMIN']): string {
    const enc = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `${enc({ alg: 'none' })}.${enc({ sub: 'u1', exp, email: 'admin@steg.tn', roles })}.sig`;
  }

  function primeSession(accessTtl = 900): void {
    auth.setAccessToken(jwt(accessTtl));
    localStorage.setItem('steg-bo-refresh', 'refresh-1');
  }

  it('a valid refresh yields a new pair and keeps the user signed in', () => {
    primeSession();
    let done = false;
    auth.refresh().subscribe({ next: () => (done = true) });

    const req = httpMock.expectOne(URL_REFRESH);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush({
      accessToken: jwt(900),
      refreshToken: 'refresh-2',
      expiresIn: 900,
      tokenType: 'Bearer',
    });

    expect(done).toBe(true);
    // The rotated token was persisted, so the NEXT refresh uses the new one.
    expect(localStorage.getItem('steg-bo-refresh')).toBe('refresh-2');
  });

  it('parallel callers share ONE refresh (rotation never races)', () => {
    primeSession();
    let completed = 0;
    auth.refresh().subscribe(() => completed++);
    auth.refresh().subscribe(() => completed++);
    auth.refresh().subscribe(() => completed++);

    const requests = httpMock.match(URL_REFRESH);
    expect(requests.length).toBe(1); // one request, not three

    (requests[0] as TestRequest).flush({
      accessToken: jwt(900),
      refreshToken: 'refresh-2',
      expiresIn: 900,
      tokenType: 'Bearer',
    });

    expect(completed).toBe(3);
  });

  it('a 5xx during refresh does NOT sign the user out', () => {
    primeSession();
    let failed = false;
    auth.refresh().subscribe({ error: () => (failed = true) });

    httpMock.expectOne(URL_REFRESH).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(failed).toBe(true);
    // The session survives a server hiccup — this was the logout bug.
    expect(auth.getRefreshToken()).toBe('refresh-1');
    expect(auth.getAccessToken()).not.toBeNull();
  });

  it('a network/0-status failure does NOT sign the user out', () => {
    primeSession();
    auth.refresh().subscribe({ error: () => undefined });

    httpMock.expectOne(URL_REFRESH).error(new ProgressEvent('network error'));

    expect(auth.getRefreshToken()).toBe('refresh-1');
  });

  it('a 409 from a concurrent rotation does NOT sign the user out', () => {
    primeSession();
    auth.refresh().subscribe({ error: () => undefined });

    httpMock.expectOne(URL_REFRESH).flush('conflict', { status: 409, statusText: 'Conflict' });

    expect(auth.getRefreshToken()).toBe('refresh-1');
  });

  it('a 401 DOES end the session', () => {
    primeSession();
    auth.refresh().subscribe({ error: () => undefined });

    httpMock.expectOne(URL_REFRESH).flush('', { status: 401, statusText: 'Unauthorized' });

    expect(auth.getRefreshToken()).toBeNull();
    expect(auth.getAccessToken()).toBeNull();
  });

  it('a 422 naming the refresh token DOES end the session', () => {
    primeSession();
    auth.refresh().subscribe({ error: () => undefined });

    httpMock
      .expectOne(URL_REFRESH)
      .flush({ error: 'INVALID_REFRESH_TOKEN' }, { status: 422, statusText: 'Unprocessable' });

    expect(auth.getRefreshToken()).toBeNull();
  });

  it('a 422 about something else does NOT end the session', () => {
    primeSession();
    auth.refresh().subscribe({ error: () => undefined });

    httpMock
      .expectOne(URL_REFRESH)
      .flush({ error: 'POST_TOO_LONG' }, { status: 422, statusText: 'Unprocessable' });

    expect(auth.getRefreshToken()).toBe('refresh-1');
  });

  it('renews ahead of expiry instead of waiting for a 401', () => {
    primeSession(900);
    // A live token is not renewed eagerly at schedule time.
    auth.scheduleRenewal();
    httpMock.expectNone(URL_REFRESH);
    // …and the timer is cancellable, so sign-out never leaves one pending.
    auth.cancelRenewal();
  });

  it('terminal vs transient classification', () => {
    expect(isTerminalRefreshFailure({ status: 401 })).toBe(true);
    expect(
      isTerminalRefreshFailure({ status: 422, error: { error: 'INVALID_REFRESH_TOKEN' } }),
    ).toBe(true);
    expect(isTerminalRefreshFailure({ status: 422, error: { error: 'OTHER' } })).toBe(false);
    for (const status of [0, 409, 500, 502, 503]) {
      expect(isTerminalRefreshFailure({ status })).toBe(false);
    }
  });

  it('an unauthenticated request never triggers a refresh', () => {
    localStorage.clear();
    auth.setAccessToken(null);
    // No request is issued, so nothing to expect; the guard is that
    // getRefreshToken() is null and therefore refresh() short-circuits.
    let errored = false;
    auth.refresh().subscribe({ error: () => (errored = true) });
    expect(errored).toBe(true);
    httpMock.expectNone(URL_REFRESH);
  });

  it('the role gate still holds: a non-back-office role gets no session', () => {
    // A refreshed token WITHOUT a staff role must not leave a half-session
    // (RBAC is unchanged by the session fix).
    primeSession();
    auth.refresh().subscribe({ error: () => undefined });
    httpMock.expectOne(URL_REFRESH).flush({
      accessToken: jwt(900, ['ROLE_CANDIDATE']),
      refreshToken: 'r',
      expiresIn: 900,
      tokenType: 'Bearer',
    });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getRefreshToken()).toBeNull();
  });
});
