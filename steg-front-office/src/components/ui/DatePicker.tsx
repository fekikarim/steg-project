'use client';

import {useId, type InputHTMLAttributes} from 'react';
import {cx} from '@/lib/cx';
import {FieldError} from './FieldError';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

/**
 * Date picker built on the native date input: keyboard/screen-reader operable
 * with a browser-localized calendar (UI_UX §7). The backend remains the
 * authority on date semantics (e.g. internship classification).
 */
export function DatePicker({label, hint, error, hideLabel = false, id, required, ...rest}: DatePickerProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cx('text-sm font-semibold text-zinc-800 dark:text-zinc-100', hideLabel && 'sr-only')}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 text-accent-600 dark:text-accent-100">
            *
          </span>
        )}
      </label>
      <input
        type="date"
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx(
          'h-10 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 hover:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-70 dark:border-zinc-700 dark:bg-navy-900 dark:text-zinc-100 dark:disabled:bg-white/5 dark:[color-scheme:dark]',
          error && 'border-accent-600 dark:border-accent-100',
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
