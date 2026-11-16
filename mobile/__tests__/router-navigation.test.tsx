import React from 'react';
import { renderRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import IndexScreen from '../app/index';
import AuthLayout from '../app/(auth)/_layout';
import SignInScreen from '../app/(auth)/sign-in';
import SignUpScreen from '../app/(auth)/sign-up';
import ForgotPasswordScreen from '../app/(auth)/forgot-password';
import ChooseRoleScreen from '../app/(auth)/choose-role';
import TabsLayout from '../app/(tabs)/_layout';
import FindScreen from '../app/(tabs)/find';
import BookingsScreen from '../app/(tabs)/bookings';
import HostDashboardScreen from '../app/(tabs)/host-dashboard';
import HostBookingsScreen from '../app/(tabs)/host-bookings';
import HostChargersScreen from '../app/(tabs)/host-chargers';
import HostWalletScreen from '../app/(tabs)/host-wallet';
import ProfileScreen from '../app/(tabs)/profile';
import ChargerDetailScreen from '../app/charger/[id]';
import BookingDetailScreen from '../app/bookings/[id]';
import HostBookingDetailScreen from '../app/host-booking/[id]';
import EnterMeterReadingScreen from '../app/host-booking/[id]/meter';
import NewChargerScreen from '../app/host-charger/new';
import EditChargerScreen from '../app/host-charger/[id]';
import TopupScreen from '../app/host-wallet/topup';
import HelpScreen from '../app/help';
import { useAuthStore } from '../src/store/auth-store';

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
}));

const routeMap = {
  '_layout': RootLayout,
  'index': IndexScreen,
  '(auth)/_layout': AuthLayout,
  '(auth)/sign-in': SignInScreen,
  '(auth)/sign-up': SignUpScreen,
  '(auth)/forgot-password': ForgotPasswordScreen,
  '(auth)/choose-role': ChooseRoleScreen,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/find': FindScreen,
  '(tabs)/bookings': BookingsScreen,
  '(tabs)/host-dashboard': HostDashboardScreen,
  '(tabs)/host-bookings': HostBookingsScreen,
  '(tabs)/host-chargers': HostChargersScreen,
  '(tabs)/host-wallet': HostWalletScreen,
  '(tabs)/profile': ProfileScreen,
  'charger/[id]': ChargerDetailScreen,
  'bookings/[id]': BookingDetailScreen,
  'host-booking/[id]': HostBookingDetailScreen,
  'host-booking/[id]/meter': EnterMeterReadingScreen,
  'host-charger/new': NewChargerScreen,
  'host-charger/[id]': EditChargerScreen,
  'host-wallet/topup': TopupScreen,
  'help': HelpScreen,
};

