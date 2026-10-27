/**
 * Typed HTTP client for the STEG backend (contract: backend `docs/openapi.json`).
 *
 * Single rule for the whole Front Office: never hand-roll fetch calls per page.
 * Server code calls `backendFetch` with an explicit Bearer token (read from the
 * httpOnly session cookies); browser code talks to our own `/api/*` route
 * handlers, which attach the tokens server-side. Tokens never reach the DOM,
 * localStorage, or client bundles.
 */

export interface FieldErrorItem {
  field?: string;
  rejectedValue?: unknown;
  message?: string;
}

export interface ErrorEnvelope {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  traceId?: string;
  fieldErrors?: FieldErrorItem[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly traceId?: string;
  readonly fieldErrors: FieldErrorItem[];

  constructor(status: number, envelope: ErrorEnvelope | null, fallback: string) {
    super(envelope?.message || fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = envelope?.error;
    this.traceId = envelope?.traceId;
    this.fieldErrors = envelope?.fieldErrors ?? [];
  }

  /** Field-level message for a form input, if the backend supplied one. */
  fieldMessage(field: string): string | undefined {
    return this.fieldErrors.find((f) => f.field === field)?.message;
  }
}

function backendBaseUrl(): string {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
}

export interface BackendFetchOptions extends Omit<RequestInit, 'body'> {
  token?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  timeoutMs?: number;
}

function isEnvelope(value: unknown): value is ErrorEnvelope {
  return typeof value === 'object' && value !== null && ('message' in value || 'traceId' in value);
}

function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request.';
    case 401:
      return 'Authentication required.';
    case 403:
      return 'Not allowed.';
    case 404:
      return 'Not found.';
    case 409:
      return 'Conflicting change.';
    case 422:
      return 'Business rule violated.';
    case 429:
      return 'Too many attempts.';
    default:
      return 'Unexpected error.';
  }
}

/**
 * Call the backend and return the decoded JSON body (or void for 204).
 * Non-2xx responses throw {@link ApiError} parsed from the standard envelope —
 * surface `message`/`fieldErrors` consistently in UI (UI_UX §14).
 */
export async function backendFetch<T>(path: string, options: BackendFetchOptions = {}): Promise<T> {
  const {token, body, timeoutMs = 15000, headers, ...init} = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${backendBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const data: unknown = text ? (JSON.parse(text) as unknown) : null;

    if (!res.ok) {
      throw new ApiError(res.status, isEnvelope(data) ? data : null, messageForStatus(res.status));
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, null, 'Request timed out.');
    }
    throw new ApiError(0, null, 'Cannot reach the server.');
  } finally {
    clearTimeout(timer);
  }
}
