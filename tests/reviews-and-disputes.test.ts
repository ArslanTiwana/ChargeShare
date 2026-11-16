import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { POST as createReviewHandler } from '../app/api/v1/bookings/[id]/reviews/route';
import { GET as getChargerReviewsHandler } from '../app/api/v1/chargers/[id]/reviews/route';
import { POST as createDisputeHandler } from '../app/api/v1/bookings/[id]/disputes/route';
import { signAccessToken } from '../lib/auth';

describe('Part 3.7: Reviews & Disputes', () => {
  let driver: any;
  let host: any;
  let stranger: any;
  let charger: any;
  let driverToken: string;
  let hostToken: string;
  let strangerToken: string;

  beforeAll(async () => {
    // Unique test users
    const timestamp = Date.now();
    host = await db.user.create({
      data: {
        email: `rev_host_${timestamp}@example.com`,
        name: 'Review Test Host',
        role: 'USER',
        hostStatus: 'APPROVED',
      },
    });

    driver = await db.user.create({
      data: {
        email: `rev_driver_${timestamp}@example.com`,
        name: 'Review Test Driver',
        role: 'USER',
      },
    });

    stranger = await db.user.create({
      data: {
        email: `rev_stranger_${timestamp}@example.com`,
        name: 'Review Test Stranger',
        role: 'USER',
      },
    });

    // Create charger
    const location = await db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "Charger" (
        "id", "hostId", "title", "powerKw", "connectorType", "pricePerKwhPaisa",
        "areaLabel", "addressLine", "approvalStatus", "isOnline", "location", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${host.id}, 'Review Test Charger', 22.0, 'TYPE2', 6000,
        'F-7/2', 'Secret Street 44', 'APPROVED', true, ST_SetSRID(ST_MakePoint(73.05, 33.72), 4326), NOW()
      ) RETURNING id;
    `;
    charger = location[0];

    driverToken = await signAccessToken({
      userId: driver.id,
      email: driver.email,
      role: driver.role,
      hostStatus: driver.hostStatus,
    });

    hostToken = await signAccessToken({
      userId: host.id,
      email: host.email,
      role: host.role,
      hostStatus: host.hostStatus,
    });

    strangerToken = await signAccessToken({
      userId: stranger.id,
      email: stranger.email,
      role: stranger.role,
      hostStatus: stranger.hostStatus,
    });
  });

  it('rejects review before booking is CONFIRMED', async () => {
    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'COMPLETED',
      },
    });

    const req = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driverToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating: 5, comment: 'Great host!' }),
    });

    const res = await createReviewHandler(req, { params: Promise.resolve({ id: booking.id }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe('NOT_CONFIRMED');
  });

  it('allows review after booking is CONFIRMED and enforces single review per reviewer', async () => {
    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'CONFIRMED',
      },
    });

    // 1. Stranger cannot review
    const strangerReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${strangerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating: 4, comment: 'I did not use this charger' }),
    });
    const strangerRes = await createReviewHandler(strangerReq, { params: Promise.resolve({ id: booking.id }) });
    expect(strangerRes.status).toBe(403);

    // 2. Driver review succeeds
    const driverReq1 = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driverToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating: 5, comment: 'Fast charging and polite host!' }),
    });
    const driverRes1 = await createReviewHandler(driverReq1, { params: Promise.resolve({ id: booking.id }) });
    expect(driverRes1.status).toBe(201);
    const driverBody1 = await driverRes1.json();
    expect(driverBody1.data.rating).toBe(5);

    // 3. Driver cannot review again for the same booking (idempotency / duplicate check)
    const driverReq2 = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driverToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating: 4, comment: 'Trying to review again' }),
    });
    const driverRes2 = await createReviewHandler(driverReq2, { params: Promise.resolve({ id: booking.id }) });
    expect(driverRes2.status).toBe(409);
    const driverBody2 = await driverRes2.json();
    expect(driverBody2.error?.code).toBe('ALREADY_REVIEWED');

    // 4. Host can also review the driver
    const hostReq = new Request(`http://localhost:3000/api/v1/bookings/${booking.id}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hostToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating: 5, comment: 'Courteous driver, left on time' }),
    });
    const hostRes = await createReviewHandler(hostReq, { params: Promise.resolve({ id: booking.id }) });
    expect(hostRes.status).toBe(201);
  });

  it('aggregates charger reviews average rating and total count', async () => {
    const req = new Request(`http://localhost:3000/api/v1/chargers/${charger.id}/reviews`);
    const res = await getChargerReviewsHandler(req, { params: Promise.resolve({ id: charger.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.chargerId).toBe(charger.id);
    expect(body.data.totalReviews).toBe(1);
    expect(body.data.averageRating).toBe(5.0);
    expect(body.data.reviews.length).toBe(1);
  });

  it('handles dispute lifecycle and enforces single dispute per booking', async () => {
    // 1. Cannot dispute a REQUESTED booking
    const requestedBooking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(Date.now() + 3600 * 1000),
        endsAt: new Date(Date.now() + 7200 * 1000),
        status: 'REQUESTED',
      },
    });

    const req1 = new Request(`http://localhost:3000/api/v1/bookings/${requestedBooking.id}/disputes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driverToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Host is not responding to request' }),
    });
    const res1 = await createDisputeHandler(req1, { params: Promise.resolve({ id: requestedBooking.id }) });
    expect(res1.status).toBe(400);

    // 2. Can dispute an ACCEPTED / CHARGING / COMPLETED booking
    const acceptedBooking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'ACCEPTED',
      },
    });

    const req2 = new Request(`http://localhost:3000/api/v1/bookings/${acceptedBooking.id}/disputes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driverToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Charger was blocked by petrol car upon arrival' }),
    });
    const res2 = await createDisputeHandler(req2, { params: Promise.resolve({ id: acceptedBooking.id }) });
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.data.status).toBe('OPEN');

    // Booking status transitioned to DISPUTED
    const updatedBooking = await db.booking.findUnique({ where: { id: acceptedBooking.id } });
    expect(updatedBooking?.status).toBe('DISPUTED');

    // 3. Cannot file a second dispute on the same booking
    const req3 = new Request(`http://localhost:3000/api/v1/bookings/${acceptedBooking.id}/disputes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hostToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Driver cancelled without notifying' }),
    });
    const res3 = await createDisputeHandler(req3, { params: Promise.resolve({ id: acceptedBooking.id }) });
    expect(res3.status).toBe(409);
    const body3 = await res3.json();
    expect(body3.error?.code).toBe('DISPUTE_EXISTS');
  });
});
