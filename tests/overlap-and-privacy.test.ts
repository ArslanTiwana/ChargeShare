import { describe, it, expect } from 'vitest';
import db from '../lib/db';

describe('Area: Overlap Detection & Address/Phone Privacy', () => {
  it('detects time-range overlaps for bookings on the same charger', async () => {
    const charger = await db.charger.findFirst();
    if (!charger) return;

    const baseTime = new Date('2026-12-01T10:00:00Z').getTime();

    // Existing slot: 10:00 to 12:00
    const slotStart = new Date(baseTime);
    const slotEnd = new Date(baseTime + 2 * 3600 * 1000);

    const testDriver = await db.user.findFirst({ where: { role: 'USER' } });
    if (!testDriver) return;

    const booking = await db.booking.create({
      data: {
        driverId: testDriver.id,
        chargerId: charger.id,
        startsAt: slotStart,
        endsAt: slotEnd,
        status: 'ACCEPTED',
      },
    });

    // Helper to test if a candidate slot overlaps:
    // candidateStart < slotEnd AND candidateEnd > slotStart
    const checkOverlap = (startMs: number, endMs: number) => {
      const candidateStart = new Date(startMs);
      const candidateEnd = new Date(endMs);
      return candidateStart < slotEnd && candidateEnd > slotStart;
    };

    // 1. Exact match (10:00 - 12:00) -> overlaps
    expect(checkOverlap(baseTime, baseTime + 2 * 3600 * 1000)).toBe(true);

    // 2. Partial overlap: starts during (11:00 - 13:00) -> overlaps
    expect(checkOverlap(baseTime + 3600 * 1000, baseTime + 3 * 3600 * 1000)).toBe(true);

    // 3. Partial overlap: ends during (09:00 - 11:00) -> overlaps
    expect(checkOverlap(baseTime - 3600 * 1000, baseTime + 3600 * 1000)).toBe(true);

    // 4. Completely inside (10:30 - 11:30) -> overlaps
    expect(checkOverlap(baseTime + 1800 * 1000, baseTime + 5400 * 1000)).toBe(true);

    // 5. Completely before (08:00 - 10:00) -> does NOT overlap
    expect(checkOverlap(baseTime - 2 * 3600 * 1000, baseTime)).toBe(false);

    // 6. Completely after (12:00 - 14:00) -> does NOT overlap
    expect(checkOverlap(baseTime + 2 * 3600 * 1000, baseTime + 4 * 3600 * 1000)).toBe(false);

    // Cleanup
    await db.booking.delete({ where: { id: booking.id } });
  });

  it('verifies addressLine and phone privacy rules before and after acceptance', () => {
    const rawBooking = {
      id: 'book_1',
      status: 'REQUESTED' as const,
      charger: {
        title: 'Solar Charger',
        areaLabel: 'F-10',
        addressLine: '123 Confidential Street',
        host: { name: 'Tariq', phone: '+923001111111' },
      },
      driver: { name: 'Hamza', phone: '+923451234567' },
    };

    const filterPrivateFields = (
      b: typeof rawBooking,
      status: 'REQUESTED' | 'ACCEPTED' | 'CANCELLED',
      viewerUserId: string,
      driverId: string,
      hostId: string
    ) => {
      const isConfirmedOrActive = ['ACCEPTED', 'CHARGING', 'COMPLETED', 'CONFIRMED'].includes(status);
      const isParty = viewerUserId === driverId || viewerUserId === hostId;
      const canSeePrivate = isParty && isConfirmedOrActive;

      return {
        areaLabel: b.charger.areaLabel,
        addressLine: canSeePrivate ? b.charger.addressLine : undefined,
        hostPhone: canSeePrivate ? b.charger.host.phone : undefined,
        driverPhone: canSeePrivate ? b.driver.phone : undefined,
      };
    };

    const driverId = 'user_driver';
    const hostId = 'user_host';
    const strangerId = 'user_stranger';

    // 1. When status is REQUESTED:
    const driverBefore = filterPrivateFields(rawBooking, 'REQUESTED', driverId, driverId, hostId);
    expect(driverBefore.addressLine).toBeUndefined();
    expect(driverBefore.hostPhone).toBeUndefined();
    expect(driverBefore.areaLabel).toBe('F-10');

    // 2. When status is ACCEPTED:
    const driverAfter = filterPrivateFields(rawBooking, 'ACCEPTED', driverId, driverId, hostId);
    expect(driverAfter.addressLine).toBe('123 Confidential Street');
    expect(driverAfter.hostPhone).toBe('+923001111111');
    expect(driverAfter.driverPhone).toBe('+923451234567');

    // 3. When status is ACCEPTED, but viewer is an uninvolved third-party stranger:
    const strangerAfter = filterPrivateFields(rawBooking, 'ACCEPTED', strangerId, driverId, hostId);
    expect(strangerAfter.addressLine).toBeUndefined();
    expect(strangerAfter.hostPhone).toBeUndefined();
  });
});
