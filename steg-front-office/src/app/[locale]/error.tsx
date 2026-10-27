'use client';

import {useEffect} from 'react';
import {ErrorState} from '@/components/feedback/ErrorState';

/** Per-segment error boundary with retry (UI_UX §6, §14.2). */
export default function Error({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
  useEffect(() => {
    // B1+: report to an error-tracking service. Never render internals.
    console.error('Route error:', error.digest ?? error.message);
  }, [error]);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <ErrorState onRetry={reset} />
    </div>
  );
}
