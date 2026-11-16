import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { GET as publicConfigRoute } from '../app/api/v1/config/public/route';
import { GET as meGetRoute } from '../app/api/v1/me/route';
import { signAccessToken } from '../lib/auth';

describe('Commission Percent Security & Access Control', () => {
  let approvedHostToken: string;
  let regularDriverToken: string;

  beforeAll(async () => {
    const hostUser = await db.user.create({
      data: {
        email: `apphost_${Date.now()}@example.com`,
        name: 'Approved Host',
        hostStatus: 'APPROVED',
        isActive: true,
      },
    });
    approvedHostToken = await signAccessToken({
      userId: hostUser.id,
      email: hostUser.email,
      role: hostUser.role,
    });

    const driverUser = await db.user.create({
      data: {
        email: `driveruser_${Date.now()}@example.com`,
        name: 'Regular Driver',
        hostStatus: 'NONE',
        isActive: true,
      },
    });
    regularDriverToken = await signAccessToken({
      userId: driverUser.id,
      email: driverUser.email,
      role: driverUser.role,
    });
  });

  it('proves commissionPercent is NOT present in /api/v1/config/public', async () => {
    const res = await publicConfigRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.commissionPercent).toBeUndefined();
    expect(body.data.topupInstructions).toBeDefined();
    expect(body.data.hostMinWalletWarningPaisa).toBeDefined();
  });

  it('proves commissionPercent IS returned by /api/v1/me for APPROVED hosts', async () => {
    const req = new Request('http://localhost:3000/api/v1/me', {
      headers: { Authorization: `Bearer ${approvedHostToken}` },
    });
    const res = await meGetRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.commissionPercent).toBeDefined();
    expect(typeof body.data.commissionPercent).toBe('number');
    expect(body.data.commissionPercent).toBeGreaterThan(0);
  });

  it('proves commissionPercent is NOT returned by /api/v1/me for non-approved users (drivers)', async () => {
    const req = new Request('http://localhost:3000/api/v1/me', {
      headers: { Authorization: `Bearer ${regularDriverToken}` },
    });
    const res = await meGetRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.commissionPercent).toBeUndefined();
  });
});
