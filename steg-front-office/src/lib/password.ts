import type {PasswordStrength} from '@/components/auth/PasswordInput';

const WEAK_RE = /^.{0,7}$/;

const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

/**
 * Deterministic password strength estimate used for live guidance. No security
 * logic lives in the client: the backend is the source of truth for the actual
 * minimum-requirements policy; this only drives visual feedback.
 */
export function estimateStrength(value: string): PasswordStrength {
  if (!value) return '';
  if (value.length < 8) return 'weak';

  let score = 0;
  if (HAS_UPPER.test(value)) score++;
  if (HAS_LOWER.test(value)) score++;
  if (HAS_DIGIT.test(value)) score++;
  if (HAS_SPECIAL.test(value)) score++;
  if (value.length >= 12) score++;

  if (score <= 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
}

/** Classic non-empty + pattern presence (used to render the meter during typing). */
export function isPasswordNonEmpty(value: string): boolean {
  return !WEAK_RE.test(value) || value.length >= 8;
}
