import type {NextRequest} from 'next/server';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

// Next.js 16 `proxy` convention (replaces the deprecated `middleware` file).
// Same runtime and signature — next-intl's handler runs unchanged.
const intlProxy = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return intlProxy(request);
}

export const config = {
  // Skip API routes, Next internals, static assets and files with extensions.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
