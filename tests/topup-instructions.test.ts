import { describe, it, expect, beforeAll } from 'vitest';
import db from '../lib/db';
import { PATCH as updateConfigRoute } from '../app/api/v1/admin/config/route';
import { GET as getPublicConfigRoute } from '../app/api/v1/config/public/route';
import { signAdminSessionToken, ADMIN_COOKIE_NAME } from '../lib/auth';

describe('Topup Instructions Validation and Public Config', () => {
  let adminCookie: string;

  beforeAll(async () => {
    const admin = await db.user.create({
      data: {
        email: `topup_admin_${Date.now()}@example.com`,
        name: 'Topup Admin',
        role: 'ADMIN',
        isActive: true,
      },
    });
    const adminToken = await signAdminSessionToken(admin);
    adminCookie = `${ADMIN_COOKIE_NAME}=${adminToken}`;
  });

  it('rejects topupInstructions exceeding 1000 characters with validation error', async () => {
    const tooLongText = 'A'.repeat(1001);

    const req = new Request('http://localhost:3000/api/v1/admin/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        topupInstructions: tooLongText,
      }),
    });

    const res = await updateConfigRoute(req);
    expect([400, 422]).toContain(res.status);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('accepts topupInstructions within 1000 characters and updates public config', async () => {
    const validInstructions = 'Transfer funds via Easypaisa or JazzCash to Account 0300-9998877. Title: ChargeShare Official.';

    const req = new Request('http://localhost:3000/api/v1/admin/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        topupInstructions: validInstructions,
      }),
    });

    const patchRes = await updateConfigRoute(req);
    expect(patchRes.status).toBe(200);

    const publicRes = await getPublicConfigRoute();
    expect(publicRes.status).toBe(200);
    const publicBody = await publicRes.json();
    expect(publicBody.data.topupInstructions).toBe(validInstructions);
  });
});
