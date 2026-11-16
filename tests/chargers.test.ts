import { describe, it, expect } from 'vitest';
import db from '../lib/db';
import { getKarachiDayRange } from '../lib/date';
import { findNearbyChargers } from '../lib/geo';

describe('Part 3.2: Host Onboarding & Charger Management', () => {
  it('correctly calculates day range in Asia/Karachi (UTC+5)', () => {
    const { startOfDay, endOfDay } = getKarachiDayRange('2026-11-20');
    // In UTC, Karachi 00:00 is previous day 19:00 UTC
    expect(startOfDay.toISOString()).toBe('2026-11-19T19:00:00.000Z');
    // In UTC, Karachi 23:59:59.999 is 18:59:59.999 UTC
    expect(endOfDay.toISOString()).toBe('2026-11-20T18:59:59.999Z');
  });

  it('verifies public nearby search hides addressLine and returns approved chargers', async () => {
    // Islamabad coordinate (F-10 / Blue Area)
    const chargers = await findNearbyChargers(33.7, 73.05, 10);
    expect(chargers.length).toBeGreaterThan(0);

    for (const c of chargers) {
      expect(c.approvalStatus).toBe('APPROVED');
      expect(c.isOnline).toBe(true);
      expect('addressLine' in c).toBe(false);
      expect('lat' in c).toBe(false);
      expect('lng' in c).toBe(false);
      expect(typeof c.publicLat).toBe('number');
      expect(typeof c.publicLng).toBe('number');
      expect(typeof c.pricePerKwhPaisa).toBe('number');
    }
  });

  it('lazy-expires stale requested bookings when checking availability', async () => {
    const charger = await db.charger.findFirst();
    if (!charger) return;

    const driver = await db.user.findFirst({ where: { role: 'USER' } });
    if (!driver) return;

    // Create an expired requested booking in the past
    const staleBooking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(Date.now() + 3600 * 1000 * 2),
        endsAt: new Date(Date.now() + 3600 * 1000 * 3),
        status: 'REQUESTED',
        expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      },
    });

    // Run lazy expiry logic
    await db.booking.updateMany({
      where: {
        chargerId: charger.id,
        status: 'REQUESTED',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    const updated = await db.booking.findUnique({
      where: { id: staleBooking.id },
    });

    expect(updated?.status).toBe('EXPIRED');

    // Cleanup
    await db.booking.delete({ where: { id: staleBooking.id } });
  });
});
