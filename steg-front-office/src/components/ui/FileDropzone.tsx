'use client';

import {useId, useRef, useState, type DragEvent, type ChangeEvent} from 'react';
import {useTranslations} from 'next-intl';
import {cx} from '@/lib/cx';
import {FieldError} from './FieldError';
import {Button} from './Button';

export interface DropFile {
  file: File;
  id: string;
}

interface FileDropzoneProps {
  label: string;
  hint?: string;
  error?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  /** Lowercase extensions with leading dot (e.g. ['.pdf']). UX pre-check only. */
  allowedExtensions?: string[];
  required?: boolean;
  disabled?: boolean;
  /**
   * When true, the dropzone acts as a pure picker: it emits files but does
   * not render its own picked-file list (the parent owns all state display).
   */
  managed?: boolean;
  /** Optional ref handle so parents can open the picker (e.g. a Replace button). */
  pickerRef?: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: File[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * File dropzone (UI_UX §9.8): drag-and-drop plus a keyboard-operable browse
 * button (drag-and-drop always has a non-drag alternative, §7). Client-side
 * type/size pre-checks are UX niceties only — the backend (Tika + malware
 * hook + per-type caps) is the authoritative gate.
 */
export function FileDropzone({
  label,
  hint,
  error,
  accept,
  multiple = false,
  maxSizeMb,
  allowedExtensions,
  required = false,
  disabled = false,
  managed = false,
  pickerRef,
  onFiles,
}: FileDropzoneProps) {
  const t = useTranslations('dropzone');
  const autoId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<DropFile[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const describedBy = cx(hint && `${autoId}-hint`, (error || localError) && `${autoId}-error`) || undefined;

  /** Human list of accepted extensions for messages, e.g. "PDF" or "JPG, JPEG, PNG". */
  const acceptedLabel = (allowedExtensions ?? [])
    .map((e) => e.replace(/^\./, '').toUpperCase())
    .join(', ');

  function extensionOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase() : '';
  }

  function handleFiles(list: FileList | null) {
    if (!list || disabled) return;
    const incoming = Array.from(list);
    // UX-only pre-checks: fast feedback before any network use. The backend
    // (Tika content inspection + per-type caps) makes the final decision and
    // its errors are always surfaced separately.
    const tooBig = maxSizeMb !== undefined ? incoming.filter((f) => f.size > maxSizeMb * 1024 * 1024) : [];
    if (tooBig.length > 0) {
      setLocalError(t('tooLarge', {max: maxSizeMb ?? 0}));
      return;
    }
    if (allowedExtensions && allowedExtensions.length > 0) {
      const allowed = new Set(allowedExtensions.map((e) => e.toLowerCase()));
      const badType = incoming.filter((f) => !allowed.has(extensionOf(f.name)));
      if (badType.length > 0) {
        setLocalError(t('invalidType', {accepted: acceptedLabel}));
        return;
      }
    }
    setLocalError(null);
    const wrapped = incoming.map((file) => ({
      file,
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    }));
    if (!managed) {
      setPicked((prev) => (multiple ? [...prev, ...wrapped] : wrapped));
    }
    onFiles(incoming);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    e.target.value = '';
  }

  function remove(id: string) {
    setPicked((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span id={`${autoId}-label`} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 text-accent-600 dark:text-accent-100">
            *
          </span>
        )}
      </span>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={`${autoId}-label`}
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragging
            ? 'border-brand-500 bg-brand-50 dark:border-brand-300 dark:bg-white/5'
            : 'border-zinc-300 bg-zinc-50 hover:border-brand-400 hover:bg-brand-50/50 dark:border-zinc-700 dark:bg-white/[0.02] dark:hover:border-brand-400',
          disabled && 'cursor-not-allowed opacity-60',
          (error || localError) && 'border-accent-600 dark:border-accent-100',
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-8 w-8 text-zinc-400 dark:text-zinc-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4L8 8m12 12H4" />
        </svg>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t('prompt')}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('orBrowse')}</span>
        <input
          ref={(node) => {
            inputRef.current = node;
            if (pickerRef) pickerRef.current = node;
          }}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={onInputChange}
        />
      </div>
      {hint && !error && !localError && (
        <p id={`${autoId}-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      <FieldError id={`${autoId}-error`} message={error ?? localError ?? undefined} />
      {!managed && picked.length > 0 && (
        <ul aria-label={t('selectedFiles')} className="flex flex-col gap-1.5">
          {picked.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-navy-900"
            >
              <span className="truncate text-zinc-800 dark:text-zinc-100" dir="auto">
                {p.file.name}
                <span className="ms-2 text-xs text-zinc-500">({formatBytes(p.file.size)})</span>
              </span>
              <Button variant="tertiary" size="sm" onClick={() => remove(p.id)} iconOnlyLabel={t('remove')}>
                <span aria-hidden="true">✕</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
