import { ApiError } from './types';
import {
  getAccessToken,
  refreshTokensSingleFlight,
} from './token-manager';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1';

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs = 15000, skipAuth = false, headers = {}, ...rest } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Content-Type') && rest.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  // Attach access token
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        ...rest,
        headers: requestHeaders,
        signal: controller.signal,
      });
    } catch (networkErr: unknown) {
      if (__DEV__) {
        console.warn(`[API Error] Failed to fetch ${url}:`, networkErr);
      }
      if (controller.signal.aborted) {
        throw new ApiError(
          'TIMEOUT',
          'Request timed out. Please check your connection and try again.',
          408
        );
      }
      throw new ApiError(
        'NETWORK_ERROR',
        'Unable to connect to ChargeShare servers. Please check your network.',
        0,
        networkErr
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Single 401 retry with single-flight token refresh
    if (response.status === 401 && !skipAuth) {
      try {
        const newAccessToken = await refreshTokensSingleFlight(API_BASE_URL);

        // Retry original request with new token
        requestHeaders.set('Authorization', `Bearer ${newAccessToken}`);
        const retryRes = await fetch(url, {
          ...rest,
          headers: requestHeaders,
        });

        const retryData = await retryRes.json().catch(() => null);
        if (!retryRes.ok || retryData?.error) {
          throw new ApiError(
            retryData?.error?.code || 'UNAUTHORIZED',
            retryData?.error?.message || 'Unauthorized',
            retryRes.status,
            retryData?.error?.details
          );
        }

        return retryData.data as T;
      } catch (refreshErr) {
        if (refreshErr instanceof ApiError) {
          throw refreshErr;
        }
        throw new ApiError('AUTH_REFRESH_FAILED', 'Session expired. Please sign in again.', 401);
      }
    }

    // Normal response parsing
    const data = await response.json().catch(() => null);

    if (!response.ok || data?.error) {
      const code = data?.error?.code || `HTTP_${response.status}`;
      const message =
        data?.error?.message ||
        (response.status >= 500
          ? 'Server error. Please try again shortly.'
          : 'Something went wrong.');
      throw new ApiError(code, message, response.status, data?.error?.details);
    }

    return data.data as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError('UNKNOWN_ERROR', (err as Error)?.message || 'An unexpected error occurred.', 500);
  }
}
