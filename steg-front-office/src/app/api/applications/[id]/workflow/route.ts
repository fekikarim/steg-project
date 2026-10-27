import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {getApplicationWorkflow} from '@/lib/api/application';

/**
 * Browser-facing proxy for `GET /api/applications/[id]/workflow`.
 * Returns the current workflow instance state for the owning candidate.
 * No instance exists before submit, so backend 404 means "no workflow yet"
 * and is forwarded as-is for the UI to render a timestamps-only timeline.
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

export async function GET(
  _req: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await getApplicationWorkflow(token, id));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await getApplicationWorkflow(token, id));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
