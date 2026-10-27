'use client';

import {useId, type InputHTMLAttributes} from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
}

/** Accessible checkbox with label and optional inline error (UI_UX §9.2). */
export function Checkbox({label, error, id, ...rest}: CheckboxProps) {
  const autoId = useId();
  const checkId = id ?? autoId;
  const errorId = error ? `${checkId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id={checkId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-brand-600 dark:border-zinc-700 dark:accent-brand-500"
          {...rest}
        />
        <label htmlFor={checkId} className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-200">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-accent-700 dark:text-accent-100">
          {error}
        </p>
      )}
    </div>
  );
}
