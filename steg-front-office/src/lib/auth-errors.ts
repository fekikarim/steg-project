import {ApiError} from './api-client';

export type AuthReason =
  | 'duplicate-email'
  | 'invalid-credentials'
  | 'locked'
  | 'rate-limited'
  | 'unknown';

export interface AuthErrorResponse {
  status: number;
  reason: AuthReason;
  message: string;
  fieldErrors: Array<{field?: string; message?: string}>;
  traceId?: string;
}

/**
 * Map a backend ApiError from /api/auth/login or /api/auth/register to a
 * structured, frontend-translation-ready reason code. The raw `message` is
 * preserved for fallback display but never shown verbatim to users.
 */
export function mapAuthError(err: ApiError): AuthErrorResponse {
  const status = err.status === 0 ? 502 : err.status;
  const rawMsg = err.message.toLowerCase();

  if (status === 429) {
    return {status, reason: 'rate-limited', message: err.message, fieldErrors: [], traceId: err.traceId};
  }

  if (err.code === 'ACCOUNT_LOCKED') {
    return {status, reason: 'locked', message: err.message, fieldErrors: [], traceId: err.traceId};
  }

  if (rawMsg.includes('already exists')) {
    return {status, reason: 'duplicate-email', message: err.message, fieldErrors: [], traceId: err.traceId};
  }

  if (rawMsg.includes('too many')) {
    return {status, reason: 'rate-limited', message: err.message, fieldErrors: [], traceId: err.traceId};
  }

  if (err.code === 'AUTHENTICATION_FAILED' || rawMsg.includes('invalid email or password')) {
    return {status, reason: 'invalid-credentials', message: err.message, fieldErrors: [], traceId: err.traceId};
  }

  return {status, reason: 'unknown', message: err.message, fieldErrors: err.fieldErrors, traceId: err.traceId};
}
