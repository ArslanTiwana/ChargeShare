import * as SecureStore from 'expo-secure-store';
import { ApiError } from './types';

const REFRESH_TOKEN_KEY = 'cs_mobile_refresh_token';

let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
let onAuthFailedCallback: (() => void) | null = null;

export function setOnAuthFailed(callback: () => void) {
  onAuthFailedCallback = callback;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredRefreshToken(token: string | null) {
  try {
    if (token) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Fail-safe
  }
}

export async function clearAllTokens() {
  inMemoryAccessToken = null;
  await setStoredRefreshToken(null);
}

/**
 * Single-flight token refresh mutex:
 * All concurrent 401 requests wait on the same refresh promise.
 */
export async function refreshTokensSingleFlight(baseUrl: string): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await getStoredRefreshToken();
      if (!storedRefreshToken) {
        throw new ApiError('NO_REFRESH_TOKEN', 'No refresh token available', 401);
      }

      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.data) {
        const code = body?.error?.code || 'AUTH_REFRESH_FAILED';
        const msg = body?.error?.message || 'Session expired. Please sign in again.';
        throw new ApiError(code, msg, res.status);
      }

      const { accessToken, refreshToken } = body.data;

      // Atomically store new rotated refresh token & in-memory access token
      setAccessToken(accessToken);
      if (refreshToken) {
        await setStoredRefreshToken(refreshToken);
      }

      return accessToken;
    } catch (err) {
      // Clear all tokens on failure
      await clearAllTokens();
      if (onAuthFailedCallback) {
        onAuthFailedCallback();
      }
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
