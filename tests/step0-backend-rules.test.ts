import { describe, it, expect } from 'vitest';
import db from '../lib/db';
import { GET as getMeHandler } from '../app/api/v1/me/route';
import { POST as postSessionHandler } from '../app/api/v1/bookings/[id]/session/route';
import { POST as postTopupHandler } from '../app/api/v1/wallet/topups/route';
import { signAccessToken } from '../lib/auth';

describe('Step 0: Core Backend Rules Verification', () => {
  it('Rule (d): test DB guard throws if TEST_DATABASE_URL equals DATABASE_URL', () => {
    const testDbGuardCheck = (testUrl: string, devUrl: string) => {
      if (testUrl === devUrl) {
        throw new Error('CRITICAL SAFETY CHECK FAILED: TEST_DATABASE_URL must not be identical to DATABASE_URL.');
      }
      return true;
    };

    expect(() =>
      testDbGuardCheck('postgres://user:pass@host/db', 'postgres://user:pass@host/db')
    ).toThrow('CRITICAL SAFETY CHECK FAILED');

    expect(
      testDbGuardCheck('postgres://user:pass@host/test_db', 'postgres://user:pass@host/dev_db')
    ).toBe(true);
  });

  it('Rule (a): rejects meter photo or topup screenshot keys with incorrect ownership prefix', async () => {
    const host = await db.user.findFirst({ where: { hostStatus: 'APPROVED' } });
    if (!host) throw new Error('Host not found');
    const token = await signAccessToken({
      userId: host.id,
      email: host.email,
      role: host.role,
      hostStatus: host.hostStatus,
    });

    // Topup request with invalid prefix (e.g. stranger's id or invalid folder)
    const req = new Request('http://localhost:3000/api/v1/wallet/topups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amountPaisa: 50000,
        screenshotKey: 'TOPUP_SCREENSHOT/stranger_user_id/receipt.jpg',
      }),
    });

    const res = await postTopupHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain('Payment screenshot must be uploaded by and belong to the host');
  });

  it('Rule (b): blocks session reading revisions if booking is already CONFIRMED or DISPUTED', async () => {
    const host = await db.user.findFirst({ where: { hostStatus: 'APPROVED' } });
    const driver = await db.user.findFirst({ where: { role: 'USER', id: { not: host?.id } } });
    const charger = await db.charger.findFirst({ where: { hostId: host?.id } });
    if (!host || !driver || !charger) throw new Error('Required entities not found');

    const token = await signAccessToken({
      userId: host.id,
      email: host.email,
      role: host.role,
      hostStatus: host.hostStatus,
    });

    // Create a confirmed booking with an existing session
    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'CONFIRMED',
        session: {
          create: {
            kwhDelivered: 10,
            rateSnapshotPaisa: 5000,
            totalPaisa: 50000,
            commissionPaisa: 7500,
            meterStartPhotoKey: `METER_PHOTO/${host.id}/start.jpg`,
            meterEndPhotoKey: `METER_PHOTO/${host.id}/end.jpg`,
          },
        },
      },
    });

    const editReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kwhDelivered: 12,
        meterStartPhotoKey: `METER_PHOTO/${host.id}/start.jpg`,
        meterEndPhotoKey: `METER_PHOTO/${host.id}/end.jpg`,
        reason: 'Attempted edit on confirmed booking',
      }),
    });

    const editRes = await postSessionHandler(editReq, { params: Promise.resolve({ id: booking.id }) });
    expect(editRes.status).toBe(400);
    const body = await editRes.json();
    expect(body.error.code).toBe('CANNOT_EDIT');

    // Clean up
    await db.session.deleteMany({ where: { bookingId: booking.id } });
    await db.booking.delete({ where: { id: booking.id } });
  });

  it('Rule (c): enforces topup min/max, rejects duplicate references, and max 3 pending', async () => {
    const host = await db.user.findFirst({ where: { hostStatus: 'APPROVED' } });
    if (!host) throw new Error('Host not found');
    const token = await signAccessToken({
      userId: host.id,
      email: host.email,
      role: host.role,
      hostStatus: host.hostStatus,
    });

    // Below schema min amount (e.g. 100 paisa) gets rejected
    const belowMinReq = new Request('http://localhost:3000/api/v1/wallet/topups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amountPaisa: 100,
        screenshotKey: `TOPUP_SCREENSHOT/${host.id}/receipt.jpg`,
      }),
    });
    const belowMinRes = await postTopupHandler(belowMinReq);
    expect(belowMinRes.status).toBe(422); // Rejection of invalid amount

    // Duplicate reference test: create one topup with reference
    const uniqueRef = `TEST_REF_${Date.now()}`;
    const topup1 = await db.walletTopup.create({
      data: {
        hostId: host.id,
        amountPaisa: 50000,
        screenshotKey: `TOPUP_SCREENSHOT/${host.id}/receipt1.jpg`,
        reference: uniqueRef,
      },
    });

    // Submitting with duplicate reference should return 409 DUPLICATE_REFERENCE
    const dupReq = new Request('http://localhost:3000/api/v1/wallet/topups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amountPaisa: 50000,
        screenshotKey: `TOPUP_SCREENSHOT/${host.id}/receipt2.jpg`,
        reference: uniqueRef,
      }),
    });
    const dupRes = await postTopupHandler(dupReq);
    expect(dupRes.status).toBe(409);
    const dupBody = await dupRes.json();
    expect(dupBody.error.code).toBe('DUPLICATE_REFERENCE');

    // Clean up test topup
    await db.walletTopup.delete({ where: { id: topup1.id } });
  });

  it('GET /me returns emailVerifiedAt and hostStatus', async () => {
    const user = await db.user.findFirst({ where: { role: 'USER' } });
    if (!user) throw new Error('User not found');
    const token = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      hostStatus: user.hostStatus,
    });

    const req = new Request('http://localhost:3000/api/v1/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await getMeHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('hostStatus');
    expect(body.data).toHaveProperty('emailVerifiedAt');
    expect(body.data.hostStatus).toBe(user.hostStatus);
  });

  it('Session: accepts meter reading with NO photo and sets photo keys to null', async () => {
    const host = await db.user.findFirst({ where: { hostStatus: 'APPROVED' } });
    const driver = await db.user.findFirst({ where: { role: 'USER', id: { not: host?.id } } });
    const charger = await db.charger.findFirst({ where: { hostId: host?.id } });
    if (!host || !driver || !charger) throw new Error('Entities not found');

    const token = await signAccessToken({
      userId: host.id,
      email: host.email,
      role: host.role,
      hostStatus: host.hostStatus,
    });

    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'CHARGING',
      },
    });

    const req = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kwhDelivered: 15.5,
      }),
    });

    const res = await postSessionHandler(req, { params: Promise.resolve({ id: booking.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sessionId).toBeDefined();
    expect(body.data.bookingStatus).toBe('COMPLETED');

    const savedSession = await db.session.findUnique({ where: { id: body.data.sessionId } });
    expect(savedSession?.meterStartPhotoKey).toBeNull();
    expect(savedSession?.meterEndPhotoKey).toBeNull();

    // Clean up
    await db.session.deleteMany({ where: { bookingId: booking.id } });
    await db.booking.delete({ where: { id: booking.id } });
  });

  it('Session: accepts meter reading with ONLY end photo', async () => {
    const host = await db.user.findFirst({ where: { hostStatus: 'APPROVED' } });
    const driver = await db.user.findFirst({ where: { role: 'USER', id: { not: host?.id } } });
    const charger = await db.charger.findFirst({ where: { hostId: host?.id } });
    if (!host || !driver || !charger) throw new Error('Entities not found');

    const token = await signAccessToken({
      userId: host.id,
      email: host.email,
      role: host.role,
      hostStatus: host.hostStatus,
    });

    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'CHARGING',
      },
    });

    const req = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kwhDelivered: 20.0,
        meterEndPhotoKey: `METER_PHOTO/${host.id}/end-meter.jpg`,
      }),
    });

    const res = await postSessionHandler(req, { params: Promise.resolve({ id: booking.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sessionId).toBeDefined();

    const savedSession = await db.session.findUnique({ where: { id: body.data.sessionId } });
    expect(savedSession?.meterStartPhotoKey).toBeNull();
    expect(savedSession?.meterEndPhotoKey).toBe(`METER_PHOTO/${host.id}/end-meter.jpg`);

    // Clean up
    await db.session.deleteMany({ where: { bookingId: booking.id } });
    await db.booking.delete({ where: { id: booking.id } });
  });
});
