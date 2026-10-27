import {NextResponse} from 'next/server';
import {logoutBackend} from '@/lib/api/auth';
import {clearSessionCookies, readSessionTokens} from '@/lib/cookies';

/** Clean logout: best-effort backend revocation, then both cookies cleared. */
export async function POST() {
  const {refresh} = await readSessionTokens();
  if (refresh) await logoutBackend(refresh);
  await clearSessionCookies();
  return NextResponse.json({ok: true});
}
