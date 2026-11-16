import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from '../api/client';
import * as SecureStore from 'expo-secure-store';

const SAVED_PUSH_TOKEN_KEY = 'cs_saved_push_token';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Ignored in test environment
}

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ChargeShare Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
      sound: 'default',
    });
  }
}

export async function registerForPushNotificationsAsync(
  onShowRationale?: () => Promise<boolean>
): Promise<string | null> {
  try {
    await setupNotificationChannels();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      if (onShowRationale) {
        const proceed = await onShowRationale();
        if (!proceed) {
          return null;
        }
      }

      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync().catch((err) => {
      console.warn('Could not fetch Expo push token:', err);
      return null;
    });

    if (!tokenResponse?.data) {
      return null;
    }

    const token = tokenResponse.data;

    // Send to backend
    await apiFetch('/push-tokens', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      }),
    });

    await SecureStore.setItemAsync(SAVED_PUSH_TOKEN_KEY, token);

    return token;
  } catch (err) {
    console.error('Failed to register push token:', err);
    return null;
  }
}

export async function unregisterPushTokenAsync(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(SAVED_PUSH_TOKEN_KEY);
    if (token) {
      await apiFetch('/push-tokens', {
        method: 'DELETE',
        body: JSON.stringify({ token }),
      }).catch(() => null);
      await SecureStore.deleteItemAsync(SAVED_PUSH_TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to unregister push token:', err);
  }
}

export function handleNotificationNavigation(
  data: Record<string, unknown> | undefined,
  router: { push: (url: any) => void }
): void {
  if (!data || !data.type) return;

  const type = String(data.type);
  const bookingId = data.bookingId ? String(data.bookingId) : null;
  const chargerId = data.chargerId ? String(data.chargerId) : null;

  if (
    [
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
    ].includes(type) &&
    bookingId
  ) {
    router.push({ pathname: '/bookings/[id]', params: { id: bookingId } });
  } else if (['TOPUP_APPROVED', 'TOPUP_REJECTED', 'WALLET_LOW_BALANCE'].includes(type)) {
    router.push('/host-wallet');
  } else if (['CHARGER_APPROVED', 'CHARGER_REJECTED'].includes(type)) {
    if (chargerId) {
      router.push({ pathname: '/host-charger/[id]', params: { id: chargerId } });
    } else {
      router.push('/host-chargers');
    }
  }
}
