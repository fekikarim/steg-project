import {NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {getUnreadCount} from '@/lib/api/notifications';

/**
 * Browser-facing proxy for `GET /api/notifications/unread-count`.
 * Powers the header bell badge; polled, never pushed (see realtime seam).
 */

function unauthorized() {
  return NextResponse.json({message: 'No session.'}, {status: 401});
}

function mapError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const body: ErrorEnvelope = {
      message: err.message,
      status: err.status,
      error: err.code ?? undefined,
      fieldErrors: err.fieldErrors,
      traceId: err.traceId ?? undefined,
    };
    return NextResponse.json(body, {status: err.status});
  }
  return NextResponse.json({message: 'Unexpected error.'}, {status: 500});
}

export async function GET() {
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await getUnreadCount(token));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await getUnreadCount(token));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
