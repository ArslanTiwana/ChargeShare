import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { POST as registerToken, DELETE as deleteToken } from '@/app/api/v1/push-tokens/route';
import { signAccessToken } from '@/lib/auth';
import { sendPushNotification } from '@/lib/notifications';

describe('Push Tokens & Notification Delivery', () => {
  let user: { id: string; email: string };
  let authToken: string;

  beforeEach(async () => {
    const timestamp = Date.now();
    user = await db.user.create({
      data: {
        email: `pushtest_${timestamp}@test.com`,
        name: 'Push Test User',
        role: 'USER',
        hostStatus: 'NONE',
        isActive: true,
      },
    });

    authToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: 'USER',
      hostStatus: 'NONE',
    });
  });

  it('registers and upserts push tokens for authenticated user', async () => {
    const tokenStr = `ExponentPushToken[register_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}]`;

    const req1 = new Request('http://localhost:3000/api/v1/push-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token: tokenStr,
        platform: 'android',
      }),
    });

    const res1 = await registerToken(req1);
    const data1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(data1.data.token).toBe(tokenStr);
    expect(data1.data.platform).toBe('android');
    expect(data1.data.userId).toBe(user.id);

    // Upsert with new platform
    const req2 = new Request('http://localhost:3000/api/v1/push-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token: tokenStr,
        platform: 'ios',
      }),
    });

    const res2 = await registerToken(req2);
    const data2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(data2.data.platform).toBe('ios');

    const inDb = await db.pushToken.findMany({ where: { token: tokenStr } });
    expect(inDb.length).toBe(1);
    expect(inDb[0].platform).toBe('ios');
  });

  it('deletes push token on sign-out', async () => {
    const tokenStr = `ExponentPushToken[delete_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}]`;
    await db.pushToken.create({
      data: {
        userId: user.id,
        token: tokenStr,
        platform: 'android',
      },
    });

    const req = new Request('http://localhost:3000/api/v1/push-tokens', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token: tokenStr,
      }),
    });

    const res = await deleteToken(req);
    expect(res.status).toBe(200);

    const check = await db.pushToken.findUnique({ where: { token: tokenStr } });
    expect(check).toBeNull();
  });

  it('safely handles non-Expo invalid tokens and cleans them up', async () => {
    const invalidToken = 'InvalidPushTokenNotExpo';
    await db.pushToken.create({
      data: {
        userId: user.id,
        token: invalidToken,
        platform: 'android',
      },
    });

    const result = await sendPushNotification({
      userId: user.id,
      title: 'Test Notification',
      body: 'Generic test message without personal data',
      data: { type: 'TEST', id: '123' },
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);

    // Invalid token should have been purged from database
    const check = await db.pushToken.findUnique({ where: { token: invalidToken } });
    expect(check).toBeNull();
  });
});
