import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { POST as createChargerRoute } from '../app/api/v1/chargers/route';
import { POST as cancelBookingRoute } from '../app/api/v1/bookings/[id]/cancel/route';
import { signAccessToken } from '../lib/auth';

describe('Booking Cancellation Party and Reason Recording', () => {
  let hostToken: string;
  let driverToken: string;
  let hostId: string;
  let driverId: string;
  let chargerId: string;

  beforeAll(async () => {
    const host = await db.user.create({
      data: {
        email: `cancel_host_${Date.now()}@example.com`,
        name: 'Cancel Host',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });
    hostToken = await signAccessToken({ userId: host.id, email: host.email, role: host.role });
    hostId = host.id;

    const driver = await db.user.create({
      data: {
        email: `cancel_driver_${Date.now()}@example.com`,
        name: 'Cancel Driver',
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
        title: 'Cancel Test Charger',
        powerKw: 7.4,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 5000,
        areaLabel: 'E-11',
        addressLine: 'St 12, E-11/3',
        lat: 33.70,
        lng: 72.98,
      }),
    });

    const createRes = await createChargerRoute(createReq);
    expect(createRes.status).toBe(201);
    const body = await createRes.json();
    chargerId = body.data.id;
  });

  it('records cancelledById and cancelReason when host cancels', async () => {
    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        status: 'ACCEPTED',
      },
    });

    const cancelReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        reason: 'Host power cut in neighborhood',
      }),
    });

    const cancelRes = await cancelBookingRoute(cancelReq, { params: Promise.resolve({ id: booking.id }) });
    expect(cancelRes.status).toBe(200);

    const updated = await db.booking.findUnique({
      where: { id: booking.id },
    });

    expect(updated?.status).toBe('CANCELLED');
    expect(updated?.cancelledById).toBe(hostId);
    expect(updated?.cancelReason).toContain('Host power cut in neighborhood');
  });

  it('records cancelledById and cancelReason when driver cancels', async () => {
    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
        status: 'REQUESTED',
      },
    });

    const cancelReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        reason: 'Driver trip postponed',
      }),
    });

    const cancelRes = await cancelBookingRoute(cancelReq, { params: Promise.resolve({ id: booking.id }) });
    expect(cancelRes.status).toBe(200);

    const updated = await db.booking.findUnique({
      where: { id: booking.id },
    });

    expect(updated?.status).toBe('CANCELLED');
    expect(updated?.cancelledById).toBe(driverId);
    expect(updated?.cancelReason).toContain('Driver trip postponed');
  });
});
