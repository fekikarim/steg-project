/**
 * Typed backend candidate DTOs and server-side calls (contract: backend
 * `docs/openapi.json` — CandidateDetailResponse, CandidateRequest,
 * UniversityResponse). These run inside route handlers only: the browser talks
 * to `/api/profile`, which attaches the httpOnly session access token
 * server-side. Tokens and the candidate's national ID never reach client
 * bundles; the full CIN is returned to the candidate's own session (the
 * backend serves it to self only) and is held in memory by the profile UI,
 * never rendered unless the candidate explicitly reveals it.
 */
import {backendFetch} from '../api-client';

export interface CandidateProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  speciality?: string | null;
  diploma?: string | null;
  skills?: string | null;
  languages?: string | null;
  nationalId: string;
  universityId: string;
  universityName?: string | null;
  userId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
}

export interface CandidateProfileUpdate {
  email: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  universityId: string;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  speciality?: string | null;
  diploma?: string | null;
  skills?: string | null;
  languages?: string | null;
}

export interface University {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export function getMyCandidate(token: string) {
  return backendFetch<CandidateProfile>('/api/candidates/me', {method: 'GET', token});
}

export function updateMyCandidate(token: string, body: CandidateProfileUpdate) {
  return backendFetch<CandidateProfile>('/api/candidates/me', {method: 'PUT', token, body});
}

/**
 * Create the candidate profile exactly once (self-registration). The request
 * DTO is field-identical to the update DTO; the backend enforces
 * CANDIDATE_PROFILE_EXISTS / CANDIDATE_NATIONAL_ID_DUPLICATE as 422 codes.
 */
export function createMyCandidate(token: string, body: CandidateProfileUpdate) {
  return backendFetch<CandidateProfile>('/api/candidates', {method: 'POST', token, body});
}

/** Public reference data: the list of active universities. */
export function listUniversities() {
  return backendFetch<University[]>('/api/universities', {method: 'GET'});
}

export interface IdentifierValidationRequest {
  email?: string | null;
  nationalId?: string | null;
  phone?: string | null;
}

export interface IdentifierValidationResponse {
  valid: boolean;
  duplicateFields: string[];
  message: string;
}

export function validateIdentifiers(token: string | null, body: IdentifierValidationRequest) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return backendFetch<IdentifierValidationResponse>('/api/public/applications/validate-identifiers', {
    method: 'POST',
    token: token ?? undefined,
    body,
  });
}

/** Browser-side: calls the Next.js proxy which forwards to backend (handles both anon and auth via cookies) */
export async function validateIdentifiersClient(body: IdentifierValidationRequest): Promise<IdentifierValidationResponse> {
  const res = await fetch('/api/public/applications/validate-identifiers', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  const data: unknown = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as {message: unknown}).message)
        : 'Validation failed.';
    // Try to preserve duplicateFields if backend returned it even on error
    const duplicateFields =
      typeof data === 'object' && data !== null && 'duplicateFields' in data && Array.isArray((data as {duplicateFields: unknown}).duplicateFields)
        ? ((data as {duplicateFields: string[]}).duplicateFields as string[])
        : [];
    // If backend returned 422 with valid=false, we still want to surface it as a successful validation response
    // so the UI can show the warning dialog instead of a generic error.
    if (data && typeof data === 'object' && 'valid' in data && typeof (data as {valid: unknown}).valid === 'boolean') {
      return data as IdentifierValidationResponse;
    }
    throw new Error(message);
  }
  return data as IdentifierValidationResponse;
}