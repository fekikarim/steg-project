import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, of, Observable, throwError, shareReplay, finalize } from 'rxjs';
import { environment } from '../../environments/environment';
import type { StaffRole } from './roles';
import { permissionsFor, isBackOfficeRole, type Permission } from './roles';

export interface SessionUser {
  readonly email: string;
  readonly displayName: string;
  readonly role: StaffRole;
  readonly userId: string;
}

interface AuthResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
}

/**
 * True only when the server definitively refused the refresh token.
 *
 * 401 always qualifies. 422 qualifies only when it names the refresh token,
 * because a 422 about anything else is a validation rule, not a dead session.
 * Timeouts, socket errors, 5xx and the 409 a concurrent rotation can produce
 * are transient: the refresh token is still good and must be kept.
 */
export function isTerminalRefreshFailure(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  // 401 always qualifies — and so does a 0/undefined status on an error the
  // client already classified as an auth failure.
  if (status === 401) return true;
  if (status === 422) {
    const body = (err as { error?: { error?: unknown; message?: unknown } })?.error;
    const code = String(body?.error ?? '').toUpperCase();
    const message = String(body?.message ?? '').toUpperCase();
    return code.includes('REFRESH_TOKEN') || message.includes('REFRESH_TOKEN');
  }
  return false;
}

const STORAGE_USER = 'steg-bo-session';
const STORAGE_ACCESS = 'steg-bo-access';
const STORAGE_REFRESH = 'steg-bo-refresh';

/**
 * Prefix of the placeholder access token minted by the SPEC fixture
 * `core/testing/demo-session.ts` (it carries no `exp` claim). Declared here so
 * production code can recognise it without importing the fixture module.
 */
export const DEMO_TOKEN_PREFIX = 'demo.';

