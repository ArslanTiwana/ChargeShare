import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { db } from './db';

const expo = new Expo();

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(payload: NotificationPayload): Promise<{ sent: number; failed: number }> {
  try {
    const tokens = await db.pushToken.findMany({
      where: { userId: payload.userId },
    });

    if (!tokens.length) {
      return { sent: 0, failed: 0 };
    }

    const validTokens: string[] = [];
    const invalidTokens: string[] = [];

    for (const t of tokens) {
      if (Expo.isExpoPushToken(t.token)) {
        validTokens.push(t.token);
      } else {
        invalidTokens.push(t.token);
      }
    }

    // Clean up invalid tokens immediately
    if (invalidTokens.length > 0) {
      await db.pushToken.deleteMany({
        where: { token: { in: invalidTokens } },
      }).catch((err) => console.error('Error removing invalid push tokens:', err));
    }

    if (!validTokens.length) {
      return { sent: 0, failed: invalidTokens.length };
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      channelId: 'default',
    }));

    const chunks = expo.chunkPushNotifications(messages);
    let sentCount = 0;
    let failedCount = 0;
    const tokensToDelete: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        for (let j = 0; j < ticketChunk.length; j++) {
          const ticket: ExpoPushTicket = ticketChunk[j];
          if (ticket.status === 'ok') {
            sentCount++;
          } else {
            failedCount++;
            if (ticket.details?.error === 'DeviceNotRegistered') {
              tokensToDelete.push(chunk[j].to as string);
            }
          }
        }
      } catch (err) {
        console.error('Error sending push chunk:', err);
        failedCount += chunk.length;
      }
    }

    if (tokensToDelete.length > 0) {
      await db.pushToken.deleteMany({
        where: { token: { in: tokensToDelete } },
      }).catch((err) => console.error('Error deleting unregistered tokens:', err));
    }

    return { sent: sentCount, failed: failedCount };
  } catch (err) {
    console.error('Unhandled error in sendPushNotification:', err);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Dispatch push notification asynchronously using next/server after() if available,
 * or immediate non-blocking execution so it never blocks or fails caller operations.
 */
export function dispatchPushNotification(payload: NotificationPayload): void {
  const runner = async () => {
    try {
      await sendPushNotification(payload);
    } catch (err) {
      console.error('Push notification background dispatch failed:', err);
    }
  };

  try {
    import('next/server')
      .then(({ after }) => {
        if (typeof after === 'function') {
          after(runner);
        } else {
          runner();
        }
      })
      .catch(() => {
        runner();
      });
    return;
  } catch {
    // Next.js after() unavailable
  }

  runner();
}
