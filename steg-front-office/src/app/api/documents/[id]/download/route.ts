import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken} from '@/lib/api/profile-session';

/**
 * Browser-facing proxy for `GET /api/documents/[id]/download`.
 * Streams backend bytes straight through (never buffered, never stored);
 * the browser downloads via same-origin anchor so httpOnly cookies travel
 * and no token or storage path ever appears in the DOM or URL. Restricted
 * documents stay gated backend-side (403 without DOCUMENT_VIEW_RESTRICTED).
 */

function unauthorized() {
  return NextResponse.json({message: 'No session.'}, {status: 401});
}

function baseUrl() {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
}

function passthroughHeaders(res: Response): Headers {
  const headers = new Headers();
  const contentType = res.headers.get('content-type');
  const disposition = res.headers.get('content-disposition');
  const length = res.headers.get('content-length');
  if (contentType) headers.set('content-type', contentType);
  else headers.set('content-type', 'application/octet-stream');
  if (disposition) headers.set('content-disposition', disposition);
  if (length) headers.set('content-length', length);
  headers.set('cache-control', 'private, no-store');
  return headers;
}

async function fetchDownload(id: string, token: string) {
  return fetch(`${baseUrl()}/api/documents/${encodeURIComponent(id)}/download`, {
    method: 'GET',
    headers: {Authorization: `Bearer ${token}`},
  });
}

async function errorResponse(res: Response): Promise<NextResponse> {
  let envelope: ErrorEnvelope | null = null;
  try {
    envelope = (await res.json()) as ErrorEnvelope;
  } catch {
    /* non-JSON upstream body */
  }
  const err = new ApiError(res.status, envelope, 'Download failed.');
  return NextResponse.json(
    {
      message: err.message,
      status: err.status,
      error: err.code ?? undefined,
      traceId: err.traceId ?? undefined,
    } satisfies ErrorEnvelope,
    {status: res.status},
  );
}

export async function GET(
  _req: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    let upstream = await fetchDownload(id, token);
    if (upstream.status === 401) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      upstream = await fetchDownload(id, token);
    }
    if (!upstream.ok || !upstream.body) return errorResponse(upstream);
    return new NextResponse(upstream.body, {status: 200, headers: passthroughHeaders(upstream)});
  } catch {
    return NextResponse.json({message: 'Cannot reach the server.'}, {status: 502});
  }
}
