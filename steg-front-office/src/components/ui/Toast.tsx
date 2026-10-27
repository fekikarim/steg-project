'use client';

import {createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {cx} from '@/lib/cx';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

const ToastContext = createContext<{notify: (t: Omit<ToastItem, 'id'>) => void}>({
  notify: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TONE_BAR: Record<ToastTone, string> = {
  success: 'bg-emerald-500',
  error: 'bg-accent-600',
  info: 'bg-brand-500',
};

/**
 * Toast system (UI_UX §9.6): short-lived feedback in an aria-live polite
 * region (assertive for errors), auto-dismissed, closable, keyboard reachable.
 * Wrap the app shell once; announce via `useToast().notify(...)`.
 */
export function ToastProvider({children}: {children: ReactNode}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++counter.current;
      setItems((prev) => [...prev.slice(-3), {...t, id}]);
      window.setTimeout(() => dismiss(id), t.tone === 'error' ? 8000 : 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({notify}), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
          >
            {items.map((item) => (
              <div
                key={item.id}
                role={item.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-navy-900"
              >
                <span aria-hidden="true" className={cx('w-1.5 self-stretch', TONE_BAR[item.tone])} />
                <div className="flex flex-1 flex-col gap-0.5 py-3">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="✕"
                  className="cursor-pointer p-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
