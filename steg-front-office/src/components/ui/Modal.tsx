'use client';

import {useEffect, useId, useRef, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {cx} from '@/lib/cx';
import {Button} from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible modal dialog (UI_UX §7, §9.6): aria-modal, labelledby, Esc to
 * close, backdrop click to close, initial focus into the dialog, and focus
 * restored to the invoker on close. Fits small screens; full-sheet on mobile.
 */
export function Modal({open, onClose, title, description, children, footer, closeLabel, size = 'md'}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    invokerRef.current = document.activeElement;
    // Only autofocus the dialog if focus is not already inside it (prevents stealing focus from inputs on parent re-renders)
    const active = document.activeElement;
    const isInside = dialogRef.current?.contains(active);
    if (!isInside) {
      dialogRef.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (invokerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6 dark:bg-navy-900',
          size === 'sm' && 'sm:max-w-sm',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-bold text-navy-900 dark:text-zinc-50">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
          <Button variant="icon" size="sm" onClick={onClose} iconOnlyLabel={closeLabel}>
            <span aria-hidden="true">✕</span>
          </Button>
        </div>
        <div>{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
