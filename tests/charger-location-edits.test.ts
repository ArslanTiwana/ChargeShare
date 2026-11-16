import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { POST as createChargerRoute } from '../app/api/v1/chargers/route';
import { PATCH as updateChargerRoute } from '../app/api/v1/chargers/[id]/route';
import { POST as approveChargerRoute } from '../app/api/v1/admin/chargers/[id]/approve/route';
import { signAccessToken } from '../lib/auth';

describe('Charger Location Edits and Safety Rules', () => {
  let hostToken: string;
  let driverToken: string;
  let adminToken: string;
  let hostId: string;
  let driverId: string;
  let chargerId: string;

  beforeAll(async () => {
    const host = await db.user.create({
      data: {
        email: `loc_host_${Date.now()}@example.com`,
        name: 'Location Host',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });
    hostToken = await signAccessToken({ userId: host.id, email: host.email, role: host.role });
    hostId = host.id;

    const driver = await db.user.create({
      data: {
        email: `loc_driver_${Date.now()}@example.com`,
        name: 'Location Driver',
        hostStatus: 'NONE',
        isActive: true,
      },
    });
    driverToken = await signAccessToken({ userId: driver.id, email: driver.email, role: driver.role });
    driverId = driver.id;

    const admin = await db.user.create({
      data: {
        email: `loc_admin_${Date.now()}@example.com`,
        name: 'Location Admin',
        role: 'ADMIN',
        isActive: true,
      },
    });
    adminToken = await signAccessToken({ userId: admin.id, email: admin.email, role: admin.role });

    const createReq = new Request('http://localhost:3000/api/v1/chargers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: 'Location Edit Test Charger',
        powerKw: 7.4,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 5500,
        areaLabel: 'F-10',
        addressLine: 'St 20, F-10/2, Islamabad',
        lat: 33.6938,
        lng: 73.0125,
      }),
    });

    const createRes = await createChargerRoute(createReq);
    expect(createRes.status).toBe(201);
    const body = await createRes.json();
    chargerId = body.data.id;

    const approveReq = new Request(`http://localhost:3000/api/v1/admin/chargers/${chargerId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await approveChargerRoute(approveReq, { params: Promise.resolve({ id: chargerId }) });
  });

  it('keeps public coordinates unchanged when moving <= 100 meters', async () => {
    const initial = await db.charger.findUnique({ where: { id: chargerId } });
    const initialPublicLat = initial?.publicLat;
    const initialPublicLng = initial?.publicLng;

    // Move ~20 meters
    const patchReq = new Request(`http://localhost:3000/api/v1/chargers/${chargerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        lat: 33.6940,
        lng: 73.0125,
      }),
    });

    const patchRes = await updateChargerRoute(patchReq, { params: Promise.resolve({ id: chargerId }) });
    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.data.publicLat).toBe(initialPublicLat);
    expect(body.data.publicLng).toBe(initialPublicLng);
  });

  it('recomputes public coordinates when moving > 100 meters', async () => {
    const beforeMove = await db.charger.findUnique({ where: { id: chargerId } });
    const beforeLat = beforeMove?.publicLat;

    // Move ~500 meters
    const patchReq = new Request(`http://localhost:3000/api/v1/chargers/${chargerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        lat: 33.6990,
        lng: 73.0125,
      }),
    });

    const patchRes = await updateChargerRoute(patchReq, { params: Promise.resolve({ id: chargerId }) });
    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.data.publicLat).not.toBe(beforeLat);
  });

  it('returns approved charger to PENDING on addressLine change', async () => {
    await db.charger.update({
      where: { id: chargerId },
      data: { approvalStatus: 'APPROVED', isOnline: true },
    });

    const patchReq = new Request(`http://localhost:3000/api/v1/chargers/${chargerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        addressLine: 'Brand New Street Address 99',
      }),
    });

    const patchRes = await updateChargerRoute(patchReq, { params: Promise.resolve({ id: chargerId }) });
    expect(patchRes.status).toBe(200);
    const updated = await db.charger.findUnique({ where: { id: chargerId } });
    expect(updated?.approvalStatus).toBe('PENDING');
    expect(updated?.isOnline).toBe(false);
  });

  it('blocks charger edits while a booking is REQUESTED, ACCEPTED, or CHARGING', async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

    const booking = await db.booking.create({
      data: {
        driverId,
        chargerId,
        startsAt,
        endsAt,
        status: 'REQUESTED',
      },
    });

    const patchReq = new Request(`http://localhost:3000/api/v1/chargers/${chargerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: 'Should Be Blocked',
      }),
    });

    const patchRes = await updateChargerRoute(patchReq, { params: Promise.resolve({ id: chargerId }) });
    expect(patchRes.status).toBe(400);
    const body = await patchRes.json();
    expect(body.error.code).toBe('CHARGER_HAS_ACTIVE_BOOKINGS');

    await db.booking.delete({ where: { id: booking.id } });
  });
});
