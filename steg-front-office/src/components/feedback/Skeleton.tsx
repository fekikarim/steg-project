import {cx} from '@/lib/cx';

/** Skeleton block for content loading states (UI_UX §6.3). */
export function Skeleton({className, label}: {className?: string; label?: string}) {
  return <div role="status" aria-label={label} className={cx('skeleton rounded-lg', className ?? 'h-4 w-full')} />;
}

/** Card-shaped skeleton used by route loading.tsx files. */
export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-navy-900" aria-hidden="true">
      <Skeleton className="h-6 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-10 w-36" />
    </div>
  );
}
