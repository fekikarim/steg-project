import {NextRequest, NextResponse} from 'next/server';

function backendBaseUrl(): string {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
}

/**
 * Public identifier validation proxy (POST /api/public/applications/validate-identifiers).
 * Forwards JSON body {email, nationalId, phone} to backend.
 * The backend handles auth via JWT if present (via Authorization header forwarded from client if available,
 * or via httpOnly session cookie if the Next.js proxy is called with credentials).
 * For anonymous, no token is needed. For authenticated, the backend will resolve current user and
 * exclude own identifiers from duplicate check.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({message: 'Invalid JSON body.'}, {status: 400});
  }

  // Forward Authorization header if present (for authenticated users)
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  // Also forward cookies for session-based auth (httpOnly steg_access)
  const cookie = req.headers.get('cookie');
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${backendBaseUrl()}/api/public/applications/validate-identifiers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    const data: unknown = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const message =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as {message: unknown}).message)
          : 'Validation failed.';
      const duplicateFields =
        typeof data === 'object' && data !== null && 'duplicateFields' in data
          ? (data as {duplicateFields: unknown}).duplicateFields
          : undefined;
      return NextResponse.json({message, duplicateFields, valid: false}, {status: res.status});
    }
    return NextResponse.json(data, {status: 200});
  } catch (err) {
    return NextResponse.json({message: 'Cannot reach the server.'}, {status: 502});
  } finally {
    clearTimeout(timer);
  }
}
