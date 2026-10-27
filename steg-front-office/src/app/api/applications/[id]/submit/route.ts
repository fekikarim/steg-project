import {NextRequest, NextResponse} from 'next/server';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {mapProxyError as mapError} from '@/lib/api-error-response';
import {submitApplication} from '@/lib/api/application';

/**
 * Browser-facing proxy for `POST /api/applications/[id]/submit`.
 * Transitions a DRAFT application to SUBMITTED.
 */

function unauthorized() {
  return NextResponse.json({message: 'No session.'}, {status: 401});
}

export async function POST(
  req: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;
  // Forward the client's idempotency key so double-clicks, refreshes and
  // retries after a timeout replay the same stored response server-side
  // instead of re-executing the submit.
  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim() || undefined;
  const opts = idempotencyKey ? {idempotencyKey} : {};
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await submitApplication(token, id, opts));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await submitApplication(token, id, opts));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
