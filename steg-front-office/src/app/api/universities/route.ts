import {NextResponse} from 'next/server';
import {listUniversities} from '@/lib/api/candidate';

/**
 * Public reference data proxy. Universities are a static, public backend list;
 * `force-dynamic` keeps the app build independent of a running backend (a
 * static GET would otherwise be evaluated at build time).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listUniversities());
  } catch {
    return NextResponse.json({message: 'Universities unavailable.'}, {status: 502});
  }
}