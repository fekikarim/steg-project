import {NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';

/**
 * Map a backend/proxy failure to a valid HTTP response (server-side only).
 *
 * Transport failures surface as ApiError status 0 (timeout/unreachable),
 * which is NOT a valid HTTP status — passing it to NextResponse.json throws
 * `RangeError: init["status"] must be in the range of 200 to 599` and masks
 * the real problem. Normalize: 0 → 504 (upstream timeout), other
 * out-of-range → 502 (bad gateway). The backend `code` (e.g.
 * AI_TEMPORARILY_UNAVAILABLE, INVALID_DOCUMENT) and traceId are preserved so
 * the UI can distinguish genuine outages from document/validation problems.
 */
export function mapProxyError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const httpStatus = err.status >= 200 && err.status <= 599 ? err.status : err.status === 0 ? 504 : 502;
    const body: ErrorEnvelope = {
      message: err.message,
      status: httpStatus,
      error: err.code ?? undefined,
      fieldErrors: err.fieldErrors,
      traceId: err.traceId ?? undefined,
    };
    return NextResponse.json(body, {status: httpStatus});
  }
  return NextResponse.json({message: 'Unexpected error.'}, {status: 500});
}
