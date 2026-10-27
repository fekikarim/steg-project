// E0.6 — single date/time + currency formatting helper (Back Office).
// Backend stores UTC ISO 8601; UI renders in Africa/Tunis.
// Arabic locale uses Western digits (latn) consistently across all clients.
export const APP_TIME_ZONE = 'Africa/Tunis';
export const CURRENCY_CODE = 'TND';

function coerceDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  const d = coerceDate(iso);
  if (!d) return iso ?? '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: APP_TIME_ZONE }).format(
      d,
    );
  } catch {
    return iso as string;
  }
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
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
  if (!Number.isFinite(n as number)) return String(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: CURRENCY_CODE,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      numberingSystem: 'latn',
    } as Intl.NumberFormatOptions).format(n as number);
  } catch {
    return `${Number(n).toFixed(2)} ${CURRENCY_CODE}`;
  }
}

/** Day bucket in the app time zone — drives the notification list grouping. */
export function dayKey(iso: string | null | undefined): string {
  const d = coerceDate(iso);
  if (!d) return 'unknown';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: APP_TIME_ZONE,
  }).format(d);
}

function todayKey(): string {
  return dayKey(new Date().toISOString());
}

/** `group` is one of today | yesterday | week | older. */
export function dayGroup(iso: string | null | undefined): 'today' | 'yesterday' | 'week' | 'older' {
  const date = coerceDate(iso);
  if (!date) return 'older';
  const ageHours = (Date.now() - date.getTime()) / 3_600_000;
  if (ageHours < 24) return 'today';
  if (ageHours < 48) return 'yesterday';
  if (ageHours < 24 * 7) return 'week';
  return 'older';
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.348],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/** Compact relative stamp ("il y a 35 min", "35 min ago", ...) next to the absolute date. */
export function formatRelative(iso: string | null | undefined, locale: string): string {
  const d = coerceDate(iso);
  if (!d) return '—';
  const seconds = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 45) {
    try {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        Math.round(seconds),
        'second',
      );
    } catch {
      return formatDateTime(iso, locale);
    }
  }
  let value = seconds;
  for (const [unit, span] of RELATIVE_UNITS) {
    if (Math.abs(value) < span || unit === 'year') {
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
          Math.round(value),
          unit,
        );
      } catch {
        return formatDateTime(iso, locale);
      }
    }
    value /= span;
  }
  return formatDateTime(iso, locale);
}
