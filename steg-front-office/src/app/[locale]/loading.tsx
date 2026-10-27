import {CardSkeleton} from '@/components/feedback/Skeleton';

/** Route loading state: skeleton shell, never a blank page (UI_UX §6.3). */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="skeleton h-9 w-2/3 rounded-lg" />
      <div className="skeleton h-5 w-1/2 rounded-lg" />
      <CardSkeleton />
    </div>
  );
}
