import { ApiError } from '../src/api/types';
import {
  refreshTokensSingleFlight,
  setStoredRefreshToken,
  getStoredRefreshToken,
  getAccessToken,
  setAccessToken,
  clearAllTokens,
} from '../src/api/token-manager';

describe('Mobile API Client & Token Management', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await clearAllTokens();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('ApiError correctly maps code, message, status and details', () => {
    const error = new ApiError('FORBIDDEN', 'Access denied', 403, { role: 'USER' });
    expect(error.name).toBe('ApiError');
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied');
    expect(error.status).toBe(403);
    expect(error.details).toEqual({ role: 'USER' });
  });

  it('refreshTokensSingleFlight ensures concurrent 401 requests trigger exactly ONE refresh call', async () => {
    // Seed initial refresh token in SecureStore
    await setStoredRefreshToken('old_refresh_token_123');

    let refreshCallCount = 0;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              accessToken: 'new_access_token_abc',
              refreshToken: 'new_rotated_refresh_token_xyz',
            },
            error: null,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    // Fire 3 simultaneous refresh calls
    const [token1, token2, token3] = await Promise.all([
      refreshTokensSingleFlight('http://test-api/api/v1'),
      refreshTokensSingleFlight('http://test-api/api/v1'),
      refreshTokensSingleFlight('http://test-api/api/v1'),
    ]);

    // Must be identical tokens
    expect(token1).toBe('new_access_token_abc');
    expect(token2).toBe('new_access_token_abc');
    expect(token3).toBe('new_access_token_abc');

    // Crucial assertion: /auth/refresh was called EXACTLY ONCE
    expect(refreshCallCount).toBe(1);

    // In-memory access token updated
    expect(getAccessToken()).toBe('new_access_token_abc');

    // SecureStore rotated refresh token updated
    const stored = await getStoredRefreshToken();
    expect(stored).toBe('new_rotated_refresh_token_xyz');
  });

  it('refreshTokensSingleFlight purges tokens if refresh fails', async () => {
    await setStoredRefreshToken('invalid_or_expired_token');
    setAccessToken('stale_access_token');

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Token revoked' },
      }),
    });

    await expect(
      refreshTokensSingleFlight('http://test-api/api/v1')
    ).rejects.toThrow('Token revoked');

    // Tokens must be cleared
    expect(getAccessToken()).toBeNull();
    const stored = await getStoredRefreshToken();
    expect(stored).toBeNull();
  });
});
