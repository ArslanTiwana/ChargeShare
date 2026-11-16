import {
  handleNotificationNavigation,
  setupNotificationChannels,
} from '../src/utils/notifications';
import { Platform } from 'react-native';

describe('Mobile Push Notifications & Deep Linking', () => {
  it('routes booking lifecycle notifications to booking details screen', () => {
    const pushedRoutes: string[] = [];
    const mockRouter = {
      push: (url: string) => pushedRoutes.push(url),
    };

    const bookingEvents = [
      'BOOKING_REQUESTED',
      'BOOKING_ACCEPTED',
      'BOOKING_DECLINED',
      'BOOKING_CANCELLED',
      'BOOKING_EXPIRED',
      'SESSION_STARTED',
      'READING_ENTERED',
      'SESSION_CONFIRMED',
      'SESSION_AUTO_CONFIRMED',
      'DISPUTE_OPENED',
      'DISPUTE_RESOLVED',
    ];

    for (const eventType of bookingEvents) {
      handleNotificationNavigation(
        { type: eventType, bookingId: 'b_test_123' },
        mockRouter
      );
      expect(pushedRoutes[pushedRoutes.length - 1]).toBe('/bookings/b_test_123');
    }
  });

  it('routes wallet and top-up events to host wallet screen', () => {
    const pushedRoutes: string[] = [];
    const mockRouter = {
      push: (url: string) => pushedRoutes.push(url),
    };

    handleNotificationNavigation({ type: 'TOPUP_APPROVED' }, mockRouter);
    expect(pushedRoutes[pushedRoutes.length - 1]).toBe('/wallet');

    handleNotificationNavigation({ type: 'TOPUP_REJECTED' }, mockRouter);
    expect(pushedRoutes[pushedRoutes.length - 1]).toBe('/wallet');

    handleNotificationNavigation({ type: 'WALLET_LOW_BALANCE' }, mockRouter);
    expect(pushedRoutes[pushedRoutes.length - 1]).toBe('/wallet');
  });

  it('routes charger approval events to chargers screen', () => {
    const pushedRoutes: string[] = [];
    const mockRouter = {
      push: (url: string) => pushedRoutes.push(url),
    };

    handleNotificationNavigation({ type: 'CHARGER_APPROVED', chargerId: 'c_xyz' }, mockRouter);
    expect(pushedRoutes[pushedRoutes.length - 1]).toBe('/chargers/c_xyz');

    handleNotificationNavigation({ type: 'CHARGER_REJECTED' }, mockRouter);
    expect(pushedRoutes[pushedRoutes.length - 1]).toBe('/chargers');
  });

  it('sets up notification channel safely on Android', async () => {
    Platform.OS = 'android';
    await expect(setupNotificationChannels()).resolves.toBeUndefined();
  });
});
