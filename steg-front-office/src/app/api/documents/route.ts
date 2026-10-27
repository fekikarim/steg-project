import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {uploadDocument} from '@/lib/api/application';

/**
 * Browser-facing proxy for `POST /api/documents`. Handles multipart file
 * upload: reads the file from the incoming FormData, attaches the auth token
 * server-side, and forwards to the backend. Rate-limited to 10 uploads/minute.
 */

function unauthorized() {
  return NextResponse.json({message: 'No session.'}, {status: 401});
}

function mapError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const body: ErrorEnvelope = {
      message: err.message,
      status: err.status,
      // Forward the backend error code (FILE_TOO_LARGE, INVALID_FILE_TYPE,
      // MIME_TYPE_SPOOFING_DETECTED, EMPTY_FILE, …) so the browser can map it
      // to a localized message instead of showing the raw English detail.
      error: err.code ?? undefined,
      fieldErrors: err.fieldErrors,
      traceId: err.traceId ?? undefined,
    };
    return NextResponse.json(body, {status: err.status});
  }
  return NextResponse.json({message: 'Unexpected error.'}, {status: 500});
}

export async function POST(req: NextRequest) {
  let token = await accessToken();
  if (!token) return unauthorized();

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const type = req.nextUrl.searchParams.get('type');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({message: 'No file provided.'}, {status: 400});
    }
    if (!type) {
      return NextResponse.json({message: 'Document type is required.'}, {status: 400});
    }

    const doc = await uploadDocument(token, file, type as never);
    return NextResponse.json(doc, {status: 201});
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        const formData = await req.formData();
        const file = formData.get('file');
        const type = req.nextUrl.searchParams.get('type');
        if (!file || !(file instanceof File) || !type) {
          return NextResponse.json({message: 'Invalid request.'}, {status: 400});
        }
        const doc = await uploadDocument(token, file, type as never);
        return NextResponse.json(doc, {status: 201});
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
