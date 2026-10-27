'use client';

import {useTranslations} from 'next-intl';
import {useState, type ReactNode} from 'react';
import {cx} from '@/lib/cx';
import {Input} from '@/components/ui/Input';

/**
 * National ID (CIN) input with reduced sensitive-data exposure (B3 task 5):
 * the full number lives only in component/workspace memory, never in logs, URLs
 * or analytics. The default view shows the number masked (end only); it is
 * shown in full only when the candidate explicitly reveals or edits it.
 * Editing starts from an empty field (the full value is never pre-loaded into
 * the DOM); clearing it keeps the last-saved number. The backend stays
 * authoritative: an unchanged CIN is sent as-is on every PUT, and a changed
 * CIN triggers the backend's uniqueness check.
 */
interface CinFieldProps {
  value: string;
  baseValue: string;
  onChange: (next: string) => void;
  error?: string;
  disabled?: boolean;
}

export function maskCin(cin: string): string {
  if (!cin) return '••••••••';
  if (cin.length <= 4) return '•'.repeat(cin.length);
  return `${'•'.repeat(cin.length - 4)} ${cin.slice(-4)}`;
}

export function CinField({value, baseValue, onChange, error, disabled}: CinFieldProps) {
  const t = useTranslations('profile');
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const changed = value !== baseValue;

  function commitEdit() {
    const next = editValue.trim();
    if (next) {
      onChange(next);
      setRevealed(false);
    }
    setEditing(false);
  }

  let control: ReactNode;
  if (editing) {
    control = (
      <Input
        label={t('fieldCin')}
        placeholder={t('cinEditPlaceholder')}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit();
          if (e.key === 'Escape') {
            setEditing(false);
            setEditValue('');
          }
        }}
        error={error}
        disabled={disabled}
        autoFocus
        autoComplete="off"
        spellCheck={false}
      />
    );
  } else if (changed) {
    control = (
      <div className="flex w-full flex-col gap-1.5">
        <Input
          label={t('fieldCin')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            {t('cinWillChange')} {t('cinConfidentiality')}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(baseValue)}
            className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-900/40"
          >
            {t('cinKeepCurrent')}
          </button>
        </p>
      </div>
    );
  } else {
    control = (
      <div className="flex w-full flex-col gap-1.5">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t('fieldCin')}</span>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-navy-900">
          <span
            className={cx('font-mono text-base tabular-nums text-zinc-900 dark:text-zinc-100', revealed && 'tracking-wider')}
            aria-live="polite"
          >
            {revealed ? value : maskCin(value)}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              disabled={disabled}
              className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-900/40"
            >
              {revealed ? t('cinHide') : t('cinReveal')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={disabled}
              className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-900/40"
            >
              {t('cinChange')}
            </button>
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t('cinHint')} {t('cinConfidentiality')}
        </p>
      </div>
    );
  }

  return <div className="flex w-full flex-col gap-1.5">{control}</div>;
}