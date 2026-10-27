'use client';

import {ApiError, type ErrorEnvelope} from '../api-client';
import type {CandidateProfile, CandidateProfileUpdate, University} from './candidate';

/**
 * Browser-side calls to our own `/api/*` proxy routes. The session access
 * token travels as an httpOnly cookie on the same origin; it never appears in
 * JavaScript. Follows the api-client rule: pages never hand-roll fetch calls.
 */

async function profileRequest<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {'Content-Type': 'application/json', ...init.headers},
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, null, 'Cannot reach the server.');
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const envelope = data && typeof data === 'object' ? (data as ErrorEnvelope) : null;
    throw new ApiError(res.status, envelope, 'Profile request failed.');
  }
  return data as T;
}

export function getProfile() {
  return profileRequest<CandidateProfile>('/api/profile', {method: 'GET'});
}

export function updateProfile(body: CandidateProfileUpdate) {
  return profileRequest<CandidateProfile>('/api/profile', {method: 'PUT', body: JSON.stringify(body)});
}

export function createProfile(body: CandidateProfileUpdate) {
  return profileRequest<CandidateProfile>('/api/profile', {method: 'POST', body: JSON.stringify(body)});
}

export function fetchUniversities() {
  return profileRequest<University[]>('/api/universities', {method: 'GET'});
}

/**
 * Persist the active UI locale as the account preference (backend drives
 * email language + future sessions from it). Anonymous callers resolve
 * silently — fire-and-forget from the language switcher.
 */
export function setPreferredLocale(locale: string) {
  return profileRequest<void>('/api/users/me/locale', {
    method: 'PUT',
    body: JSON.stringify({locale}),
  });
}