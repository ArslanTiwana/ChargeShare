import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { DELETE as inAppDelete } from '@/app/api/v1/me/account/route';
import { POST as requestDeletion } from '@/app/api/v1/auth/request-deletion/route';
import { POST as confirmDeletion } from '@/app/api/v1/auth/confirm-deletion/route';
import { POST as createCharger } from '@/app/api/v1/chargers/route';
import { signAccessToken, hashPassword, hashToken } from '@/lib/auth';

describe('Account Deletion & Data Anonymization', () => {
  let user: any;
  let authToken: string;

  beforeEach(async () => {
    const timestamp = Date.now();
    const passwordHash = await hashPassword('SecurePass123!');
    user = await db.user.create({
      data: {
        email: `deltest_${timestamp}@test.com`,
        name: 'Delete Test User',
        phone: '03001234567',
        passwordHash,
        role: 'USER',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });

    authToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: 'USER',
      hostStatus: 'APPROVED',
    });
  });

  it('rejects deletion if password is incorrect', async () => {
    const req = new Request('http://localhost:3000/api/v1/me/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ password: 'WrongPassword!' }),
    });

    const res = await inAppDelete(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks deletion if user has active bookings', async () => {
    // Create charger via API route
    const chargerReq = new Request('http://localhost:3000/api/v1/chargers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Active Booking Charger',
        powerKw: 7.4,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 5000,
        areaLabel: 'DHA',
        addressLine: '123 Test St',
        lat: 31.5,
        lng: 74.3,
      }),
    });

    const chargerRes = await createCharger(chargerReq);
    const chargerData = await chargerRes.json();
    const chargerId = chargerData.data.id;

    // Approve and online
    await db.charger.update({
      where: { id: chargerId },
      data: { approvalStatus: 'APPROVED', isOnline: true },
    });

    const startsAt = new Date(Date.now() + 3600 * 1000);
    const endsAt = new Date(Date.now() + 7200 * 1000);

    await db.booking.create({
      data: {
        driverId: user.id,
        chargerId,
        startsAt,
        endsAt,
        status: 'REQUESTED',
      },
    });

    const req = new Request('http://localhost:3000/api/v1/me/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ password: 'SecurePass123!' }),
    });

    const res = await inAppDelete(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('ACTIVE_BOOKINGS_EXIST');
  });

  it('blocks deletion if host has an unsettled negative wallet balance', async () => {
    await db.walletTransaction.create({
      data: {
        hostId: user.id,
        type: 'COMMISSION',
        amountPaisa: -5000,
        note: 'Unsettled negative balance',
      },
    });

    const req = new Request('http://localhost:3000/api/v1/me/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ password: 'SecurePass123!' }),
    });

    const res = await inAppDelete(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('NEGATIVE_BALANCE');
  });

  it('anonymizes user data, takes chargers offline, and revokes tokens', async () => {
    // Add charger via API route
    const chargerReq = new Request('http://localhost:3000/api/v1/chargers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'User Charger',
        powerKw: 11,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 6000,
        areaLabel: 'Gulberg',
        addressLine: '456 Test Ave',
        lat: 31.52,
        lng: 74.34,
      }),
    });

    const chargerRes = await createCharger(chargerReq);
    const chargerData = await chargerRes.json();
    const chargerId = chargerData.data.id;

    await db.charger.update({
      where: { id: chargerId },
      data: { approvalStatus: 'APPROVED', isOnline: true },
    });

    await db.pushToken.create({
      data: {
        userId: user.id,
        token: `ExponentPushToken[user_token_${Date.now()}_${Math.random().toString(36).substring(2, 7)}]`,
        platform: 'android',
      },
    });

    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(`sample_raw_refresh_token_${Date.now()}_${Math.random()}`),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const req = new Request('http://localhost:3000/api/v1/me/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ password: 'SecurePass123!' }),
    });

    const res = await inAppDelete(req);
    expect(res.status).toBe(200);

    // Verify user is anonymized
    const updatedUser = await db.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.name).toBe('Deleted User');
    expect(updatedUser?.email).toBe(`deleted_${user.id}@chargeshare.local`);
    expect(updatedUser?.phone).toBeNull();
    expect(updatedUser?.passwordHash).toBeNull();
    expect(updatedUser?.isActive).toBe(false);
    expect(updatedUser?.hostStatus).toBe('NONE');

    // Verify charger is set offline
    const updatedCharger = await db.charger.findUnique({ where: { id: chargerId } });
    expect(updatedCharger?.isOnline).toBe(false);

    // Verify push tokens deleted
    const pushTokens = await db.pushToken.findMany({ where: { userId: user.id } });
    expect(pushTokens.length).toBe(0);

    // Verify refresh tokens revoked
    const refreshTokens = await db.refreshToken.findMany({ where: { userId: user.id } });
    expect(refreshTokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('supports email-based web deletion flow', async () => {
    // 1. Request deletion
    const req1 = new Request('http://localhost:3000/api/v1/auth/request-deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });

    const res1 = await requestDeletion(req1);
    expect(res1.status).toBe(200);

    const emailToken = await db.emailToken.findFirst({
      where: { userId: user.id, type: 'DELETE_ACCOUNT' },
    });
    expect(emailToken).not.toBeNull();

    // 2. Confirm deletion using token
    // We create a known raw token
    const rawToken = 'test_confirm_token_web_12345';
    await db.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        type: 'DELETE_ACCOUNT',
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const req2 = new Request('http://localhost:3000/api/v1/auth/confirm-deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken }),
    });

    const res2 = await confirmDeletion(req2);
    expect(res2.status).toBe(200);

    const updatedUser = await db.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.name).toBe('Deleted User');
    expect(updatedUser?.isActive).toBe(false);
  });
});
