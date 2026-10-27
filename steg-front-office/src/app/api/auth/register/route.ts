import {NextRequest, NextResponse} from 'next/server';
import {ApiError} from '@/lib/api-client';
import {registerCandidate} from '@/lib/api/auth';
import {mapAuthError} from '@/lib/auth-errors';
import {setSessionCookies} from '@/lib/cookies';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    if (!body.email || !body.password || !body.firstName || !body.lastName) {
      return NextResponse.json(
        {reason: 'validation-error', message: 'All required fields must be provided.'},
        {status: 400},
      );
    }
    const auth = await registerCandidate({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone || undefined,
    });
    if (!auth.accessToken || !auth.refreshToken) {
      return NextResponse.json({reason: 'unknown', message: 'Unexpected error.'}, {status: 502});
    }
    await setSessionCookies(auth.accessToken, auth.refreshToken);
    return NextResponse.json({ok: true}, {status: 201});
  } catch (err) {
    if (err instanceof ApiError) {
      const mapped = mapAuthError(err);
      return NextResponse.json(mapped, {status: mapped.status});
    }
    return NextResponse.json({reason: 'unknown', message: 'Unexpected error.'}, {status: 500});
  }
}
