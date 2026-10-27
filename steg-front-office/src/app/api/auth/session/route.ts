import {NextResponse} from 'next/server';
import {backendFetch} from '@/lib/api-client';
import {clearSessionCookies, readSessionTokens, setSessionCookies} from '@/lib/cookies';
import {refreshBackend} from '@/lib/api/auth';

/**
 * Session probe for the browser: `{authenticated: true}` when a usable access
 * token exists. A missing access token triggers one silent refresh attempt;
 * anything else means anonymous. No tokens ever leave this route.
 */
export async function GET() {
  const {access, refresh} = await readSessionTokens();
  if (access) {
    // Lightweight proof the token still works (public endpoint, auth-gated).
    try {
      await backendFetch<unknown>('/api/universities', {token: access, timeoutMs: 5000});
      return NextResponse.json({authenticated: true});
    } catch {
      /* fall through to the refresh attempt */
    }
  }
  if (!refresh) {
    await clearSessionCookies();
    return NextResponse.json({authenticated: false});
  }
  try {
    const auth = await refreshBackend(refresh);
    if (!auth.accessToken || !auth.refreshToken) throw new Error('empty rotation');
    await setSessionCookies(auth.accessToken, auth.refreshToken);
    return NextResponse.json({authenticated: true});
  } catch {
    await clearSessionCookies();
    return NextResponse.json({authenticated: false});
  }
}
