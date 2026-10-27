import {NextRequest, NextResponse} from 'next/server';
import {ApiError} from '@/lib/api-client';
import {mapAuthError} from '@/lib/auth-errors';
import {loginBackend} from '@/lib/api/auth';
import {setSessionCookies} from '@/lib/cookies';

/** Thin token-exchange proxy: backend JWTs land in httpOnly cookies, never in the response body. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {email?: string; password?: string};
    if (!body.email || !body.password) {
      return NextResponse.json(
        {reason: 'validation-error', message: 'Email and password are required.'},
        {status: 400},
      );
    }
    const auth = await loginBackend({email: body.email, password: body.password});
    if (!auth.accessToken || !auth.refreshToken) {
      return NextResponse.json({reason: 'unknown', message: 'Unexpected error.'}, {status: 502});
    }
    await setSessionCookies(auth.accessToken, auth.refreshToken);
    return NextResponse.json({ok: true});
  } catch (err) {
    if (err instanceof ApiError) {
      const mapped = mapAuthError(err);
      return NextResponse.json(mapped, {status: mapped.status});
    }
    return NextResponse.json({reason: 'unknown', message: 'Unexpected error.'}, {status: 500});
  }
}
