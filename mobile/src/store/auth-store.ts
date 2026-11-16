import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { UserProfile, AuthResponseData } from '../api/types';
import {
  getStoredRefreshToken,
  refreshTokensSingleFlight,
  clearAllTokens,
  setOnAuthFailed,
} from '../api/token-manager';
import { API_BASE_URL } from '../api/client';
import { getMeApi, logoutApi, updateProfileApi } from '../api/auth';
import { unregisterPushTokenAsync } from '../utils/notifications';

const ACTIVE_ROLE_KEY = 'cs_mobile_active_role';
export type AppRole = 'driver' | 'host';

interface AuthState {
  user: UserProfile | null;
  activeRole: AppRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  initializeAuth: () => Promise<void>;
  setAuth: (data: AuthResponseData) => void;
  setUser: (user: UserProfile) => void;
  setActiveRole: (role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for background token refresh failure
  setOnAuthFailed(() => {
    set({ user: null, isAuthenticated: false, isLoading: false });
  });

  return {
    user: null,
    activeRole: 'driver',
    isLoading: true,
    isAuthenticated: false,

    initializeAuth: async () => {
      try {
        const storedRole = await SecureStore.getItemAsync(ACTIVE_ROLE_KEY).catch(() => null);
        let activeRole: AppRole = storedRole === 'host' ? 'host' : 'driver';

        const storedRefreshToken = await getStoredRefreshToken();
        if (!storedRefreshToken) {
          set({ user: null, activeRole, isAuthenticated: false, isLoading: false });
          return;
        }

        // Refresh token to acquire fresh accessToken
        await refreshTokensSingleFlight(API_BASE_URL);

        // Fetch user profile from /me
        const user = await getMeApi();
        if (!storedRole && user.preferredMode) {
          activeRole = user.preferredMode === 'HOST' ? 'host' : 'driver';
        } else if (
          storedRole &&
          user.preferredMode &&
          (storedRole === 'host' ? 'HOST' : 'DRIVER') !== user.preferredMode
        ) {
          // Retry background sync if local and server were out of sync
          updateProfileApi({ preferredMode: activeRole === 'host' ? 'HOST' : 'DRIVER' }).catch(() => {});
        }

        set({ user, activeRole, isAuthenticated: true, isLoading: false });
      } catch (err) {
        // Any failure during launch bootstrap purges tokens cleanly
        await clearAllTokens();
        set({ user: null, activeRole: 'driver', isAuthenticated: false, isLoading: false });
      }
    },

    setAuth: (data: AuthResponseData) => {
      const activeRole: AppRole = data.user.preferredMode === 'HOST' ? 'host' : 'driver';
      SecureStore.setItemAsync(ACTIVE_ROLE_KEY, activeRole).catch(() => {});
      set({
        user: data.user,
        activeRole,
        isAuthenticated: true,
        isLoading: false,
      });
    },

    setUser: (user: UserProfile) => {
      set({ user });
    },

    setActiveRole: async (role: AppRole) => {
      // 1. Local-first: immediately update client store and SecureStore
      set({ activeRole: role });
      SecureStore.setItemAsync(ACTIVE_ROLE_KEY, role).catch(() => {});

      // 2. Sync preferredMode with PATCH /me in background without blocking or failing UI
      const currentUser = get().user;
      if (currentUser) {
        const mode = role === 'host' ? 'HOST' : 'DRIVER';
        updateProfileApi({ preferredMode: mode })
          .then((updated) => {
            set({ user: updated });
          })
          .catch(() => {
            // Non-blocking sync failure; retry on next app start
          });
      }
    },

    signOut: async () => {
      try {
        await unregisterPushTokenAsync().catch(() => {});
        await logoutApi();
      } finally {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    },
  };
});
