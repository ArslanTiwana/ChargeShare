import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuthStore } from '../../src/store/auth-store';
import { RoleSwitcher } from '../../src/components/RoleSwitcher';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const { activeRole } = useAuthStore();
  const isHost = activeRole === 'host';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.white,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.ink,
        },
        headerRight: () => (
          <View style={{ marginRight: 16 }}>
            <RoleSwitcher />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.borderSubtle,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.emeraldDark,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      {/* ── DRIVER TABS ── */}
      <Tabs.Screen
        name="find"
        options={{
          href: isHost ? null : '/find',
          title: 'Find',
          headerTitle: 'Find Chargers',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⚡</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          href: isHost ? null : '/bookings',
          title: 'Bookings',
          headerTitle: 'My Bookings',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📅</Text>
          ),
        }}
      />

      {/* ── HOST TABS ── */}
      <Tabs.Screen
        name="host-dashboard"
        options={{
          href: isHost ? '/host-dashboard' : null,
          title: 'Dashboard',
          headerTitle: 'Host Dashboard',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📊</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="host-bookings"
        options={{
          href: isHost ? '/host-bookings' : null,
          title: 'Bookings',
          headerTitle: 'Host Bookings',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📅</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="host-chargers"
        options={{
          href: isHost ? '/host-chargers' : null,
          title: 'Chargers',
          headerTitle: 'My Chargers',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⚡</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="host-wallet"
        options={{
          href: isHost ? '/host-wallet' : null,
          title: 'Wallet',
          headerTitle: 'Host Wallet',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💳</Text>
          ),
        }}
      />

      {/* ── SHARED PROFILE TAB ── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Account & Settings',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👤</Text>
          ),
        }}
      />
    </Tabs>
  );
}
