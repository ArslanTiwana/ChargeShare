import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { POST as createChargerRoute } from '../app/api/v1/chargers/route';
import { GET as mineChargersRoute } from '../app/api/v1/chargers/mine/route';
import { POST as rejectChargerRoute } from '../app/api/v1/admin/chargers/[id]/reject/route';
import { POST as approveChargerRoute } from '../app/api/v1/admin/chargers/[id]/approve/route';
import { signAccessToken, signAdminSessionToken, ADMIN_COOKIE_NAME } from '../lib/auth';

describe('Charger.rejectionReason Column and Workflow', () => {
  let hostToken: string;
  let adminCookie: string;
  let chargerId: string;

  beforeAll(async () => {
    const host = await db.user.create({
      data: {
        email: `host_rej_${Date.now()}@example.com`,
        name: 'Host For Rejection',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });
    hostToken = await signAccessToken({ userId: host.id, email: host.email, role: host.role });

    const admin = await db.user.create({
      data: {
        email: `admin_rej_${Date.now()}@example.com`,
        name: 'Admin For Rejection',
        role: 'ADMIN',
        isActive: true,
      },
    });
    const adminToken = await signAdminSessionToken(admin);
    adminCookie = `${ADMIN_COOKIE_NAME}=${adminToken}`;

    const createReq = new Request('http://localhost:3000/api/v1/chargers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: 'Rejection Reason Test Charger',
        powerKw: 11,
        connectorType: 'TYPE2',
        pricePerKwhPaisa: 6500,
        areaLabel: 'F-7',
        addressLine: 'House 42, St 10, F-7/2',
        lat: 33.72,
        lng: 73.05,
      }),
    });

    const createRes = await createChargerRoute(createReq);
    expect(createRes.status).toBe(201);
    const body = await createRes.json();
    chargerId = body.data.id;
  });

  it('proves admin rejection updates Charger.rejectionReason column directly', async () => {
    const rejectReq = new Request(`http://localhost:3000/api/v1/admin/chargers/${chargerId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        reason: 'Charger photo is blurry and sub-meter is not visible',
      }),
    });

    const rejectRes = await rejectChargerRoute(rejectReq, { params: Promise.resolve({ id: chargerId }) });
    expect(rejectRes.status).toBe(200);

    const dbCharger = await db.charger.findUnique({
      where: { id: chargerId },
    });
    expect(dbCharger?.approvalStatus).toBe('REJECTED');
    expect(dbCharger?.rejectionReason).toBe('Charger photo is blurry and sub-meter is not visible');
  });

  it('proves GET /api/v1/chargers/mine returns rejectionReason to the host', async () => {
    const mineReq = new Request('http://localhost:3000/api/v1/chargers/mine', {
      headers: { Authorization: `Bearer ${hostToken}` },
    });

    const mineRes = await mineChargersRoute(mineReq);
    expect(mineRes.status).toBe(200);
    const body = await mineRes.json();
    const found = body.data.chargers.find((c: any) => c.id === chargerId);
    expect(found).toBeDefined();
    expect(found.rejectionReason).toBe('Charger photo is blurry and sub-meter is not visible');
  });

  it('proves admin approval clears rejectionReason', async () => {
    const approveReq = new Request(`http://localhost:3000/api/v1/admin/chargers/${chargerId}/approve`, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        Origin: 'http://localhost:3000',
      },
    });

    const approveRes = await approveChargerRoute(approveReq, { params: Promise.resolve({ id: chargerId }) });
    expect(approveRes.status).toBe(200);

    const dbCharger = await db.charger.findUnique({
      where: { id: chargerId },
    });
    expect(dbCharger?.approvalStatus).toBe('APPROVED');
    expect(dbCharger?.rejectionReason).toBeNull();
  });
});
