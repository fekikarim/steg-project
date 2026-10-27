import {NextResponse} from 'next/server';
import {ApiError} from '@/lib/api-client';
import {refreshBackend} from '@/lib/api/auth';
import {clearSessionCookies, readSessionTokens, setSessionCookies} from '@/lib/cookies';

/** Silent-refresh proxy: rotates the cookie pair using the refresh cookie. */
export async function POST() {
  const {refresh} = await readSessionTokens();
  if (!refresh) {
    await clearSessionCookies();
    return NextResponse.json({message: 'No session.'}, {status: 401});
  }
  try {
    const auth = await refreshBackend(refresh);
    if (!auth.accessToken || !auth.refreshToken) {
      await clearSessionCookies();
      return NextResponse.json({message: 'Unexpected error.'}, {status: 502});
    }
    await setSessionCookies(auth.accessToken, auth.refreshToken);
    return NextResponse.json({ok: true});
  } catch (err) {
    // A dead refresh token means the session is over: clear both cookies.
    await clearSessionCookies();
    if (err instanceof ApiError) {
      return NextResponse.json({message: err.message}, {status: 401});
    }
    return NextResponse.json({message: 'Unexpected error.'}, {status: 500});
  }
}
