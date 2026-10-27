import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {validateStoredDocumentAi} from '@/lib/api/application';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';

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

export async function POST(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  let token = await accessToken();
  if (!token) return unauthorized();
  let body: unknown = null;
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = null;
  }
  const payload =
    body && typeof body === 'object'
      ? (body as {expectedType?: string; fullName?: string})
      : {};
  try {
    const result = await validateStoredDocumentAi(token, id, payload);
    return NextResponse.json(result);
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        const result = await validateStoredDocumentAi(token, id, payload);
        return NextResponse.json(result);
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
