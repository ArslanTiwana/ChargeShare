import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';

export function getInitialRoute(
  user: {
    preferredMode: 'DRIVER' | 'HOST' | null;
    hostStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'SUSPENDED';
  } | null,
  isAuthenticated: boolean
): string {
  if (!isAuthenticated || !user) {
    return '/(auth)/sign-in';
  }

  // First-time Google or existing account without preferredMode
  if (!user.preferredMode) {
    return '/(auth)/choose-role';
  }

  // Host mode: /(app)/host-dashboard handles NONE (onboarding), PENDING (waiting),
  // SUSPENDED (support notice), and APPROVED (dashboard) via HostStatusGate
  if (user.preferredMode === 'HOST') {
    return '/(app)/host-dashboard';
  }

  // Driver mode default
  return '/(app)/find';
}

export default function Index() {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  const target = getInitialRoute(user, isAuthenticated);
  return <Redirect href={target as any} />;
}
