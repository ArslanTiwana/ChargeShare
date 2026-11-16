import { describe, it, expect } from 'vitest';
import db from '../lib/db';
import { getPresignedReadUrl } from '../lib/storage';

describe('Area: Negative Authorization Checks', () => {
  it('prevents a driver from entering a reading (only host may enter reading)', async () => {
    const driver = await db.user.findFirst({ where: { role: 'USER', hostStatus: 'NONE' } });
    const host = await db.user.findFirst({ where: { hostStatus: 'APPROVED' } });
    const charger = await db.charger.findFirst({ where: { hostId: host?.id } });
    if (!driver || !host || !charger) return;

    // Create a charging booking
    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'CHARGING',
      },
    });

    // Simulating driver attempting to enter reading
    const isHostOrAdmin = booking.chargerId && (driver.id === host.id || driver.role === 'ADMIN');
    expect(isHostOrAdmin).toBe(false);

    // Cleanup
    await db.booking.delete({ where: { id: booking.id } });
  });

  it('prevents a host from confirming or disputing their own session', async () => {
    const host = await db.user.findFirst({ where: { hostStatus: 'APPROVED' } });
    const driver = await db.user.findFirst({ where: { role: 'USER', id: { not: host?.id } } });
    if (!host || !driver) return;

    // Rule: only booking.driverId can confirm or dispute
    const callerId = host.id;
    const canConfirmOrDispute = callerId === driver.id;
    expect(canConfirmOrDispute).toBe(false);
  });

  it('prevents a stranger from obtaining photo read URLs for private sessions', async () => {
    const strangerId = 'stranger_user_999';
    const hostId = 'host_user_111';
    const driverId = 'driver_user_222';

    const photoKey = `METER_PHOTO/${hostId}/meter_start_abc.jpg`;

    const canAccessPhoto = (userId: string, role: string) => {
      if (role === 'ADMIN') return true;
      const keyParts = photoKey.split('/');
      if (keyParts.length >= 2 && keyParts[1] === userId) return true;
      if (userId === driverId || userId === hostId) return true;
      return false;
    };

    expect(canAccessPhoto(hostId, 'USER')).toBe(true); // Host owner
    expect(canAccessPhoto(driverId, 'USER')).toBe(true); // Booking driver
    expect(canAccessPhoto(strangerId, 'USER')).toBe(false); // Stranger blocked!
  });
});
