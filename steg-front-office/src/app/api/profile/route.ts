import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {createMyCandidate, getMyCandidate, updateMyCandidate, type CandidateProfileUpdate} from '@/lib/api/candidate';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';

/**
 * Browser-facing proxy for `GET/PUT /api/candidates/me`. The access token is
 * read from the httpOnly session cookie and attached here, never sent to the
 * browser. A stale access token triggers one silent rotation + retry (the
 * same contract as `/api/auth/session`). The candidate's own full national ID
 * is returned to the browser session because the backend authoritatively
 * serves it to self and requires it as part of every PUT; the profile UI masks
 * it and never renders the full value unless the candidate explicitly reveals
 * or edits it.
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
    const profile = await getMyCandidate(token);
    return NextResponse.json(profile);
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await getMyCandidate(token));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}

export async function PUT(req: NextRequest) {
  let body: CandidateProfileUpdate;
  try {
    body = (await req.json()) as CandidateProfileUpdate;
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    const updated = await updateMyCandidate(token, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await updateMyCandidate(token, body));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}

/**
 * Browser-facing proxy for `POST /api/candidates` (self-registration of the
 * candidate profile, exactly once per account). Same session/token contract
 * as GET/PUT; backend 422 codes (CANDIDATE_PROFILE_EXISTS,
 * CANDIDATE_NATIONAL_ID_DUPLICATE) and 400 field errors pass through.
 */
export async function POST(req: NextRequest) {
  let body: CandidateProfileUpdate;
  try {
    body = (await req.json()) as CandidateProfileUpdate;
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    const created = await createMyCandidate(token, body);
    return NextResponse.json(created, {status: 201});
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await createMyCandidate(token, body), {status: 201});
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}