describe('Root Stack & Tabs Router Navigation Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        data: {
          id: 'abc',
          bookings: [],
          chargers: [],
          topups: [],
          balancePaisa: 500000,
          pendingTopupsPaisa: 0,
          bookingExpiryMinutes: 15,
          autoConfirmHours: 24,
          maxSessionKwh: 100,
          minTopupPaisa: 50000,
          maxTopupPaisa: 50000000,
          minBookingDurationHours: 1,
          maxBookingDurationHours: 4,
          topupInstructions: 'Pay to Admin',
          hostMinWalletWarningPaisa: 100000,
          charger: {
            id: 'abc',
            title: 'Test Charger',
            areaLabel: 'F-7, Islamabad',
            powerKw: 22,
            connectorType: 'TYPE_2',
            pricePerKwhPaisa: 3500,
            publicLat: 33.72,
            publicLng: 73.05,
            active: true,
            approvalStatus: 'APPROVED',
            host: { id: 'h_1', name: 'Host Test' },
          },
          booking: {
            id: 'abc',
            chargerId: 'c_1',
            driverId: 'u_1',
            status: 'CHARGING',
            startsAt: '2026-11-16T10:00:00Z',
            endsAt: '2026-11-16T12:00:00Z',
            rateSnapshotPaisa: 3500,
            charger: {
              id: 'c_1',
              title: 'Test Charger',
              powerKw: 22,
              connectorType: 'TYPE_2',
              pricePerKwhPaisa: 3500,
            },
            host: { id: 'h_1', name: 'Host Test' },
          },
          reviews: [],
          bookedSlots: [],
        },
      }),
    })) as any;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Authenticated Driver Role Navigation', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'u_driver',
          email: 'driver@chargeshare.pk',
          name: 'Driver Arslan',
          phone: '03001234567',
          role: 'USER',
          preferredMode: 'DRIVER',
          hostStatus: 'NONE',
          avatarUrl: null,
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: '2026-01-01T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        activeRole: 'driver',
        initializeAuth: async () => {},
      });
    });

    it('proves /find mounts the find screen in driver tabs', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/find' });
      expect(result.getPathname()).toBe('/find');
    });

    it('proves /bookings mounts the bookings tab', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/bookings' });
      expect(result.getPathname()).toBe('/bookings');
    });

    it('proves /profile mounts the profile tab', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/profile' });
      expect(result.getPathname()).toBe('/profile');
    });

    it('proves /charger/abc mounts the charger detail stack screen', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/charger/abc' });
      expect(result.getPathname()).toBe('/charger/abc');
      expect(result.getSearchParams()).toEqual({ id: 'abc' });
    });

    it('proves /bookings/abc mounts the booking detail stack screen', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/bookings/abc' });
      expect(result.getPathname()).toBe('/bookings/abc');
      expect(result.getSearchParams()).toEqual({ id: 'abc' });
    });

    it('proves root / redirects to /find for driver mode', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/' });
      expect(result.getPathname()).toBe('/find');
    });
  });

  describe('Authenticated Host Role Navigation & Root Stack Screens', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'u_host',
          email: 'host@chargeshare.pk',
          name: 'Host Arslan',
          phone: '03009876543',
          role: 'USER',
          preferredMode: 'HOST',
          hostStatus: 'APPROVED',
          avatarUrl: null,
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: '2026-01-01T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        activeRole: 'host',
        initializeAuth: async () => {},
      });
    });

    it('proves /host-dashboard mounts the host dashboard tab', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-dashboard' });
      expect(result.getPathname()).toBe('/host-dashboard');
    });

    it('proves /host-bookings mounts the host bookings tab', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-bookings' });
      expect(result.getPathname()).toBe('/host-bookings');
    });

    it('proves /host-chargers mounts the host chargers tab', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-chargers' });
      expect(result.getPathname()).toBe('/host-chargers');
    });

    it('proves /host-wallet mounts the host wallet tab', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-wallet' });
      expect(result.getPathname()).toBe('/host-wallet');
    });

    it('proves /host-booking/abc mounts the host booking detail stack screen', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-booking/abc' });
      expect(result.getPathname()).toBe('/host-booking/abc');
      expect(result.getSearchParams()).toEqual({ id: 'abc' });
    });

    it('proves /host-booking/abc/meter mounts the enter meter reading stack screen', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-booking/abc/meter' });
      expect(result.getPathname()).toBe('/host-booking/abc/meter');
      expect(result.getSearchParams()).toEqual({ id: 'abc' });
    });

    it('proves /host-charger/new mounts the add new charger stack screen', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-charger/new' });
      expect(result.getPathname()).toBe('/host-charger/new');
    });

    it('proves /host-charger/abc mounts the edit charger stack screen', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-charger/abc' });
      expect(result.getPathname()).toBe('/host-charger/abc');
      expect(result.getSearchParams()).toEqual({ id: 'abc' });
    });

    it('proves /host-wallet/topup mounts the topup stack screen', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/host-wallet/topup' });
      expect(result.getPathname()).toBe('/host-wallet/topup');
    });

    it('proves root / redirects to /host-dashboard for host mode', async () => {
      const result = await renderRouter(routeMap, { initialUrl: '/' });
      expect(result.getPathname()).toBe('/host-dashboard');
    });
  });

  describe('Auth Redirects and Gates', () => {
    it('redirects unauthenticated user from protected route to sign-in', async () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        activeRole: 'driver',
      });

      const result = await renderRouter(routeMap, { initialUrl: '/find' });
      expect(result.getPathname()).toBe('/sign-in');
    });

    it('redirects authenticated user without preferredMode to choose-role', async () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        user: {
          id: 'u_new',
          email: 'newuser@chargeshare.pk',
          name: 'New User',
          phone: null,
          role: 'USER',
          preferredMode: null,
          hostStatus: 'NONE',
          avatarUrl: null,
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: '2026-01-01T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        activeRole: 'driver',
        initializeAuth: async () => {},
      });

      const result = await renderRouter(routeMap, { initialUrl: '/' });
      expect(result.getPathname()).toBe('/choose-role');
    });
  });
});
