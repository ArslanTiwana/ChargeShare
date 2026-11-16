import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { signAdminSessionToken, ADMIN_COOKIE_NAME } from '../lib/auth';
import { GET as getStatsHandler } from '../app/api/v1/admin/stats/route';
import { POST as approveHostHandler } from '../app/api/v1/admin/hosts/[id]/approve/route';
import { POST as suspendHostHandler } from '../app/api/v1/admin/hosts/[id]/suspend/route';
import { POST as approveChargerHandler } from '../app/api/v1/admin/chargers/[id]/approve/route';
import { POST as rejectChargerHandler } from '../app/api/v1/admin/chargers/[id]/reject/route';
import { POST as approveTopupHandler } from '../app/api/v1/admin/topups/[id]/approve/route';
import { POST as rejectTopupHandler } from '../app/api/v1/admin/topups/[id]/reject/route';
import { POST as resolveDisputeHandler } from '../app/api/v1/admin/disputes/[id]/resolve/route';
import { POST as deactivateUserHandler } from '../app/api/v1/admin/users/[id]/deactivate/route';
import { POST as activateUserHandler } from '../app/api/v1/admin/users/[id]/activate/route';
import { GET as getConfigHandler, PATCH as patchConfigHandler } from '../app/api/v1/admin/config/route';
import { GET as getAuditLogHandler } from '../app/api/v1/admin/audit-log/route';
import { POST as adminLogoutHandler } from '../app/api/v1/auth/admin/logout/route';

