import {NextRequest, NextResponse} from 'next/server';

function backendBaseUrl(): string {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
}

/**
 * Public tracking proxy (`POST /api/public/applications/track`).
 * Forwards `{trackingToken}` — no session required. The backend scopes the
 * response to the token holder (reference, status, timeline; no PII beyond
 * what the holder submitted).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }
  const token =
    typeof body === 'object' && body !== null && 'trackingToken' in body
      ? String((body as {trackingToken: unknown}).trackingToken ?? '').trim()
      : '';
  if (!token) return NextResponse.json({message: 'A tracking token is required.'}, {status: 400});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${backendBaseUrl()}/api/public/applications/track`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({trackingToken: token}),
      signal: controller.signal,
    });
    const text = await res.text();
    const data: unknown = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const message =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as {message: unknown}).message)
          : 'Tracking failed.';
      return NextResponse.json({message}, {status: res.status});
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({message: 'Cannot reach the server.'}, {status: 502});
  } finally {
    clearTimeout(timer);
  }
}
