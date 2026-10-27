'use client';

import type {ReactNode} from 'react';
import {FieldError} from '../ui/FieldError';

/** Form-level accessible error summary (UI_UX §9.2, §14). */
export function ErrorSummary({message, traceId}: {message?: ReactNode; traceId?: string}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex w-full flex-col gap-1 rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800 dark:border-accent-900/60 dark:bg-accent-950/40 dark:text-accent-100"
    >
      <span className="font-semibold">{message}</span>
      {traceId && <FieldError message={`Réf : ${traceId}`} />}
    </div>
  );
}
