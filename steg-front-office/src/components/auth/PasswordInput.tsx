'use client';

import {useId, useState, type InputHTMLAttributes} from 'react';
import {cx} from '@/lib/cx';
import {FieldError, FieldHint} from '../ui/FieldError';
import {IconEye, IconEyeOff} from '../ui/icons';

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong' | '';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
  strength?: PasswordStrength;
  strengthLabel?: string;
  showLabel?: string;
  hideLabel?: string;
  showToggle?: boolean;
}

function strengthTone(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'bg-accent-600';
    case 'fair':
      return 'bg-amber-500';
    case 'good':
      return 'bg-emerald-500';
    case 'strong':
      return 'bg-emerald-600';
    default:
      return 'bg-zinc-200 dark:bg-zinc-700';
  }
}

function segmentCount(strength: PasswordStrength): number {
  return strength === 'strong' ? 4 : strength === 'good' ? 3 : strength === 'fair' ? 2 : strength === 'weak' ? 1 : 0;
}

/**
 * Password input with show/hide toggle and an optional 4-segment strength meter
 * (UI_UX §9.2). Keyboard friendly and RTL-safe via logical properties.
 */
export function PasswordInput({
  label,
  hint,
  error,
  strength = '',
  strengthLabel,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  showToggle = true,
  id,
  required,
  className,
  ...rest
}: PasswordInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const count = segmentCount(strength);

  return (
    <div className={cx('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 text-accent-600 dark:text-accent-100">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          className={cx(
            'h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-base text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-70 dark:border-zinc-700 dark:bg-navy-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:disabled:bg-white/5',
            error && 'border-accent-600 dark:border-accent-100',
          )}
          {...rest}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? hideLabel : showLabel}
            className="absolute end-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            {visible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
          </button>
        )}
      </div>
      {strength && (
        <div
          className="flex items-center gap-2"
          role="meter"
          aria-label={strengthLabel}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={count}
        >
          <div className="flex w-full gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cx('h-1.5 flex-1 rounded-full', i <= count ? strengthTone(strength) : 'bg-zinc-200 dark:bg-zinc-700')}
              />
            ))}
          </div>
        </div>
      )}
      {hint && !error && <FieldHint id={hintId}>{hint}</FieldHint>}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