describe('Part 3.8: Admin API, Security & Operations', () => {
  let admin: any;
  let adminCookie: string;
  let testHost: any;
  let testDriver: any;
  let testCharger: any;

  beforeAll(async () => {
    const timestamp = Date.now();
    admin = await db.user.create({
      data: {
        email: `admin_${timestamp}@chargeshare.pk`,
        name: 'Super Admin',
        role: 'ADMIN',
      },
    });

    testHost = await db.user.create({
      data: {
        email: `adm_host_${timestamp}@example.com`,
        name: 'Admin Test Host',
        role: 'USER',
        hostStatus: 'PENDING',
      },
    });

    testDriver = await db.user.create({
      data: {
        email: `adm_driver_${timestamp}@example.com`,
        name: 'Admin Test Driver',
        role: 'USER',
      },
    });

    // Create a pending charger
    const location = await db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "Charger" (
        "id", "hostId", "title", "powerKw", "connectorType", "pricePerKwhPaisa",
        "areaLabel", "addressLine", "approvalStatus", "isOnline", "location", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${testHost.id}, 'Pending Admin Charger', 11.0, 'TYPE2', 5000,
        'G-11/3', 'Secret St 99', 'PENDING', false, ST_SetSRID(ST_MakePoint(73.0, 33.7), 4326), NOW()
      ) RETURNING id;
    `;
    testCharger = location[0];

    const sessionToken = await signAdminSessionToken(admin);
    adminCookie = `${ADMIN_COOKIE_NAME}=${sessionToken}`;
  });

  it('enforces admin session cookie and strictly forbids Bearer auth on admin endpoints', async () => {
    // 1. Bearer token auth is strictly rejected on admin routes with 403
    const bearerReq = new Request('http://localhost:3000/api/v1/admin/stats', {
      headers: {
        Authorization: 'Bearer some-jwt-token',
      },
    });
    const bearerRes = await getStatsHandler(bearerReq);
    expect(bearerRes.status).toBe(403);
    const bearerBody = await bearerRes.json();
    expect(bearerBody.error?.message).toContain('Bearer token authentication is forbidden');

    // 2. Missing cookie -> 401 Unauthorized
    const noCookieReq = new Request('http://localhost:3000/api/v1/admin/stats');
    const noCookieRes = await getStatsHandler(noCookieReq);
    expect(noCookieRes.status).toBe(401);

    // 3. Valid cookie -> 200 OK
    const validReq = new Request('http://localhost:3000/api/v1/admin/stats', {
      headers: {
        Cookie: adminCookie,
      },
    });
    const validRes = await getStatsHandler(validReq);
    expect(validRes.status).toBe(200);
    const validBody = await validRes.json();
    expect(validBody.data.users).toBeGreaterThanOrEqual(1);
  });

  it('enforces CSRF Origin header check on non-GET admin requests', async () => {
    const fakeOriginReq = new Request(`http://localhost:3000/api/v1/admin/hosts/${testHost.id}/approve`, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        Origin: 'https://malicious-site.com',
      },
    });
    const fakeOriginRes = await approveHostHandler(fakeOriginReq, {
      params: Promise.resolve({ id: testHost.id }),
    });
    expect(fakeOriginRes.status).toBe(403);
    const body = await fakeOriginRes.json();
    expect(body.error?.message).toContain('CSRF check failed');
  });

  it('approves and suspends a host, auditing every action and updating charger status', async () => {
    const origin = process.env.APP_URL || 'http://localhost:3000';

    // 1. Approve Host
    const approveReq = new Request(`http://localhost:3000/api/v1/admin/hosts/${testHost.id}/approve`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: origin },
    });
    const approveRes = await approveHostHandler(approveReq, { params: Promise.resolve({ id: testHost.id }) });
    expect(approveRes.status).toBe(200);
    const hostAfterApprove = await db.user.findUnique({ where: { id: testHost.id } });
    expect(hostAfterApprove?.hostStatus).toBe('APPROVED');

    // Verify audit log
    const auditApprove = await db.adminAuditLog.findFirst({
      where: { targetId: testHost.id, action: 'HOST_APPROVED' },
    });
    expect(auditApprove).toBeDefined();

    // 2. Suspend Host
    const suspendReq = new Request(`http://localhost:3000/api/v1/admin/hosts/${testHost.id}/suspend`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: origin },
    });
    const suspendRes = await suspendHostHandler(suspendReq, { params: Promise.resolve({ id: testHost.id }) });
    expect(suspendRes.status).toBe(200);
    const hostAfterSuspend = await db.user.findUnique({ where: { id: testHost.id } });
    expect(hostAfterSuspend?.hostStatus).toBe('SUSPENDED');

    // Re-approve for next tests
    await approveHostHandler(approveReq, { params: Promise.resolve({ id: testHost.id }) });
  });

  it('approves and rejects chargers with audit logs', async () => {
    const origin = process.env.APP_URL || 'http://localhost:3000';

    // Approve charger
    const approveReq = new Request(`http://localhost:3000/api/v1/admin/chargers/${testCharger.id}/approve`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: origin },
    });
    const approveRes = await approveChargerHandler(approveReq, { params: Promise.resolve({ id: testCharger.id }) });
    expect(approveRes.status).toBe(200);
    const chargerAfterApprove = await db.charger.findUnique({ where: { id: testCharger.id } });
    expect(chargerAfterApprove?.approvalStatus).toBe('APPROVED');

    // Reject charger
    const rejectReq = new Request(`http://localhost:3000/api/v1/admin/chargers/${testCharger.id}/reject`, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Meter photo is blurry and illegible' }),
    });
    const rejectRes = await rejectChargerHandler(rejectReq, { params: Promise.resolve({ id: testCharger.id }) });
    expect(rejectRes.status).toBe(200);
    const chargerAfterReject = await db.charger.findUnique({ where: { id: testCharger.id } });
    expect(chargerAfterReject?.approvalStatus).toBe('REJECTED');
  });

  it('approves top-up idempotently and rejects top-up with reason', async () => {
    const origin = process.env.APP_URL || 'http://localhost:3000';

    // Create pending topup
    const topup1 = await db.walletTopup.create({
      data: {
        hostId: testHost.id,
        amountPaisa: 500000,
        screenshotKey: `TOPUP_SCREENSHOT/${testHost.id}/receipt1.png`,
        reference: `IBFT-${Date.now()}-1`,
        status: 'PENDING',
      },
    });

    // Approve topup
    const approveReq1 = new Request(`http://localhost:3000/api/v1/admin/topups/${topup1.id}/approve`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: origin },
    });
    const approveRes1 = await approveTopupHandler(approveReq1, { params: Promise.resolve({ id: topup1.id }) });
    expect(approveRes1.status).toBe(200);

    // Check ledger credit
    const ledgerEntry = await db.walletTransaction.findFirst({
      where: { topupId: topup1.id, type: 'TOPUP' },
    });
    expect(ledgerEntry?.amountPaisa).toBe(500000);

    // Call approve again (idempotent)
    const approveRes2 = await approveTopupHandler(approveReq1, { params: Promise.resolve({ id: topup1.id }) });
    expect(approveRes2.status).toBe(200);
    const body2 = await approveRes2.json();
    expect(body2.data.idempotent).toBe(true);

    // Create topup2 and reject it
    const topup2 = await db.walletTopup.create({
      data: {
        hostId: testHost.id,
        amountPaisa: 200000,
        screenshotKey: `TOPUP_SCREENSHOT/${testHost.id}/receipt2.png`,
        reference: `IBFT-${Date.now()}-2`,
        status: 'PENDING',
      },
    });

    const rejectReq = new Request(`http://localhost:3000/api/v1/admin/topups/${topup2.id}/reject`, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Transaction reference not found in bank statement' }),
    });
    const rejectRes = await rejectTopupHandler(rejectReq, { params: Promise.resolve({ id: topup2.id }) });
    expect(rejectRes.status).toBe(200);
    const rejectedTopup = await db.walletTopup.findUnique({ where: { id: topup2.id } });
    expect(rejectedTopup?.status).toBe('REJECTED');
  });

  it('resolves disputes: target CONFIRMED creates commission, target CANCELLED does not, adjustment applies', async () => {
    const origin = process.env.APP_URL || 'http://localhost:3000';

    // 1. Case A: Target CONFIRMED
    const bookingA = await db.booking.create({
      data: {
        driverId: testDriver.id,
        chargerId: testCharger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'DISPUTED',
      },
    });

    await db.session.create({
      data: {
        bookingId: bookingA.id,
        kwhDelivered: 10.0,
        rateSnapshotPaisa: 5000,
        totalPaisa: 50000,
        commissionPaisa: 7500,
      },
    });

    const disputeA = await db.dispute.create({
      data: {
        bookingId: bookingA.id,
        openedById: testDriver.id,
        reason: 'Host unplugged 5 minutes early',
        status: 'OPEN',
      },
    });

    const resolveReqA = new Request(`http://localhost:3000/api/v1/admin/disputes/${disputeA.id}/resolve`, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetStatus: 'CONFIRMED',
        resolution: 'Verified with smart meter log: 10 kWh delivered. Confirmed.',
      }),
    });

    const resolveResA = await resolveDisputeHandler(resolveReqA, { params: Promise.resolve({ id: disputeA.id }) });
    expect(resolveResA.status).toBe(200);

    // Verify booking is CONFIRMED and COMMISSION ledger entry was created
    const updatedBookingA = await db.booking.findUnique({ where: { id: bookingA.id } });
    expect(updatedBookingA?.status).toBe('CONFIRMED');

    const commissionTxA = await db.walletTransaction.findFirst({
      where: { bookingId: bookingA.id, type: 'COMMISSION' },
    });
    expect(commissionTxA?.amountPaisa).toBe(-7500);

    // 2. Case B: Target CANCELLED with adjustment
    const bookingB = await db.booking.create({
      data: {
        driverId: testDriver.id,
        chargerId: testCharger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'DISPUTED',
      },
    });

    await db.session.create({
      data: {
        bookingId: bookingB.id,
        kwhDelivered: 5.0,
        rateSnapshotPaisa: 5000,
        totalPaisa: 25000,
        commissionPaisa: 3750,
      },
    });

    const disputeB = await db.dispute.create({
      data: {
        bookingId: bookingB.id,
        openedById: testDriver.id,
        reason: 'Charger power tripped immediately and never restarted',
        status: 'OPEN',
      },
    });

    const resolveReqB = new Request(`http://localhost:3000/api/v1/admin/disputes/${disputeB.id}/resolve`, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetStatus: 'CANCELLED',
        resolution: 'Charger tripped. Booking cancelled. Goodwill adjustment applied to host.',
        adjustmentPaisa: 5000, // Rs 50 courtesy credit
        adjustmentNote: 'Courtesy credit for host power test',
      }),
    });

    const resolveResB = await resolveDisputeHandler(resolveReqB, { params: Promise.resolve({ id: disputeB.id }) });
    expect(resolveResB.status).toBe(200);

    const updatedBookingB = await db.booking.findUnique({ where: { id: bookingB.id } });
    expect(updatedBookingB?.status).toBe('CANCELLED');

    // Commission must NOT be created
    const commissionTxB = await db.walletTransaction.findFirst({
      where: { bookingId: bookingB.id, type: 'COMMISSION' },
    });
    expect(commissionTxB).toBeNull();

    // Adjustment transaction must be created
    const adjTxB = await db.walletTransaction.findFirst({
      where: { bookingId: bookingB.id, type: 'ADJUSTMENT' },
    });
    expect(adjTxB?.amountPaisa).toBe(5000);
  });

  it('manages user activation and prevents self-deactivation', async () => {
    const origin = process.env.APP_URL || 'http://localhost:3000';

    // 1. Cannot deactivate self
    const selfDeactivateReq = new Request(`http://localhost:3000/api/v1/admin/users/${admin.id}/deactivate`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: origin },
    });
    const selfDeactivateRes = await deactivateUserHandler(selfDeactivateReq, {
      params: Promise.resolve({ id: admin.id }),
    });
    expect(selfDeactivateRes.status).toBe(400);

    // 2. Can deactivate other user
    const deactivateReq = new Request(`http://localhost:3000/api/v1/admin/users/${testDriver.id}/deactivate`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: origin },
    });
    const deactivateRes = await deactivateUserHandler(deactivateReq, {
      params: Promise.resolve({ id: testDriver.id }),
    });
    expect(deactivateRes.status).toBe(200);
    const deactivatedDriver = await db.user.findUnique({ where: { id: testDriver.id } });
    expect(deactivatedDriver?.isActive).toBe(false);

    // 3. Reactivate user
    const activateReq = new Request(`http://localhost:3000/api/v1/admin/users/${testDriver.id}/activate`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: origin },
    });
    const activateRes = await activateUserHandler(activateReq, {
      params: Promise.resolve({ id: testDriver.id }),
    });
    expect(activateRes.status).toBe(200);
    const reactivatedDriver = await db.user.findUnique({ where: { id: testDriver.id } });
    expect(reactivatedDriver?.isActive).toBe(true);
  });

  it('reads and updates platform configuration with audit log', async () => {
    const origin = process.env.APP_URL || 'http://localhost:3000';

    // GET config
    const getReq = new Request('http://localhost:3000/api/v1/admin/config', {
      headers: { Cookie: adminCookie },
    });
    const getRes = await getConfigHandler(getReq);
    expect(getRes.status).toBe(200);

    // PATCH config
    const patchReq = new Request('http://localhost:3000/api/v1/admin/config', {
      method: 'PATCH',
      headers: {
        Cookie: adminCookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commissionPercent: '12',
        bookingExpiryMinutes: '25',
      }),
    });
    const patchRes = await patchConfigHandler(patchReq);
    expect(patchRes.status).toBe(200);

    // Verify config was persisted
    const updatedCommission = await db.appConfig.findUnique({ where: { key: 'commissionPercent' } });
    expect(updatedCommission?.value).toBe('12');

    // Verify audit log
    const configAudit = await db.adminAuditLog.findFirst({
      where: { action: 'CONFIG_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(configAudit).toBeDefined();
  });

  it('fetches paginated audit logs filtered by action or admin', async () => {
    const req = new Request('http://localhost:3000/api/v1/admin/audit-log?limit=10', {
      headers: { Cookie: adminCookie },
    });
    const res = await getAuditLogHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(body.data.items[0].admin).toBeDefined();

    // Filter by action
    const filterReq = new Request('http://localhost:3000/api/v1/admin/audit-log?action=CONFIG_UPDATED', {
      headers: { Cookie: adminCookie },
    });
    const filterRes = await getAuditLogHandler(filterReq);
    expect(filterRes.status).toBe(200);
    const filterBody = await filterRes.json();
    expect(filterBody.data.items.every((item: any) => item.action === 'CONFIG_UPDATED')).toBe(true);
  });

  it('logs out admin and clears the session cookie', async () => {
    const origin = process.env.APP_URL || 'http://localhost:3000';
    const req = new Request('http://localhost:3000/api/v1/auth/admin/logout', {
      method: 'POST',
      headers: { Origin: origin },
    });
    const res = await adminLogoutHandler(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${ADMIN_COOKIE_NAME}=;`);
    expect(setCookie).toContain('Max-Age=0');
  });
});
