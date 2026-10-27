/**
 * Localized date rendering (UI_UX §8.1). Backend timestamps arrive as ISO
 * strings; unparseable values fall back to the raw string, never crash.
 */

/** Date only (lists, table cells). */
export function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(d);
  } catch {
    return iso;
  }
}

/** Date + time (detail timelines, notification timestamps). */
export function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(d);
  } catch {
    return iso;
  }
}
