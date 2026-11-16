import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { POST as createChargerRoute } from '../app/api/v1/chargers/route';
import { POST as startBookingRoute } from '../app/api/v1/bookings/[id]/start/route';
import { signAccessToken } from '../lib/auth';

describe('Server-Enforced Start Charging Window', () => {
  let hostToken: string;
  let driverToken: string;
  let chargerId: string;
  let driverId: string;

  beforeAll(async () => {
    const host = await db.user.create({
      data: {
        email: `win_host_${Date.now()}@example.com`,
        name: 'Window Host',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });
    hostToken = await signAccessToken({ userId: host.id, email: host.email, role: host.role });

    const driver = await db.user.create({
      data: {
        email: `win_driver_${Date.now()}@example.com`,
        name: 'Window Driver',
        hostStatus: 'NONE',
        isActive: true,
      },
    });
    driverToken = await signAccessToken({ userId: driver.id, email: driver.email, role: driver.role });
    driverId = driver.id;

    await db.appConfig.upsert({
      where: { key: 'startWindowMinutes' },
      update: { value: '30' },
      create: { key: 'startWindowMinutes', value: '30' },
    });

    const createReq = new Request('http://localhost:3000/api/v1/chargers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: 'Start Window Charger',
        powerKw: 7.4,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 5000,
        areaLabel: 'I-8',
        addressLine: 'St 4, I-8/1',
        lat: 33.68,
        lng: 73.07,
      }),
    });

    const createRes = await createChargerRoute(createReq);
    expect(createRes.status).toBe(201);
    const body = await createRes.json();
    chargerId = body.data.id;

    await db.charger.update({
      where: { id: chargerId },
      data: { approvalStatus: 'APPROVED', isOnline: true },
    });
  });

  it('rejects start charging when current time is earlier than startsAt - startWindowMinutes', async () => {
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt,
        endsAt,
        status: 'ACCEPTED',
      },
    });

    const startReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostToken}` },
    });

    const startRes = await startBookingRoute(startReq, { params: Promise.resolve({ id: booking.id }) });
    expect(startRes.status).toBe(400);
    const body = await startRes.json();
    expect(body.error.code).toBe('OUTSIDE_START_WINDOW');

    await db.booking.delete({ where: { id: booking.id } });
  });

  it('rejects start charging when current time is after endsAt', async () => {
    const endsAt = new Date(Date.now() - 10 * 60 * 1000);
    const startsAt = new Date(endsAt.getTime() - 60 * 60 * 1000);

    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt,
        endsAt,
        status: 'ACCEPTED',
      },
    });

    const startReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hostToken}` },
    });

    const startRes = await startBookingRoute(startReq, { params: Promise.resolve({ id: booking.id }) });
    expect(startRes.status).toBe(400);
    const body = await startRes.json();
    expect(body.error.code).toBe('OUTSIDE_START_WINDOW');

    await db.booking.delete({ where: { id: booking.id } });
  });

  it('allows start charging within the valid start window (startsAt - 30m to endsAt)', async () => {
    const startsAt = new Date(Date.now() - 5 * 60 * 1000);
    const endsAt = new Date(Date.now() + 55 * 60 * 1000);

    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt,
        endsAt,
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

    await db.booking.delete({ where: { id: booking.id } });
  });
});
