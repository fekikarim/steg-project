import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {listNotifications} from '@/lib/api/notifications';

/**
 * Browser-facing proxy for `GET /api/notifications` (own IN_APP deliveries,
 * paginated). Query params pass through with sane caps; the backend scopes
 * every query to the caller server-side.
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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const options = {
    unreadOnly: q.get('unreadOnly') === 'true',
    page: Math.max(0, Number.parseInt(q.get('page') ?? '0', 10) || 0),
    size: Math.min(50, Math.max(1, Number.parseInt(q.get('size') ?? '20', 10) || 20)),
  };
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await listNotifications(token, options));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await listNotifications(token, options));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
