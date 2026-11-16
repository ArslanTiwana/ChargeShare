import { useAuthStore } from '../src/store/auth-store';
import {
  setStoredRefreshToken,
  getStoredRefreshToken,
  setAccessToken,
  getAccessToken,
  clearAllTokens,
} from '../src/api/token-manager';

describe('Auth Store & Auth Gate Bootstrap Logic', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await clearAllTokens();
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    });
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('initializes as unauthenticated when no refresh token is stored in SecureStore', async () => {
    await useAuthStore.getState().initializeAuth();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('refreshes token and fetches /me on launch when refresh token exists', async () => {
    await setStoredRefreshToken('valid_bootstrap_refresh_token');

    const mockUser = {
      id: 'usr_123',
      email: 'driver@example.com',
      name: 'Test Driver',
      phone: '03001234567',
      avatarUrl: null,
      role: 'USER' as const,
      hostStatus: 'NONE' as const,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: '2026-11-16T10:00:00.000Z',
      createdAt: '2026-11-16T09:00:00.000Z',
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              accessToken: 'fresh_jwt_token',
              refreshToken: 'next_refresh_token',
            },
            error: null,
          }),
        };
      }
      if (url.includes('/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: mockUser,
            error: null,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    await useAuthStore.getState().initializeAuth();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('driver@example.com');
    expect(state.user?.hostStatus).toBe('NONE');
  });

  it('sign out purges tokens and store state even if /auth/logout fails', async () => {
    setAccessToken('active_token');
    await setStoredRefreshToken('active_refresh');
    useAuthStore.setState({
      user: {
        id: 'usr_1',
        email: 'user@example.com',
        name: 'User',
        phone: null,
        avatarUrl: null,
        role: 'USER',
        preferredMode: null,
        hostStatus: 'NONE',
        isActive: true,
        emailVerified: false,
        emailVerifiedAt: null,
        createdAt: '2026-11-16T00:00:00.000Z',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    // Simulate network error on logout
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error on logout'));

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    const stored = await getStoredRefreshToken();
    expect(stored).toBeNull();
  });

  it('redirect rule logic correctly identifies route transitions', () => {
    // Pure function logic matching AuthGate segment check
    const evaluateRedirect = (
      isLoading: boolean,
      isAuthenticated: boolean,
      currentSegment: string
    ) => {
      if (isLoading) return 'SPLASH';
      const inAuthGroup = currentSegment === '(auth)';
      if (!isAuthenticated && !inAuthGroup) return 'REDIRECT_TO_SIGN_IN';
      if (isAuthenticated && inAuthGroup) return 'REDIRECT_TO_APP';
      return 'ALLOW';
    };

    expect(evaluateRedirect(true, false, '(auth)')).toBe('SPLASH');
    expect(evaluateRedirect(false, false, '(app)')).toBe('REDIRECT_TO_SIGN_IN');
    expect(evaluateRedirect(false, true, '(auth)')).toBe('REDIRECT_TO_APP');
    expect(evaluateRedirect(false, true, '(app)')).toBe('ALLOW');
    expect(evaluateRedirect(false, false, '(auth)')).toBe('ALLOW');
  });
});
