import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {getApplication, updateApplication, type ApplicationUpdateRequest} from '@/lib/api/application';

/**
 * Browser-facing proxy for `GET/PUT /api/applications/[id]`. The access token
 * is read from the httpOnly session cookie and attached server-side.
 */

function unauthorized() {
  return NextResponse.json({message: 'No session.'}, {status: 401});
}

function mapError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const body: ErrorEnvelope = {
      message: err.message,
      status: err.status,
      fieldErrors: err.fieldErrors,
      traceId: err.traceId ?? undefined,
    };
    return NextResponse.json(body, {status: err.status});
  }
  return NextResponse.json({message: 'Unexpected error.'}, {status: 500});
}

export async function GET(
  _req: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await getApplication(token, id));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await getApplication(token, id));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}

export async function PUT(
  req: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;
  let body: ApplicationUpdateRequest;
  try {
    body = (await req.json()) as ApplicationUpdateRequest;
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await updateApplication(token, id, body));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await updateApplication(token, id, body));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
