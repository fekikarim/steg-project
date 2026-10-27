'use client';

import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {cx} from '@/lib/cx';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'success' | 'icon' | 'cyber';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 dark:bg-brand-500 dark:hover:bg-brand-400 transition-all duration-200',
  cyber:
    'bg-gradient-to-r from-brand-700 via-brand-600 to-sky-600 text-white shadow-sm hover:shadow-md hover:from-brand-600 hover:to-sky-500 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200',
  secondary:
    'border border-slate-300 bg-white text-slate-800 hover:border-brand-500 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-navy-900 dark:text-slate-100 dark:hover:border-brand-400 dark:hover:bg-navy-800 transition-colors duration-150',
  tertiary: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100 dark:text-brand-300 dark:hover:bg-white/5 transition-colors',
  destructive: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 shadow-xs transition-colors',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors',
  icon: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10 transition-colors',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8.5 px-3.5 text-xs font-medium rounded-lg',
  md: 'h-10 px-4.5 text-sm font-semibold rounded-xl',
  lg: 'h-12 px-6 text-base font-semibold rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: string;
  iconOnlyLabel?: string;
  children: ReactNode;
}

/**
 * Shared button (UI_UX §9.1). Verb labels, loading state with aria-busy, and
 * icon-only usage requires `iconOnlyLabel` for screen readers.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  iconOnlyLabel,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const isIcon = variant === 'icon';
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={isIcon ? iconOnlyLabel : undefined}
      title={isIcon ? iconOnlyLabel : undefined}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isIcon ? 'h-10 w-10 rounded-full' : SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
