'use client';

import {useTranslations} from 'next-intl';
import {useId, useRef, useState, type KeyboardEvent} from 'react';
import {cx} from '@/lib/cx';
import {FieldError} from '@/components/ui/FieldError';

interface ChipsInputProps {
  label: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  maxItems?: number;
}

/**
 * Structured tag editor (B3 task 4): typed values become removable chips, and
 * the edited list is serialized to the backend comma-string on submit. Enter,
 * comma, paste and Backspace all add/remove items; fully keyboard operable.
 */
export function ChipsInput({label, hint, error, placeholder, value, onChange, disabled, maxItems = 30}: ChipsInputProps) {
  const t = useTranslations('profile');
  const autoId = useId();
  const inputId = `${autoId}-focused`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const [pending, setPending] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (!text) return;
    const next = [...value];
    const exists = next.some((item) => item.toLowerCase() === text.toLowerCase());
    if (!exists) {
      if (next.length >= maxItems) return;
      next.push(text);
    }
    onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(pending);
      setPending('');
    } else if (e.key === 'Backspace' && pending === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const parts = e.clipboardData
      .getData('text')
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    let merged = [...value];
    for (const part of parts) {
      if (merged.length >= maxItems) break;
      if (!merged.some((m) => m.toLowerCase() === part.toLowerCase())) merged = [...merged, part];
    }
    onChange(merged);
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {label}
      </label>
      <div
        className={cx(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 focus-within:border-brand-500 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-navy-900 dark:disabled:bg-white/5',
          error && 'border-accent-600 dark:border-accent-100',
          disabled && 'opacity-70',
        )}
      >
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"
          >
            <span className="truncate">{item}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((v) => v !== item))}
              aria-label={t('removeItem', {label: item})}
              className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200 dark:hover:bg-brand-800"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
        <input
          id={inputId}
          ref={inputRef}
          role="textbox"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => {
            commit(pending);
            setPending('');
          }}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={cx(hintId, errorId) || undefined}
          aria-invalid={error ? true : undefined}
          className="min-w-[10rem] flex-1 border-none bg-transparent px-1 py-1 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}