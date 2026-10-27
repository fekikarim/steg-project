import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {getApplicationDocuments, attachApplicationDocument} from '@/lib/api/application';
import type {AttachDocumentRequest} from '@/lib/api/application';

/**
 * Browser-facing proxy for `GET/POST /api/applications/[id]/documents`.
 * GET  → list application documents
 * POST → attach an uploaded document to the application
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
    return NextResponse.json(await getApplicationDocuments(token, id));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await getApplicationDocuments(token, id));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}

export async function POST(
  req: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;
  let body: AttachDocumentRequest;
  try {
    body = (await req.json()) as AttachDocumentRequest;
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    const result = await attachApplicationDocument(token, id, body);
    return NextResponse.json(result, {status: 201});
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        const result = await attachApplicationDocument(token, id, body);
        return NextResponse.json(result, {status: 201});
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
