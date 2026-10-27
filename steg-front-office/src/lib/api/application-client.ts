'use client';

import {ApiError, type ErrorEnvelope} from '../api-client';
import {uploadWithProgress, type UploadFailure} from '../upload';
import type {
  ApplicationResponse,
  ApplicationDocumentResponse,
  DocumentResponse,
  WorkflowInstanceResponse,
} from './application';

/**
 * Browser-side calls to our own `/api/applications` and `/api/documents`
 * proxy routes. The session access token travels as an httpOnly cookie
 * on the same origin; it never appears in JavaScript.
 */

async function applicationRequest<T>(path: string, init: RequestInit): Promise<T> {
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
    throw new ApiError(res.status, envelope, 'Application request failed.');
  }
  return data as T;
}

/* ----- Applications ----- */

export function createDraft(body: {desiredStartDate?: string | null; desiredEndDate?: string | null}) {
  return applicationRequest<ApplicationResponse>('/api/applications', {
    method: 'POST',
    body: JSON.stringify({submittedOnline: true, ...body}),
  });
}

export function getApplication(id: string) {
  return applicationRequest<ApplicationResponse>(`/api/applications/${id}`, {method: 'GET'});
}

export function listApplications() {
  return applicationRequest<ApplicationResponse[]>('/api/applications', {method: 'GET'});
}

export function updateDraft(id: string, body: {desiredStartDate?: string | null; desiredEndDate?: string | null}) {
  return applicationRequest<ApplicationResponse>(`/api/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function submit(id: string, idempotencyKey?: string) {
  return applicationRequest<ApplicationResponse>(`/api/applications/${id}/submit`, {
    method: 'POST',
    headers: idempotencyKey ? {'X-Idempotency-Key': idempotencyKey} : undefined,
  });
}

export function withdrawApplication(id: string) {
  return applicationRequest<ApplicationResponse>(`/api/applications/${id}/withdraw`, {method: 'POST'});
}

export function getApplicationWorkflow(id: string) {
  return applicationRequest<WorkflowInstanceResponse>(`/api/applications/${id}/workflow`, {method: 'GET'});
}

/* ----- Documents ----- */

export function getApplicationDocuments(applicationId: string) {
  return applicationRequest<ApplicationDocumentResponse[]>(
    `/api/applications/${applicationId}/documents`,
    {method: 'GET'},
  );
}

export function attachDocument(applicationId: string, body: {documentId: string; mandatory?: boolean}) {
  return applicationRequest<ApplicationDocumentResponse>(
    `/api/applications/${applicationId}/documents`,
    {method: 'POST', body: JSON.stringify(body)},
  );
}

/**
 * Upload a file to our proxy. The proxy attaches the auth token server-side
 * and forwards the multipart form to the backend `/api/documents`.
 */
export async function uploadFile(file: File, type: string): Promise<DocumentResponse> {
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch(`/api/documents?type=${type}`, {
      method: 'POST',
      body: form,
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
    throw new ApiError(res.status, envelope, 'Document upload failed.');
  }
  return data as DocumentResponse;
}

/**
 * Progress-aware upload through the same proxy (B5). Transport failures are
 * normalized to {@link ApiError} with a stable `code` so the UI can localize:
 * `UPLOAD_CANCELLED` (caller aborted), `UPLOAD_TIMEOUT` (budget exceeded),
 * `UPLOAD_NETWORK` (connection failed); backend rejections keep their own
 * code (FILE_TOO_LARGE, INVALID_FILE_TYPE, MIME_TYPE_SPOOFING_DETECTED,
 * EMPTY_FILE, …) with the HTTP status and traceId preserved.
 */
export function uploadFileWithProgress(
  file: File,
  type: string,
  options: {onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal; timeoutMs?: number} = {},
): Promise<DocumentResponse> {
  return uploadWithProgress(file, type, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    onProgress: options.onProgress
      ? (p) => options.onProgress?.(p.loaded, p.total)
      : undefined,
  }).catch((failure: UploadFailure): never => {
    if (failure.kind === 'cancelled') {
      throw new ApiError(0, {error: 'UPLOAD_CANCELLED', message: 'Upload cancelled.'}, 'Upload cancelled.');
    }
    if (failure.kind === 'timeout') {
      throw new ApiError(0, {error: 'UPLOAD_TIMEOUT', message: 'Upload timed out.'}, 'Upload timed out.');
    }
    if (failure.kind === 'network') {
      throw new ApiError(0, {error: 'UPLOAD_NETWORK', message: 'Cannot reach the server.'}, 'Cannot reach the server.');
    }
    throw new ApiError(
      failure.status,
      {error: failure.code, message: failure.message, traceId: failure.traceId},
      'Document upload failed.',
    );
  });
}
