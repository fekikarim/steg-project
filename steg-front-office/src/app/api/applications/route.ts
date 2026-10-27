import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {
  createApplication,
  listApplications,
  type ApplicationCreateRequest,
} from '@/lib/api/application';

/**
 * Browser-facing proxy for `GET/POST /api/applications`. The access token is
 * read from the httpOnly session cookie and attached server-side.
 *
 * GET  → list the candidate's own applications
 * POST → create a new DRAFT application
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

export async function GET() {
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await listApplications(token));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await listApplications(token));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}

export async function POST(req: NextRequest) {
  let body: ApplicationCreateRequest;
  try {
    body = (await req.json()) as ApplicationCreateRequest;
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    const app = await createApplication(token, body);
    return NextResponse.json(app, {status: 201});
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        const app = await createApplication(token, body);
        return NextResponse.json(app, {status: 201});
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
