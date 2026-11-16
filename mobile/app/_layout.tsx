import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '../src/store/auth-store';
import { colors } from '../src/theme';
import { initGoogleAuth } from '../src/services/google-auth';
import { initMobileSentry } from '../src/utils/sentry';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  handleNotificationNavigation,
} from '../src/utils/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

function AuthGate() {
  const { isLoading, isAuthenticated, initializeAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initMobileSentry();
    initGoogleAuth();
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to sign in if not authenticated
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to app if already authenticated
      router.replace('/(app)/find');
    }
  }, [isLoading, isAuthenticated, segments, router]);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync().catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request?.content?.data;
      handleNotificationNavigation(data as Record<string, unknown>, router);
    });
    return () => subscription.remove();
  }, [router]);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>⚡</Text>
        </View>
        <Text style={styles.splashTitle}>ChargeShare</Text>
        <Text style={styles.splashSubtitle}>Pakistan's EV Charging Network</Text>
        <ActivityIndicator
          size="small"
          color={colors.emerald}
          style={styles.spinner}
        />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="small" color={colors.emerald} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AuthGate />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 32,
  },
  splashTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 6,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
});
