import type {ReactNode} from 'react';

export function AuthCard({children}: {children: ReactNode}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 py-8 sm:py-16">
      {children}
    </div>
  );
}

export function AuthHeader({eyebrow, title, subtitle}: {eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode}) {
  return (
    <div className="flex w-full flex-col gap-2 text-center">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">{eyebrow}</p>
      )}
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
      {subtitle && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      )}
    </div>
  );
}
