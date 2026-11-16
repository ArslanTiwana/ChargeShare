import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { GET as cleanupCron } from '@/app/api/cron/cleanup-expired-photos/route';
import { POST as createCharger } from '@/app/api/v1/chargers/route';
import { signAccessToken } from '@/lib/auth';

describe('Photo Retention Cleanup Cron', () => {
  const cronSecret = process.env.CRON_SECRET || 'test_cron_secret_12345';

  beforeEach(() => {
    process.env.CRON_SECRET = cronSecret;
  });

  it('rejects unauthenticated requests without CRON_SECRET', async () => {
    const req = new Request('http://localhost:3000/api/cron/cleanup-expired-photos');
    const res = await cleanupCron(req);
    expect(res.status).toBe(401);
  });

  it('cleans up photo keys on sessions older than retention cutoff', async () => {
    const timestamp = Date.now();
    const host = await db.user.create({
      data: {
        email: `cronhost_${timestamp}@test.com`,
        name: 'Cron Host',
        role: 'USER',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });

    const driver = await db.user.create({
      data: {
        email: `crondriver_${timestamp}@test.com`,
        name: 'Cron Driver',
        role: 'USER',
        hostStatus: 'NONE',
        isActive: true,
      },
    });

    const hostToken = await signAccessToken({
      userId: host.id,
      email: host.email,
      role: 'USER',
      hostStatus: 'APPROVED',
    });

    const chargerReq = new Request('http://localhost:3000/api/v1/chargers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: 'Cron Charger',
        powerKw: 7.4,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 5000,
        areaLabel: 'Model Town',
        addressLine: '789 Test Rd',
        lat: 31.48,
        lng: 74.31,
      }),
    });

    const chargerRes = await createCharger(chargerReq);
    const chargerData = await chargerRes.json();
    const chargerId = chargerData.data.id;

    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId,
        startsAt: new Date(Date.now() - 200 * 24 * 3600 * 1000),
        endsAt: new Date(Date.now() - 200 * 24 * 3600 * 1000 + 3600000),
        status: 'CONFIRMED',
      },
    });

    // Create session created 200 days ago (older than default 180 days)
    const oldDate = new Date(Date.now() - 200 * 24 * 3600 * 1000);
    const session = await db.session.create({
      data: {
        bookingId: booking.id,
        kwhDelivered: 20,
        rateSnapshotPaisa: 5000,
        totalPaisa: 100000,
        commissionPaisa: 10000,
        meterStartPhotoKey: `METER_PHOTO/${host.id}/old_start.jpg`,
        meterEndPhotoKey: `METER_PHOTO/${host.id}/old_end.jpg`,
        hostEnteredAt: oldDate,
        createdAt: oldDate,
      },
    });

    const req = new Request('http://localhost:3000/api/cron/cleanup-expired-photos', {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const res = await cleanupCron(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cleanedSessionsCount).toBeGreaterThanOrEqual(1);

    const updatedSession = await db.session.findUnique({ where: { id: session.id } });
    expect(updatedSession?.meterStartPhotoKey).toBeNull();
    expect(updatedSession?.meterEndPhotoKey).toBeNull();
  });
});
