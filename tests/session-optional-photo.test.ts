import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { POST as createChargerRoute } from '../app/api/v1/chargers/route';
import { POST as startBookingRoute } from '../app/api/v1/bookings/[id]/start/route';
import { POST as sessionBookingRoute } from '../app/api/v1/bookings/[id]/session/route';
import { signAccessToken } from '../lib/auth';

describe('Charging Session Photo Rules (No Start Photo & Optional End Photo)', () => {
  let hostToken: string;
  let driverToken: string;
  let hostId: string;
  let driverId: string;
  let chargerId: string;

  beforeAll(async () => {
    const host = await db.user.create({
      data: {
        email: `photo_host_${Date.now()}@example.com`,
        name: 'Photo Host',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });
    hostToken = await signAccessToken({ userId: host.id, email: host.email, role: host.role });
    hostId = host.id;

    // Top up host wallet so booking sessions can be processed
    await db.walletTransaction.create({
      data: {
        hostId,
        type: 'TOPUP',
        amountPaisa: 500000,
        note: 'Test host balance topup',
      },
    });

    const driver = await db.user.create({
      data: {
        email: `photo_driver_${Date.now()}@example.com`,
        name: 'Photo Driver',
        hostStatus: 'NONE',
        isActive: true,
      },
    });
    driverToken = await signAccessToken({ userId: driver.id, email: driver.email, role: driver.role });
    driverId = driver.id;

    const createReq = new Request('http://localhost:3000/api/v1/chargers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: 'Session Photo Charger',
        powerKw: 11,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 6000,
        areaLabel: 'G-11',
        addressLine: 'St 5, G-11/3',
        lat: 33.67,
        lng: 73.00,
      }),
    });

    const createRes = await createChargerRoute(createReq);
    expect(createRes.status).toBe(201);
    const body = await createRes.json();
    chargerId = body.data.id;
  });

  it('proves start charging transitions to CHARGING without any start photo', async () => {
    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt: new Date(Date.now() - 5 * 60 * 1000),
        endsAt: new Date(Date.now() + 55 * 60 * 1000),
        status: 'ACCEPTED',
      },
    });

    const startReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostToken}` },
    });

    const startRes = await startBookingRoute(startReq, { params: Promise.resolve({ id: booking.id }) });
    expect(startRes.status).toBe(200);
    const body = await startRes.json();
    expect(body.data.status).toBe('CHARGING');

    const updated = await db.booking.findUnique({ where: { id: booking.id } });
    expect(updated?.status).toBe('CHARGING');

    await db.booking.delete({ where: { id: booking.id } });
  });

  it('proves POST /bookings/:id/session succeeds with NO meter photos at all', async () => {
    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 30 * 60 * 1000),
        status: 'CHARGING',
      },
    });

    const sessionReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        kwhDelivered: 18.5,
      }),
    });

    const sessionRes = await sessionBookingRoute(sessionReq, { params: Promise.resolve({ id: booking.id }) });
    expect(sessionRes.status).toBe(200);
    const body = await sessionRes.json();
    expect(body.data.sessionId).toBeDefined();
    expect(body.data.kwhDelivered).toBe(18.5);

    const dbSession = await db.session.findUnique({ where: { bookingId: booking.id } });
    expect(dbSession?.meterEndPhotoKey).toBeNull();
    expect(dbSession?.meterStartPhotoKey).toBeNull();

    await db.booking.delete({ where: { id: booking.id } });
  });
});
