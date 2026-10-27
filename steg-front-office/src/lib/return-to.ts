/**
 * Validate a `returnTo` / `next` value supplied via query string so it can only
 * point back at an internal, locale-prefixed path. This prevents open redirects:
 * anything not starting with a single leading "/" (and not "//" or "http(s)://")
 * is rejected and falls back to the home destination for the current locale.
 */
const SAFE_INTERNAL = /^\/(?![/])[^#?]*$/;

export function sanitizeReturnTo(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!SAFE_INTERNAL.test(value)) return fallback;
  if (value.length > 512) return fallback;
  return value;
}
