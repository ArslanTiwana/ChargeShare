import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { POST as createSupportMessage } from '@/app/api/v1/support/route';
import { GET as listSupportMessages } from '@/app/api/v1/admin/support/route';
import { PATCH as updateSupportMessage } from '@/app/api/v1/admin/support/[id]/route';
import { signAccessToken, signAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/auth';

describe('Support System & Admin Desk', () => {
  let user: any;
  let admin: any;
  let userAuthToken: string;
  let adminCookie: string;

  beforeEach(async () => {
    const timestamp = Date.now();
    user = await db.user.create({
      data: {
        email: `suppuser_${timestamp}@test.com`,
        name: 'Support User',
        role: 'USER',
        hostStatus: 'NONE',
        isActive: true,
      },
    });

    admin = await db.user.create({
      data: {
        email: `suppadmin_${timestamp}@test.com`,
        name: 'Support Admin',
        role: 'ADMIN',
        hostStatus: 'NONE',
        isActive: true,
      },
    });

    userAuthToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: 'USER',
      hostStatus: 'NONE',
    });

    const token = await signAdminSessionToken(admin);
    adminCookie = `${ADMIN_COOKIE_NAME}=${token}`;
  });

  it('allows authenticated users to submit a support inquiry', async () => {
    const req = new Request('http://localhost:3000/api/v1/support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuthToken}`,
      },
      body: JSON.stringify({
        email: user.email,
        subject: 'Need help with charger listing',
        message: 'I have a 22kW Type 2 charger and need assistance setting the rate.',
      }),
    });

    const res = await createSupportMessage(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.status).toBe('OPEN');

    const inDb = await db.supportMessage.findUnique({ where: { id: data.data.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.userId).toBe(user.id);
  });

  it('allows admin to list and resolve support messages', async () => {
    const msg = await db.supportMessage.create({
      data: {
        userId: user.id,
        subject: 'Billing inquiry',
        message: 'Where can I see my receipt?',
        status: 'OPEN',
      },
    });

    // 1. List
    const listReq = new Request('http://localhost:3000/api/v1/admin/support?status=OPEN', {
      headers: {
        Cookie: adminCookie,
      },
    });

    const listRes = await listSupportMessages(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const found = listData.data.items.find((item: any) => item.id === msg.id);
    expect(found).toBeDefined();
    expect(found.subject).toBe('Billing inquiry');

    // 2. Resolve
    const patchReq = new Request(`http://localhost:3000/api/v1/admin/support/${msg.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        status: 'RESOLVED',
      }),
    });

    const patchRes = await updateSupportMessage(patchReq, {
      params: Promise.resolve({ id: msg.id }),
    });
    expect(patchRes.status).toBe(200);

    const updated = await db.supportMessage.findUnique({ where: { id: msg.id } });
    expect(updated?.status).toBe('RESOLVED');
  });
});
