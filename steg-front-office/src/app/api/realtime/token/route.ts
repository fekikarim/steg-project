import {NextResponse} from 'next/server';
import {accessToken} from '@/lib/api/profile-session';

function backendWsBase(): string {
  const base = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
  return process.env.WS_BASE_URL || base.replace(/^http/, 'ws');
}

/**
 * Same-origin WS credentialbootstrap for the browser STOMP client.
 *
 * Returns the caller's own short-lived backend access token plus the WS base
 * URL so `lib/realtime.ts` can open an authenticated `/ws?token=` handshake.
 * Same-origin + authenticated only; no secret beyond the caller's own token
 * (same risk profile as the Angular client's localStorage token).
 */
export async function GET() {
  const token = await accessToken();
  if (!token) return NextResponse.json({message: 'No session.'}, {status: 401});
  return NextResponse.json({wsUrl: backendWsBase(), token});
}
