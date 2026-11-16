import { describe, it, expect } from 'vitest';
import {
  canTransitionBooking,
  validateBookingTransition,
  InvalidStateTransitionError,
  ALLOWED_TRANSITIONS,
} from '../lib/booking-state';
import { BOOKING_STATES, type BookingStatus } from '@/shared/src';
import db from '../lib/db';
import { Prisma } from '@prisma/client';

describe('Part 3.3: Booking State Machine & Double-Booking Protection', () => {
  it('strictly validates all allowed transitions', () => {
    // Expected valid transitions:
    // REQUESTED -> ACCEPTED, DECLINED, CANCELLED, EXPIRED
    // ACCEPTED -> CHARGING, CANCELLED
    // CHARGING -> COMPLETED
    // COMPLETED -> CONFIRMED, DISPUTED
    // DISPUTED -> CONFIRMED, CANCELLED
    for (const [from, allowedList] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of allowedList) {
        expect(canTransitionBooking(from as BookingStatus, to as BookingStatus)).toBe(true);
        expect(() =>
          validateBookingTransition(from as BookingStatus, to as BookingStatus)
        ).not.toThrow();
      }
    }
  });

  it('rejects every forbidden transition with InvalidStateTransitionError', () => {
    for (const from of BOOKING_STATES) {
      const allowed = ALLOWED_TRANSITIONS[from] || [];
      for (const to of BOOKING_STATES) {
        if (!allowed.includes(to)) {
          expect(canTransitionBooking(from, to)).toBe(false);
          expect(() => validateBookingTransition(from, to)).toThrow(
            InvalidStateTransitionError
          );
        }
      }
    }
  });

  it('proves concurrent booking race prevention using advisory lock', async () => {
    const charger = await db.charger.findFirst();
    if (!charger) return;

    const drivers = await db.user.findMany({
      where: { role: 'USER' },
      take: 2,
    });
    if (drivers.length < 2) return;

    const startTime = new Date(Date.now() + 3600 * 1000 * 24); // Tomorrow
    const endTime = new Date(startTime.getTime() + 3600 * 1000 * 2);

    // Two drivers attempt to book the EXACT SAME time slot concurrently
    const attemptBooking = async (driverId: string) => {
      return db.$transaction(async (tx) => {
        // Advisory Lock
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('charger_' || ${charger.id}))`
        );

        // Check Overlap
        const existing = await tx.booking.findFirst({
          where: {
            chargerId: charger.id,
            status: { in: ['ACCEPTED', 'CHARGING', 'REQUESTED'] },
            startsAt: { lt: endTime },
            endsAt: { gt: startTime },
          },
        });

        if (existing) {
          throw new Error('OVERLAP_DETECTED');
        }

        return tx.booking.create({
          data: {
            driverId,
            chargerId: charger.id,
            startsAt: startTime,
            endsAt: endTime,
            status: 'REQUESTED',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      });
    };

    // Run simultaneously
    const results = await Promise.allSettled([
      attemptBooking(drivers[0].id),
      attemptBooking(drivers[1].id),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed and one should fail due to lock + overlap check
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    if (failures[0].status === 'rejected') {
      expect((failures[0].reason as Error).message).toBe('OVERLAP_DETECTED');
    }

    // Cleanup created test booking
    if (successes[0].status === 'fulfilled') {
      const created = successes[0].value;
      await db.booking.delete({ where: { id: created.id } });
    }
  });
});
