/**
 * Typed backend auth DTOs (contract: `docs/openapi.json` — AuthResponse,
 * RegisterRequest, LoginRequest, RefreshRequest). Used server-side by the
 * `/api/auth/*` route handlers; the browser never sees tokens.
 */
import {backendFetch} from '../api-client';

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export function registerCandidate(body: RegisterRequest) {
  return backendFetch<AuthResponse>('/api/auth/register', {method: 'POST', body});
}

export function loginBackend(body: LoginRequest) {
  return backendFetch<AuthResponse>('/api/auth/login', {method: 'POST', body});
}

export function refreshBackend(refreshToken: string) {
  return backendFetch<AuthResponse>('/api/auth/refresh', {
    method: 'POST',
    body: {refreshToken} satisfies RefreshRequest,
  });
}

/** Best-effort server-side revocation; callers clear cookies regardless. */
export async function logoutBackend(refreshToken: string): Promise<void> {
  try {
    await backendFetch<void>('/api/auth/logout', {
      method: 'POST',
      body: {refreshToken} satisfies RefreshRequest,
    });
  } catch {
    /* revocation is best-effort: an expired token simply has nothing to revoke */
  }
}
