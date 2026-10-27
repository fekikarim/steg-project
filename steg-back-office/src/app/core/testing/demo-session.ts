/**
 * Test-only session helper.
 *
 * AGENTS.md §0.4 / §14: no mocks or demo shortcuts in delivered code. This
 * helper used to live on `AuthService.signInDemo`, which meant the production
 * bundle shipped a "become any user with one call" primitive. It now lives
 * here, outside `AuthService`, and is imported ONLY from `*.spec.ts` files —
 * the application build (`tsconfig.app.json`, which excludes specs) never
 * reaches it, so `dist/` contains no demo session code. Verified by grepping
 * the built bundle in `docs/back-office-audit.md` ("No mocks/demo data").
 *
 * It drives the same public seams a real login does — `setAccessToken()` and
 * `restoreSession()` — so specs exercise the production persistence path.
 */
import { DEMO_TOKEN_PREFIX } from '../auth.service';
import type { AuthService, SessionUser } from '../auth.service';
import type { StaffRole } from '../roles';

/** Same key AuthService persists under (see `STORAGE_USER` in auth.service.ts). */
const STORAGE_USER = 'steg-bo-session';

/**
 * Creates a staff session without contacting the backend: writes the user to
 * storage, sets the fake access token and lets `AuthService.restoreSession()`
 * pick both up exactly as it does on a real page reload.
 */
export function signInDemo(auth: AuthService, email: string, role: StaffRole): void {
  const displayName =
    email
      .split('@')[0]
      ?.replace(/[._-]+/g, ' ')
      .trim() || email;
  const user: SessionUser = { email, displayName, role, userId: `test-${role.toLowerCase()}` };
  try {
    localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  } catch {
    /* jsdom without storage: only the in-memory token is set */
  }
  auth.setAccessToken(
    `${DEMO_TOKEN_PREFIX}${btoa(JSON.stringify({ sub: user.userId, email, roles: [`ROLE_${role}`] }))}.sig`,
  );
  auth.restoreSession();
}