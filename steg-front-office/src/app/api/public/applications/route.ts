import {NextRequest, NextResponse} from 'next/server';
import {ApiError} from '@/lib/api-client';

function backendBaseUrl(): string {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
}

/**
 * Public anonymous submission proxy (`POST /api/public/applications`).
 * Forwards the multipart body (JSON `application` part + `documents` files)
 * untouched — no session required, no token attached. Rate limiting and
 * CIN-uniqueness are enforced backend-side.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({message: 'Invalid multipart body.'}, {status: 400});
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${backendBaseUrl()}/api/public/applications`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    const data: unknown = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const message =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as {message: unknown}).message)
          : 'Submission failed.';
      return NextResponse.json({message}, {status: res.status});
    }
    return NextResponse.json(data, {status: res.status});
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({message: err.message}, {status: err.status});
    return NextResponse.json({message: 'Cannot reach the server.'}, {status: 502});
  } finally {
    clearTimeout(timer);
  }
}
