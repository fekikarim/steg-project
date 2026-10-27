import type {ReactNode} from 'react';
import {Card} from '@/components/ui/Card';

/**
 * Shared step shell: consistent title/eyebrow/intro across wizard steps plus
 * the card body. Keeps step components focused on their content.
 */
export function StepShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold text-navy-900 dark:text-zinc-50">{title}</h2>
        {intro && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{intro}</p>}
      </div>
      <Card>{children}</Card>
    </div>
  );
}
