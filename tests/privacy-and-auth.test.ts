import { describe, it, expect } from 'vitest';
import db from '../lib/db';
import { requireAuth, requireRole, requireApprovedHost } from '../lib/auth';
import { ForbiddenError } from '../lib/errors';

describe('Area: Authorization & Access Control', () => {
  it('rejects access if bearer token is missing or malformed', async () => {
    const req = new Request('http://localhost:3000/api/v1/me');
    await expect(requireAuth(req)).rejects.toThrow(/Missing or malformed Authorization header/);
  });

  it('rejects non-admin users from admin-required operations', async () => {
    // Find regular user
    const user = await db.user.findFirst({ where: { role: 'USER' } });
    if (!user) return;

    // Simulate token for user
    const { signAccessToken } = await import('../lib/auth');
    const token = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: 'USER',
      hostStatus: user.hostStatus,
    });

    const req = new Request('http://localhost:3000/api/v1/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(requireRole(req, 'ADMIN')).rejects.toThrow(ForbiddenError);
  });

  it('rejects non-approved hosts from host-only operations', async () => {
    const regularUser = await db.user.findFirst({ where: { hostStatus: 'NONE' } });
    if (!regularUser) return;

    const { signAccessToken } = await import('../lib/auth');
    const token = await signAccessToken({
      userId: regularUser.id,
      email: regularUser.email,
      role: 'USER',
      hostStatus: 'NONE',
    });

    const req = new Request('http://localhost:3000/api/v1/chargers', {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(requireApprovedHost(req)).rejects.toThrow(/requires an approved host account/);
  });
});
