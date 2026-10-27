import {NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {updatePreferredLocale} from '@/lib/api/preferences';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import type {AppLocale} from '@/i18n/routing';

const SUPPORTED: ReadonlySet<string> = new Set(['fr', 'en', 'ar']);

/**
 * Browser-facing proxy for `PUT /api/users/me/locale`. Persists the active
 * UI locale as the account's preferred locale (drives backend email language
 * and future sessions). Anonymous callers get a silent 204 — the URL prefix
 * remains the source of truth for their language.
 */
export async function PUT(req: Request) {
  let locale: string;
  try {
    locale = ((await req.json()) as {locale?: string}).locale ?? '';
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }
  locale = locale.trim().toLowerCase();
  if (!SUPPORTED.has(locale)) {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  let token = await accessToken();
  if (!token) return new NextResponse(null, {status: 204});
  try {
    await updatePreferredLocale(token, locale as AppLocale);
    return new NextResponse(null, {status: 204});
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return new NextResponse(null, {status: 204});
      try {
        await updatePreferredLocale(token, locale as AppLocale);
        return new NextResponse(null, {status: 204});
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
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
