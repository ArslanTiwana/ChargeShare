jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Redirect: () => null,
}));

import { getInitialRoute } from '../app/index';
import { useAuthStore } from '../src/store/auth-store';
import * as authApi from '../src/api/auth';

jest.mock('../src/api/auth');
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('Role Selection and Initial Route Resolution', () => {
  it('redirects to /(auth)/sign-in when unauthenticated or user is missing', () => {
    expect(getInitialRoute(null, false)).toBe('/(auth)/sign-in');
    expect(getInitialRoute(null, true)).toBe('/(auth)/sign-in');
  });

  it('redirects to /(auth)/choose-role for accounts with null preferredMode (e.g. first Google sign-in)', () => {
    const googleUser = {
      preferredMode: null,
      hostStatus: 'NONE' as const,
    };
    expect(getInitialRoute(googleUser, true)).toBe('/(auth)/choose-role');
  });

  it('redirects to /(app)/find when preferredMode is DRIVER', () => {
    const driverUser = {
      preferredMode: 'DRIVER' as const,
      hostStatus: 'NONE' as const,
    };
    expect(getInitialRoute(driverUser, true)).toBe('/(app)/find');
  });

  it('redirects to /(app)/host-dashboard when preferredMode is HOST across all host statuses', () => {
    // 1. APPROVED -> goes to host-dashboard (renders full host dashboard)
    expect(
      getInitialRoute({ preferredMode: 'HOST', hostStatus: 'APPROVED' }, true)
    ).toBe('/(app)/host-dashboard');

    // 2. PENDING -> goes to host-dashboard (HostStatusGate renders review waiting screen)
    expect(
      getInitialRoute({ preferredMode: 'HOST', hostStatus: 'PENDING' }, true)
    ).toBe('/(app)/host-dashboard');

    // 3. NONE -> goes to host-dashboard (HostStatusGate renders onboarding application)
    expect(
      getInitialRoute({ preferredMode: 'HOST', hostStatus: 'NONE' }, true)
    ).toBe('/(app)/host-dashboard');

    // 4. SUSPENDED -> goes to host-dashboard (HostStatusGate renders suspension notice)
    expect(
      getInitialRoute({ preferredMode: 'HOST', hostStatus: 'SUSPENDED' }, true)
    ).toBe('/(app)/host-dashboard');
  });

  it('switches role local-first and initiates non-blocking background sync', async () => {
    const updateProfileSpy = jest
      .spyOn(authApi, 'updateProfileApi')
      .mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        name: 'Test',
        phone: null,
        avatarUrl: null,
        role: 'USER',
        preferredMode: 'HOST',
        hostStatus: 'APPROVED',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

    const store = useAuthStore.getState();
    store.setUser({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test',
      phone: null,
      avatarUrl: null,
      role: 'USER',
      preferredMode: 'DRIVER',
      hostStatus: 'APPROVED',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    // Act: switch role to host
    await store.setActiveRole('host');

    // Assert: immediate local-first client state update
    expect(useAuthStore.getState().activeRole).toBe('host');

    // Assert: background sync called
    expect(updateProfileSpy).toHaveBeenCalledWith({ preferredMode: 'HOST' });
  });

  it('does not crash or revert local role if background sync fails', async () => {
    jest.spyOn(authApi, 'updateProfileApi').mockRejectedValue(new Error('Network offline'));

    const store = useAuthStore.getState();
    await store.setActiveRole('driver');

    // Local role remains driver despite network failure
    expect(useAuthStore.getState().activeRole).toBe('driver');
  });
});
