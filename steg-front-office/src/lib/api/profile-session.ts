import {ApiError} from '../api-client';
import {clearSessionCookies, readSessionTokens, setSessionCookies} from '../cookies';
import {refreshBackend} from './auth';

/**
 * Server-side session bridge for profile route handlers. Returns a usable
 * access token (a plain request when one exists, one silent rotation when the
 * refresh cookie is present), or null when the session is over — in which case
 * the session cookies are cleared so the client falls back to anonymous.
 * Tokens still never reach the browser; this runs exclusively in Next.js route
 * handlers (B0 task 5).
 */
export async function accessToken(forceRefresh = false): Promise<string | null> {
  const {access, refresh} = await readSessionTokens();
  if (access && !forceRefresh) return access;

  if (!refresh) {
    if (access) await clearSessionCookies();
    return null;
  }

  try {
    const auth = await refreshBackend(refresh);
    if (!auth.accessToken || !auth.refreshToken) throw new Error('empty rotation');
    await setSessionCookies(auth.accessToken, auth.refreshToken);
    return auth.accessToken;
  } catch {
    await clearSessionCookies();
    return null;
  }
}

export function isUnauthorized(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 401;
}