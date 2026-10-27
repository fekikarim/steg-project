'use client';

import type {ReactNode} from 'react';
import {cx} from '@/lib/cx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'start' | 'center' | 'end';
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T, index: number) => string;
  caption?: string;
  empty?: ReactNode;
  className?: string;
}

const ALIGN = {start: 'text-start', center: 'text-center', end: 'text-end'} as const;

/**
 * Accessible data table (UI_UX §9.3): semantic markup, sticky header, row
 * hover, responsive horizontal scroll container. Sorting/filtering live in the
 * calling feature (only when useful); pagination likewise.
 */
export function Table<T>({columns, rows, getRowId, caption, empty, className}: TableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={cx('w-full overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800', className)}>
      <table className="w-full border-collapse text-[13px] sm:text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 bg-zinc-50 dark:bg-white/5">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cx(
                  'border-b border-zinc-200 px-4 py-3 text-xs font-bold tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400',
                  ALIGN[col.align ?? 'start'],
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={getRowId(row, i)}
              className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5"
            >
              {columns.map((col) => (
                <td key={col.key} className={cx('px-4 py-3 text-zinc-800 dark:text-zinc-100', ALIGN[col.align ?? 'start'])}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
