import { describe, it, expect } from 'vitest';
import db from '../lib/db';
import { POST as registerRoute } from '../app/api/v1/auth/register/route';
import { GET as meGetRoute, PATCH as mePatchRoute } from '../app/api/v1/me/route';
import { POST as createChargerRoute } from '../app/api/v1/chargers/route';
import { signAccessToken } from '../lib/auth';

describe('preferredMode and Host Status Enforcement', () => {
  it('registers successfully with valid preferredMode DRIVER or HOST', async () => {
    const emailDriver = `driver_${Date.now()}@example.com`;
    const reqDriver = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailDriver,
        name: 'Test Driver',
        password: 'Password123!',
        preferredMode: 'DRIVER',
      }),
    });

    const resDriver = await registerRoute(reqDriver);
    expect(resDriver.status).toBe(201);

    const userInDb = await db.user.findUnique({ where: { email: emailDriver } });
    expect(userInDb?.preferredMode).toBe('DRIVER');

    const emailHost = `host_${Date.now()}@example.com`;
    const reqHost = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailHost,
        name: 'Test Host',
        password: 'Password123!',
        preferredMode: 'HOST',
      }),
    });

    const resHost = await registerRoute(reqHost);
    expect(resHost.status).toBe(201);

    const hostInDb = await db.user.findUnique({ where: { email: emailHost } });
    expect(hostInDb?.preferredMode).toBe('HOST');
    expect(hostInDb?.hostStatus).toBe('NONE'); // choosing HOST does NOT approve anything
  });

  it('rejects invalid preferredMode on register with 400', async () => {
    const req = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `invalid_${Date.now()}@example.com`,
        name: 'Invalid Mode',
        password: 'Password123!',
        preferredMode: 'ADMINISTRATOR',
      }),
    });

    const res = await registerRoute(req);
    expect([400, 422]).toContain(res.status);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns preferredMode in GET /me and allows updating via PATCH /me', async () => {
    const user = await db.user.create({
      data: {
        email: `me_pref_${Date.now()}@example.com`,
        name: 'Pref Test',
        passwordHash: 'fakehash',
        role: 'USER',
        hostStatus: 'NONE',
        preferredMode: 'DRIVER',
      },
    });

    const token = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: 'USER',
      hostStatus: 'NONE',
    });

    // GET /me
    const getReq = new Request('http://localhost:3000/api/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getRes = await meGetRoute(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.preferredMode).toBe('DRIVER');

    // PATCH /me to HOST
    const patchReq = new Request('http://localhost:3000/api/v1/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preferredMode: 'HOST' }),
    });
    const patchRes = await mePatchRoute(patchReq);
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.preferredMode).toBe('HOST');

    // PATCH /me to null (reset)
    const patchNullReq = new Request('http://localhost:3000/api/v1/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preferredMode: null }),
    });
    const patchNullRes = await mePatchRoute(patchNullReq);
    expect(patchNullRes.status).toBe(200);
    const patchNullBody = await patchNullRes.json();
    expect(patchNullBody.data.preferredMode).toBeNull();

    // PATCH /me with invalid preferredMode returns 400
    const patchInvalidReq = new Request('http://localhost:3000/api/v1/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preferredMode: 'SUPER_HOST' }),
    });
    const patchInvalidRes = await mePatchRoute(patchInvalidReq);
    expect([400, 422]).toContain(patchInvalidRes.status);
  });

  it('rejects host actions from users with preferredMode HOST if hostStatus is NONE, PENDING, or SUSPENDED', async () => {
    const statuses: Array<'NONE' | 'PENDING' | 'SUSPENDED'> = ['NONE', 'PENDING', 'SUSPENDED'];

    for (const status of statuses) {
      const user = await db.user.create({
        data: {
          email: `test_host_${status.toLowerCase()}_${Date.now()}@example.com`,
          name: `User ${status}`,
          passwordHash: 'fakehash',
          role: 'USER',
          hostStatus: status,
          preferredMode: 'HOST', // explicitly preferred HOST
        },
      });

      const token = await signAccessToken({
        userId: user.id,
        email: user.email,
        role: 'USER',
        hostStatus: status,
      });

      // Try creating a charger (host endpoint requiring approved host)
      const chargerReq = new Request('http://localhost:3000/api/v1/chargers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Unauthorized Host Charger',
          powerKw: 7.4,
          connectorType: 'TYPE2',
          pricePerKwhPaisa: 5000,
          areaLabel: 'F-7',
          addressLine: '123 Test St',
          meterInstalled: true,
          lat: 33.7,
          lng: 73.0,
        }),
      });

      const chargerRes = await createChargerRoute(chargerReq);
      expect(chargerRes.status).toBe(403);
      const errBody = await chargerRes.json();
      expect(errBody.error.code).toBe('FORBIDDEN');
    }
  });
});
