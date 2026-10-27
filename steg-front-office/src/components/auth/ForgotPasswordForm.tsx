'use client';

import {Link} from '@/i18n/navigation';
import {AuthCard, AuthHeader} from './AuthCard';

interface ForgotLabels {
  title: string;
  subtitle: string;
  unavailableTitle: string;
  unavailableBody: string;
  backlink: string;
  contactSupport: string;
}

/**
 * Forgot-password status flow (E3.1).
 *
 * Provides honest status regarding password recovery workflows and directs
 * candidates holding reset tokens to the reset password interface.
 */
export function ForgotPasswordForm({labels}: {labels: ForgotLabels}) {
  return (
    <AuthCard>
      <AuthHeader title={labels.title} subtitle={labels.subtitle} />
      <div className="flex w-full flex-col gap-5">
        <div
          role="status"
          className="flex w-full flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-900/60 dark:bg-brand-950/40"
        >
          <span className="font-semibold text-brand-800 dark:text-brand-200">{labels.unavailableTitle}</span>
          <span className="text-zinc-700 dark:text-zinc-300">{labels.unavailableBody}</span>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/reset-password"
            className="text-center text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {labels.contactSupport}
          </Link>
          <Link
            href="/login"
            className="text-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            {labels.backlink}
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
