/**
 * Localized date/time + currency formatting (E0.6).
 * Backend stores UTC ISO 8601; UI renders in Africa/Tunis with locale formatters.
 * - Dates: Intl.DateTimeFormat(locale) with explicit timeZone 'Africa/Tunis'.
 * - Currency: single helper formatTND(); TND only; 2 fraction digits; never build amounts manually.
 * - Arabic digits: Western (0-9) via numberingSystem 'latn' for consistency across clients.
 */
export const APP_TIME_ZONE = 'Africa/Tunis';
export const CURRENCY_CODE = 'TND';

function coerceDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null, locale: string): string {
  const d = coerceDate(iso);
  if (!d) return iso ?? '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: APP_TIME_ZONE }).format(d);
  } catch {
    return iso as string;
  }
}

export function formatDateTime(iso: string | null, locale: string): string {
  const d = coerceDate(iso);
  if (!d) return iso ?? '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: APP_TIME_ZONE,
    }).format(d);
  } catch {
    return iso as string;
  }
}

/** Single currency helper — no manual amount string concatenation anywhere. */
export function formatTND(amount: number | string | null | undefined, locale: string): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: CURRENCY_CODE,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      numberingSystem: 'latn',
      timeZone: APP_TIME_ZONE,
    } as Intl.NumberFormatOptions).format(n);
  } catch {
    return `${Number(n).toFixed(2)} ${CURRENCY_CODE}`;
  }
}
