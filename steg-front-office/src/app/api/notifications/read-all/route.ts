import {NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {markAllNotificationsRead} from '@/lib/api/notifications';

/**
 * Browser-facing proxy for `POST /api/notifications/read-all`.
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

export async function POST() {
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await markAllNotificationsRead(token));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await markAllNotificationsRead(token));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