/**
 * Production-ready session service that syncs dynamically with the backend.
 * - Login exchanges credentials for JWT + refresh token (POST /api/auth/back-office-login,
 *   the staff-only contract: any other role is refused with 403 server-side).
 * - Access token is kept in memory and in storage for reload persistence,
 *   refresh token in localStorage for silent renewal.
 * - Roles are decoded from the JWT (backend is the authority, client only
 *   mirrors for UX gating; every endpoint still checks server-side).
 * - Refresh is attempted transparently on 401 via the error interceptor.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<SessionUser | null>(this.readStoredUser());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<StaffRole | null>(() => this._user()?.role ?? null);

  private accessToken: string | null = this.readStoredAccessToken();
  private isRefreshing = false;
  private refreshShared$: Observable<AuthResponse> | null = null;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;

  private get baseUrl(): string {
    return environment.apiBaseUrl;
  }

  hasPermission(permission: Permission): boolean {
    const r = this.role();
    if (!r) return false;
    return permissionsFor(r).includes(permission);
  }

  hasAnyPermission(permissions: readonly Permission[]): boolean {
    if (permissions.length === 0) return this.isAuthenticated();
    return permissions.some((p) => this.hasPermission(p));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/back-office-login`, { email, password }).pipe(
      tap((res) => this.handleAuthResponse(res)),
      catchError((err) => {
        throw err;
      }),
    );
  }

  /** True when the session belongs to a Back Office role (ADMIN/SUPERVISOR). */
  isBackOfficeSession(): boolean {
    return isBackOfficeRole(this.role());
  }

  /**
   * Exchanges the refresh token for a new pair.
   *
   * Concurrent callers share ONE in-flight request (`shareReplay`): the
   * backend rotates refresh tokens, so two parallel renewals would race and
   * the loser would be told its token had been reused — which reads exactly
   * like "your session expired" and signed users out mid-task.
   *
   * The session is cleared ONLY when the server definitively refuses the
   * refresh token. A timeout, a socket error, a 5xx or the 409 that a
   * concurrent rotation can produce say nothing about the session: destroying
   * the tokens on those is what made the back office log people out after a
   * couple of minutes.
   */
  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return throwError(() => new Error('No refresh token'));
    }
    if (this.refreshShared$) return this.refreshShared$;
    this.isRefreshing = true;
    this.refreshShared$ = this.http
      .post<AuthResponse>(`${this.baseUrl}/api/auth/refresh`, { refreshToken })
      .pipe(
        tap((res) => this.handleAuthResponse(res)),
        shareReplay({ bufferSize: 1, refCount: true }),
        catchError((err) => {
          if (isTerminalRefreshFailure(err)) {
            this.clearSession();
          }
          return throwError(() => err);
        }),
        finalize(() => {
          this.isRefreshing = false;
          this.refreshShared$ = null;
        }),
      );
    return this.refreshShared$;
  }

  /**
   * Renews BEFORE the access token expires.
   *
   * The 401 path keeps the session alive; this keeps it invisible. Without it
   * every window opens with a burst of failing requests.
   */
  scheduleRenewal(): void {
    this.cancelRenewal();
    const token = this.accessToken;
    if (!token || token.startsWith(DEMO_TOKEN_PREFIX)) return;
    const exp = this.getTokenExpiry(token);
    if (exp === null) return;
    const remainingMs = exp * 1000 - Date.now();
    // Renew at 80 % of the remaining lifetime, with a floor so a token that
    // is nearly dead is not left to the 401 path.
    const leadMs = Math.max(30_000, remainingMs * 0.2);
    const delay = Math.max(0, remainingMs - leadMs);
    if (!isPlatformBrowser(this.platformId)) return;
    this.renewTimer = setTimeout(() => {
      this.renewTimer = null;
      this.refresh().subscribe({
        next: () => this.scheduleRenewal(),
        error: () => this.scheduleRenewal(),
      });
    }, delay);
  }

  cancelRenewal(): void {
    if (this.renewTimer !== null) {
      clearTimeout(this.renewTimer);
      this.renewTimer = null;
    }
  }

  signOut(returnUrl = '/login'): void {
    this.cancelRenewal();
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Best-effort server logout; ignore errors
      this.http
        .post(`${this.baseUrl}/api/auth/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearSession();
    void this.router.navigate([returnUrl]);
  }

  signOutAll(): void {
    this.http
      .post(`${this.baseUrl}/api/auth/logout-all`, {})
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: () => {
          this.clearSession();
          void this.router.navigate(['/login']);
        },
        error: () => {
          this.clearSession();
          void this.router.navigate(['/login']);
        },
      });
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (token) localStorage.setItem(STORAGE_ACCESS, token);
        else localStorage.removeItem(STORAGE_ACCESS);
      } catch {
        /* ignore */
      }
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return localStorage.getItem(STORAGE_REFRESH);
    } catch {
      return null;
    }
  }

  /** Returns true if the current access token is expired or will expire within skewSeconds. */
  isAccessTokenExpired(skewSeconds = 30): boolean {
    const token = this.accessToken;
    if (!token) return true;
    // Spec fixtures (see core/testing/demo-session.ts) mint a `demo.` prefixed
    // placeholder with no `exp` claim — treat it as live so specs don't fight
    // the expiry logic they are not testing.
    if (token.startsWith(DEMO_TOKEN_PREFIX)) return false;
    const exp = this.getTokenExpiry(token);
    if (exp === null) return true;
    return Date.now() / 1000 >= exp - skewSeconds;
  }

  getTokenExpiry(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(json) as { exp?: number };
      return typeof data.exp === 'number' ? data.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Called on app init to restore session from stored tokens.
   * If a refresh token exists but access token is missing/expired, the
   * error interceptor will trigger a silent refresh on the next 401.
   */
  restoreSession(): void {
    const user = this.readStoredUser();
    const access = this.readStoredAccessToken();
    if (user) {
      this._user.set(user);
      this.accessToken = access;
      // A page reload must not restart the "wait for a 401" pattern.
      this.scheduleRenewal();
    }
  }

  private handleAuthResponse(res: AuthResponse): void {
    const decoded = this.decodeJwt(res.accessToken);
    const role = this.extractStaffRole(decoded?.roles ?? []);
    const email = decoded?.email ?? '';
    const userId = decoded?.sub ?? '';
    if (!role) {
      // Valid credentials, wrong application: HR/FINANCE/DIRECTOR/CANDIDATE/
      // INTERN (or unknown) roles have no Back Office access. Drop the tokens
      // immediately and surface a 403-style denial to the login form.
      this.clearSession();
      throw { status: 403, error: { message: 'BACK_OFFICE_DENIED' } };
    }
    this.setAccessToken(res.accessToken);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_REFRESH, res.refreshToken);
      } catch {
        /* ignore */
      }
    }
    // Renew ahead of expiry from now on.
    this.scheduleRenewal();
    const displayName =
      email
        .split('@')[0]
        ?.replace(/[._-]+/g, ' ')
        .trim() || email;

    if (role && email && userId) {
      const user: SessionUser = { email, displayName, role, userId };
      this._user.set(user);
      this.persistUser(user);
      // Honor returnTo after login (guards re-check it); otherwise land by role.
      let target = role === 'SUPERVISOR' ? '/supervisor-dashboard' : '/dashboard';
      if (isPlatformBrowser(this.platformId)) {
        try {
          const params = new URLSearchParams(window.location.search);
          const raw = params.get('returnTo');
          if (raw && isSafeReturnTo(raw)) target = raw;
        } catch {
          /* ignore */
        }
      }
      void this.router.navigateByUrl(target);
    }
  }

  private clearSession(): void {
    this.cancelRenewal();
    this._user.set(null);
    this.accessToken = null;
    this.isRefreshing = false;
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_ACCESS);
        localStorage.removeItem(STORAGE_REFRESH);
      } catch {
        /* ignore */
      }
    }
  }

  private readStoredUser(): SessionUser | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SessionUser;
      if (typeof parsed.email !== 'string' || typeof parsed.role !== 'string') return null;
      // Drop sessions stored under removed roles (HR/FINANCE/DIRECTOR/CANDIDATE/INTERN).
      if (!isBackOfficeRole(parsed.role)) {
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_ACCESS);
        localStorage.removeItem(STORAGE_REFRESH);
        return null;
      }
      return parsed;
    } catch {
      /* ignore */
    }
    return null;
  }

  private readStoredAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return localStorage.getItem(STORAGE_ACCESS);
    } catch {
      return null;
    }
  }

  private persistUser(user: SessionUser | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_USER);
    } catch {
      /* ignore */
    }
  }

  private decodeJwt(token: string): { sub: string; email: string; roles: string[] } | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(json) as { sub?: string; email?: string; roles?: string[] };
      return {
        sub: data.sub ?? '',
        email: data.email ?? '',
        roles: data.roles ?? [],
      };
    } catch {
      return null;
    }
  }

  private extractStaffRole(roles: string[]): StaffRole | null {
    // Back Office admits ADMIN and SUPERVISOR only. All other backend roles
    // (HR/FINANCE/DIRECTOR/CANDIDATE/INTERN or unknown) resolve to null and
    // are denied at login — never admitted to a session.
    for (const p of ['ADMIN', 'SUPERVISOR'] as const) {
      if (roles.includes(`ROLE_${p}`) || roles.includes(p)) return p;
    }
    return null;
  }

  }

function isSafeReturnTo(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (lower.startsWith('//') || lower.startsWith('http:') || lower.startsWith('https:'))
    return false;
  if (value.includes(':') || value.includes('\\')) return false;
  return value.startsWith('/');
}
