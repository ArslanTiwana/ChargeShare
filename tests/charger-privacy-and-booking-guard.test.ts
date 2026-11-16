import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { findNearbyChargers, generatePublicCoordinates } from '../lib/geo';
import { signAccessToken } from '../lib/auth';
import { GET as getChargerDetail } from '../app/api/v1/chargers/[id]/route';
import { POST as createBooking } from '../app/api/v1/bookings/route';
import { GET as getBookingDetail } from '../app/api/v1/bookings/[id]/route';

describe('Phase 5b Privacy & Booking Concurrency Rules', () => {
  let testDriverToken: string;
  let testDriverId: string;
  let testHostId: string;
  let testChargerId: string;
  let exactLat: number;
  let exactLng: number;

  beforeAll(async () => {
    // Seed / fetch test user
    const driver = await db.user.upsert({
      where: { email: 'driver1@example.com' },
      update: {
        isActive: true,
        emailVerifiedAt: new Date(),
        phone: '+923451234567',
      },
      create: {
        email: 'driver1@example.com',
        name: 'Hamza Abbasi',
        phone: '+923451234567',
        role: 'USER',
        hostStatus: 'NONE',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    testDriverId = driver.id;
    testDriverToken = await signAccessToken({
      userId: driver.id,
      email: driver.email,
      role: driver.role,
      hostStatus: driver.hostStatus,
    });

    // Fetch an approved online charger
    const charger = await db.charger.findFirst({
      where: { approvalStatus: 'APPROVED', isOnline: true },
      include: { host: true },
    });
    if (!charger) throw new Error('No approved charger found in test DB');
    testChargerId = charger.id;
    testHostId = charger.hostId;

    // Ensure host has positive wallet balance
    await db.walletTransaction.create({
      data: {
        hostId: charger.hostId,
        type: 'TOPUP',
        amountPaisa: 500000,
        note: 'Test top-up for privacy test suite',
      },
    });

    const [coords] = await db.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(location::geometry)::float as lat, ST_X(location::geometry)::float as lng
      FROM "Charger" WHERE id = ${charger.id}
    `;
    exactLat = coords.lat;
    exactLng = coords.lng;
  });

  it('generatePublicCoordinates generates 150-300m offset', () => {
    const lat = 33.6844;
    const lng = 73.0479;
    for (let i = 0; i < 10; i++) {
      const { publicLat, publicLng } = generatePublicCoordinates(lat, lng);
      expect(publicLat).not.toBe(lat);
      expect(publicLng).not.toBe(lng);
      // Rough distance check: latitude difference should be within 0.003 degrees (~330m)
      expect(Math.abs(publicLat - lat)).toBeLessThan(0.0035);
      expect(Math.abs(publicLng - lng)).toBeLessThan(0.0045);
    }
  });

  it('findNearbyChargers never exposes exact lat/lng or addressLine', async () => {
    const nearby = await findNearbyChargers(33.7, 73.05, 15);
    expect(nearby.length).toBeGreaterThan(0);

    for (const c of nearby) {
      expect((c as any).lat).toBeUndefined();
      expect((c as any).lng).toBeUndefined();
      expect((c as any).addressLine).toBeUndefined();
      expect(typeof c.publicLat).toBe('number');
      expect(typeof c.publicLng).toBe('number');
      // If it's our test charger, verify public coords are distinct from exact coords
      if (c.id === testChargerId) {
        expect(c.publicLat).not.toBe(exactLat);
        expect(c.publicLng).not.toBe(exactLng);
      }
    }
  });

  it('proves nearby search filters strictly based on publicLat/publicLng and not exact location', async () => {
    // Exact: 33.700000, 73.000000
    // Public: offset North by 250m -> approx 33.702246, 73.000000 (1 deg lat ~ 111320m)
    const exactTestLat = 33.700000;
    const exactTestLng = 73.000000;
    const publicTestLat = 33.702246; // exactly 250.0m north of exact
    const publicTestLng = 73.000000;

    const probeChargerId = 'c_probe_priv_' + Date.now().toString(36);
    await db.$executeRaw`
      INSERT INTO "Charger" (
        id, "hostId", title, "powerKw", "connectorType", "pricePerKwhPaisa",
        "areaLabel", "addressLine", "meterInstalled", "isOnline", "approvalStatus",
        location, "publicLat", "publicLng", "createdAt", "updatedAt"
      ) VALUES (
        ${probeChargerId}, ${testHostId}, 'Privacy Boundary Test Charger', 22.0, 'TYPE2'::"ConnectorType",
        6000, 'Test Sector', 'Secret House 99', true, true, 'APPROVED'::"ApprovalStatus",
        ST_SetSRID(ST_MakePoint(${exactTestLng}, ${exactTestLat}), 4326)::geography,
        ${publicTestLat}, ${publicTestLng}, NOW(), NOW()
      )
    `;

    try {
      // Point A: Located 120m North of public point -> 33.703324, 73.000000
      // Distance to public point = 120m (inside 200m radius)
      // Distance to exact point = 370m (outside 200m radius)
      // Must be INCLUDED because it is inside public radius
      const resA = await findNearbyChargers(33.703324, 73.000000, 0.2);
      const foundA = resA.some((c) => c.id === probeChargerId);
      expect(foundA).toBe(true);

      // Point B: Located 120m South of exact point -> 33.698922, 73.000000
      // Distance to exact point = 120m (inside 200m radius of exact point)
      // Distance to public point = 370m (outside 200m radius of public point)
      // Must be EXCLUDED because it is outside public radius
      const resB = await findNearbyChargers(33.698922, 73.000000, 0.2);
      const foundB = resB.some((c) => c.id === probeChargerId);
      expect(foundB).toBe(false);
    } finally {
      await db.charger.deleteMany({ where: { id: probeChargerId } });
    }
  });

  it('charger detail endpoint returns only publicLat/publicLng and hides addressLine for drivers', async () => {
    const req = new Request(`http://localhost:3000/api/v1/chargers/${testChargerId}`, {
      headers: {
        Authorization: `Bearer ${testDriverToken}`,
      },
    });

    const res = await getChargerDetail(req, {
      params: Promise.resolve({ id: testChargerId }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeDefined();

    expect((body.data as any).lat).toBeUndefined();
    expect((body.data as any).lng).toBeUndefined();
    expect((body.data as any).addressLine).toBeUndefined();
    expect(typeof body.data.publicLat).toBe('number');
    expect(typeof body.data.publicLng).toBe('number');
  });

  it('rejects duplicate driver booking requests with 409 DUPLICATE_BOOKING', async () => {
    const randomOffsetHours = 100 + Math.floor(Math.random() * 1000);
    const startsAt = new Date(Date.now() + randomOffsetHours * 3600 * 1000).toISOString();
    const endsAt = new Date(Date.now() + (randomOffsetHours + 2) * 3600 * 1000).toISOString();

    // Create first booking
    const req1 = new Request('http://localhost:3000/api/v1/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testDriverToken}`,
      },
      body: JSON.stringify({
        chargerId: testChargerId,
        startsAt,
        endsAt,
      }),
    });

    const res1 = await createBooking(req1);
    const body1 = await res1.json();
    expect(res1.status).toBe(201);
    expect(body1.data.id).toBeDefined();

    // Try to create second booking overlapping the same slot for the same driver & charger
    const req2 = new Request('http://localhost:3000/api/v1/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testDriverToken}`,
      },
      body: JSON.stringify({
        chargerId: testChargerId,
        startsAt,
        endsAt,
      }),
    });

    const res2 = await createBooking(req2);
    const body2 = await res2.json();
    expect(res2.status).toBe(409);
    expect(body2.error.code).toBe('DUPLICATE_BOOKING');

    // Clean up
    await db.booking.delete({ where: { id: body1.data.id } });
  });

  it('GET /bookings/:id includes serverTime and reveals exact coordinates only after accepted', async () => {
    const startsAt = new Date(Date.now() + 30 * 3600 * 1000);
    const endsAt = new Date(Date.now() + 32 * 3600 * 1000);

    const booking = await db.booking.create({
      data: {
        driverId: testDriverId,
        chargerId: testChargerId,
        startsAt,
        endsAt,
        status: 'REQUESTED',
      },
    });

    // 1. When REQUESTED: serverTime present, addressLine & exact coords NOT present
    const reqRequested = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}`, {
      headers: { Authorization: `Bearer ${testDriverToken}` },
    });
    const resRequested = await getBookingDetail(reqRequested, {
      params: Promise.resolve({ id: booking.id }),
    });
    const bodyRequested = await resRequested.json();

    expect(bodyRequested.data.serverTime).toBeDefined();
    expect(new Date(bodyRequested.data.serverTime).getTime()).toBeGreaterThan(0);
    expect(bodyRequested.data.charger.addressLine).toBeUndefined();
    expect(bodyRequested.data.charger.lat).toBeUndefined();
    expect(bodyRequested.data.charger.lng).toBeUndefined();

    // 2. When ACCEPTED: addressLine and exact lat/lng ARE revealed
    await db.booking.update({
      where: { id: booking.id },
      data: { status: 'ACCEPTED' },
    });

    const reqAccepted = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}`, {
      headers: { Authorization: `Bearer ${testDriverToken}` },
    });
    const resAccepted = await getBookingDetail(reqAccepted, {
      params: Promise.resolve({ id: booking.id }),
    });
    const bodyAccepted = await resAccepted.json();

    expect(bodyAccepted.data.charger.addressLine).toBeDefined();
    expect(bodyAccepted.data.charger.lat).toBe(exactLat);
    expect(bodyAccepted.data.charger.lng).toBe(exactLng);

    // Clean up
    await db.booking.delete({ where: { id: booking.id } });
  });
});
