/**
 * Browser-side resumable upload transport (B5).
 *
 * `fetch` cannot report upload progress, so file uploads go through
 * `XMLHttpRequest` against our own same-origin `/api/documents` proxy (the
 * session cookie travels automatically; tokens never touch JavaScript).
 * The proxy forwards to the backend, which remains authoritative for
 * validation (Tika content inspection, per-type caps, MIME-spoof detection).
 */

import type {DocumentResponse} from './api/application';

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0–100 when the total is known, null for indeterminate transfers. */
  percent: number | null;
}

export type UploadFailure =
  | {kind: 'cancelled'}
  | {kind: 'timeout'}
  | {kind: 'network'}
  | {kind: 'api'; status: number; code?: string; message: string; traceId?: string};

export interface UploadOptions {
  onProgress?: (p: UploadProgress) => void;
  /** AbortSignal owned by the caller (cancel button, unmount, retry). */
  signal?: AbortSignal;
  /** Upload budget in ms. Defaults to 120 s to match the proxy→backend budget. */
  timeoutMs?: number;
}

function errorEnvelopeOf(text: string): {error?: string; message?: string; traceId?: string} | null {
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === 'object') {
      const o = data as Record<string, unknown>;
      return {
        error: typeof o.error === 'string' ? o.error : undefined,
        message: typeof o.message === 'string' ? o.message : undefined,
        traceId: typeof o.traceId === 'string' ? o.traceId : undefined,
      };
    }
  } catch {
    /* non-JSON body */
  }
  return null;
}

/**
 * POST a file to `/api/documents?type=…` with progress, cancel and timeout.
 * Resolves with the created DocumentResponse; rejects with UploadFailure.
 * Never logs the file name or contents — failures carry only codes/statuses.
 */
export function uploadWithProgress(
  file: File,
  type: string,
  options: UploadOptions = {},
): Promise<DocumentResponse> {
  const {onProgress, signal, timeoutMs = 120_000} = options;
  return new Promise<DocumentResponse>((resolve, reject) => {
    if (signal?.aborted) {
      reject({kind: 'cancelled'} satisfies UploadFailure);
      return;
    }

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    let settled = false;
    const fail = (f: UploadFailure) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(f);
    };
    const succeed = (doc: DocumentResponse) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(doc);
    };

    const onAbort = () => {
      // Distinguish caller-initiated cancel from the XHR timeout: the
      // timeout handler aborts internally but flags itself first.
      if (timedOut) fail({kind: 'timeout'});
      else {
        try {
          xhr.abort();
        } catch {
          /* already done */
        }
        fail({kind: 'cancelled'});
      }
    };

    let timedOut = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort);

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      onProgress({
        loaded: e.loaded,
        total: e.lengthComputable ? e.total : 0,
        percent: e.lengthComputable && e.total > 0 ? Math.min(100, Math.round((e.loaded / e.total) * 100)) : null,
      });
    };

    xhr.ontimeout = () => {
      timedOut = true;
      fail({kind: 'timeout'});
    };
    xhr.onerror = () => fail({kind: 'network'});
    xhr.onabort = () => fail({kind: timedOut ? 'timeout' : 'cancelled'});

    xhr.onload = () => {
      const envelope = errorEnvelopeOf(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          succeed(JSON.parse(xhr.responseText) as DocumentResponse);
        } catch {
          fail({kind: 'api', status: xhr.status, message: 'Invalid server response.'});
        }
        return;
      }
      fail({
        kind: 'api',
        status: xhr.status,
        code: envelope?.error,
        message: envelope?.message ?? 'Document upload failed.',
        traceId: envelope?.traceId,
      });
    };

    xhr.open('POST', `/api/documents?type=${encodeURIComponent(type)}`);
    xhr.timeout = timeoutMs;
    try {
      xhr.send(form);
    } catch {
      fail({kind: 'network'});
    }
  });
}
