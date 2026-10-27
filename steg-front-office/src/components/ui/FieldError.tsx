import {cx} from '@/lib/cx';

/** Inline field error with an accessible alert role. */
export function FieldError({id, message}: {id?: string; message?: string}) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-accent-700 dark:text-accent-100">
      {message}
    </p>
  );
}

/** Muted helper text under a form control. */
export function FieldHint({id, children}: {id?: string; children: React.ReactNode}) {
  return (
    <p id={id} className={cx('text-xs text-zinc-500 dark:text-zinc-400')}>
      {children}
    </p>
  );
}
