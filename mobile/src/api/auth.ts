import { apiFetch } from './client';
import { AuthResponseData, UserProfile } from './types';
import {
  setAccessToken,
  setStoredRefreshToken,
  getStoredRefreshToken,
  clearAllTokens,
} from './token-manager';

export async function loginApi(email: string, password: string): Promise<AuthResponseData> {
  const data = await apiFetch<AuthResponseData>('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });

  setAccessToken(data.accessToken);
  await setStoredRefreshToken(data.refreshToken);
  return data;
}

export async function registerApi(
  name: string,
  email: string,
  password: string,
  preferredMode?: 'DRIVER' | 'HOST'
): Promise<AuthResponseData> {
  const data = await apiFetch<AuthResponseData>('/auth/register', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      name,
      email,
      password,
      ...(preferredMode ? { preferredMode } : {}),
    }),
  });

  setAccessToken(data.accessToken);
  await setStoredRefreshToken(data.refreshToken);
  return data;
}

export async function googleLoginApi(idToken: string): Promise<AuthResponseData> {
  const data = await apiFetch<AuthResponseData>('/auth/google', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ idToken }),
  });

  setAccessToken(data.accessToken);
  await setStoredRefreshToken(data.refreshToken);
  return data;
}

export async function forgotPasswordApi(email: string): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email }),
  });
}

export async function resendVerificationApi(email: string): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>('/auth/resend-verification', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email }),
  });
}

export async function logoutApi(): Promise<void> {
  try {
    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) {
      await apiFetch<{ message: string }>('/auth/logout', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // Must clear tokens even if network fails
      });
    }
  } finally {
    await clearAllTokens();
  }
}

export async function getMeApi(): Promise<UserProfile> {
  return await apiFetch<UserProfile>('/me');
}

export async function updateProfileApi(data: {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  preferredMode?: 'DRIVER' | 'HOST' | null;
}): Promise<UserProfile> {
  return await apiFetch<UserProfile>('/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function applyHostApi(data?: {
  name?: string;
  phone?: string;
}): Promise<{
  id: string;
  hostStatus: 'PENDING';
  message: string;
}> {
  return await apiFetch<{
    id: string;
    hostStatus: 'PENDING';
    message: string;
  }>('/host/apply', {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}
