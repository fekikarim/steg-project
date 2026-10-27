import {cookies} from 'next/headers';

/**
 * httpOnly session cookies bridging the browser to the backend JWT flow.
 * Tokens live ONLY here — never in localStorage, sessionStorage, the DOM, or
 * client bundles (B0 task 5). The refresh cookie is path-scoped to our auth
 * routes so the browser does not send it on every same-origin request.
 */
export const ACCESS_COOKIE = 'steg_access';
export const REFRESH_COOKIE = 'steg_refresh';

const ACCESS_MAX_AGE = 15 * 60; // 15 min, mirrors backend access expiry
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, mirrors backend refresh expiry

function baseOptions(path: string, maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path,
    maxAge,
  };
}

export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, baseOptions('/', ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, refreshToken, baseOptions('/api/auth', REFRESH_MAX_AGE));
}

export async function clearSessionCookies() {
  // Delete by overwriting each slot: the refresh cookie is path-scoped to
  // /api/auth, and a path-less delete would miss it (leaving a live refresh
  // token behind). maxAge 0 expires both slots immediately.
  const store = await cookies();
  store.set(ACCESS_COOKIE, '', baseOptions('/', 0));
  store.set(REFRESH_COOKIE, '', baseOptions('/api/auth', 0));
}

export async function readSessionTokens(): Promise<{access: string | null; refresh: string | null}> {
  const store = await cookies();
  return {
    access: store.get(ACCESS_COOKIE)?.value ?? null,
    refresh: store.get(REFRESH_COOKIE)?.value ?? null,
  };
}
