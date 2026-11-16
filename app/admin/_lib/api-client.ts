/**
 * Lightweight, typed API Client for ChargeShare Admin UI
 */

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code = 'API_ERROR', statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function adminFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/api/v1/admin/${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Ensure origin is sent for CSRF verification on non-GET
  if (typeof window !== 'undefined' && options.method && options.method !== 'GET') {
    headers.set('Origin', window.location.origin);
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/admin/login') {
      window.location.href = '/admin/login';
    }
  }

  let json: { data: T | null; error: { code: string; message: string; details?: unknown } | null };
  try {
    json = await response.json();
  } catch {
    throw new ApiError('Failed to parse JSON response', 'INVALID_JSON', response.status);
  }

  if (!response.ok || json.error) {
    const error = json.error;
    throw new ApiError(
      error?.message || `Request failed with status ${response.status}`,
      error?.code || 'UNKNOWN_ERROR',
      response.status,
      error?.details
    );
  }

  return json.data as T;
}
