'use client';

import {useId, type SelectHTMLAttributes} from 'react';
import {cx} from '@/lib/cx';
import {FieldError} from './FieldError';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
}

/**
 * Native select: fully keyboard/screen-reader operable with an OS-localized
 * picker. Preferred over custom listboxes for B0 (UI_UX §7, §9.2).
 */
export function Select({
  label,
  hint,
  error,
  hideLabel = false,
  options,
  placeholder,
  id,
  required,
  children,
  className,
  wrapperClassName,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  return (
    <div className={cx('flex w-full flex-col gap-1.5', wrapperClassName)}>
      <label
        htmlFor={selectId}
        className={cx('text-sm font-semibold text-zinc-800 dark:text-zinc-100', hideLabel && 'sr-only')}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 text-accent-600 dark:text-accent-100">
            *
          </span>
        )}
      </label>
      <select
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx(
          'h-10 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 hover:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-70 dark:border-zinc-700 dark:bg-navy-900 dark:text-zinc-100 dark:disabled:bg-white/5',
          error && 'border-accent-600 dark:border-accent-100',
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
