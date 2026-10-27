import type {ReactNode} from 'react';
import {cx} from '@/lib/cx';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

/** Content card (UI_UX §9.5): purpose, concise title, consistent padding with institutional surface elegance. */
export function Card({title, subtitle, action, children, className, labelledBy}: CardProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cx(
        'relative flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6 transition-all duration-200',
        'dark:border-slate-800 dark:bg-navy-900/90 dark:shadow-none',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-white/5">
          <div className="flex flex-col gap-1">
            {title && (
              <h2 id={labelledBy} className="text-base font-bold text-navy-900 dark:text-zinc-50">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
