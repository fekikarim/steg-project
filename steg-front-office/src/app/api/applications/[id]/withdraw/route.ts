import {NextRequest, NextResponse} from 'next/server';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';
import {mapProxyError as mapError} from '@/lib/api-error-response';
import {withdrawApplication} from '@/lib/api/application';

/**
 * Browser-facing proxy for `POST /api/applications/[id]/withdraw`.
 * The backend owns eligibility (refuses APPROVED / already-WITHDRAWN);
 * rejections surface with status + code + traceId for localized display.
 */

function unauthorized() {
  return NextResponse.json({message: 'No session.'}, {status: 401});
}

export async function POST(
  _req: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;
  let token = await accessToken();
  if (!token) return unauthorized();
  try {
    return NextResponse.json(await withdrawApplication(token, id));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return unauthorized();
      try {
        return NextResponse.json(await withdrawApplication(token, id));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}
