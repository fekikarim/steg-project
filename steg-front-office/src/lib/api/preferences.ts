/**
 * Typed backend user-preference calls (contract: backend
 * `UserPreferencesController`). Server-side only: the browser talks to
 * `/api/users/me/locale`, which attaches the httpOnly session access token.
 */
import {backendFetch} from '../api-client';

export function updatePreferredLocale(token: string, locale: string) {
  return backendFetch<void>('/api/users/me/locale', {method: 'PUT', token, body: {locale}});
}
