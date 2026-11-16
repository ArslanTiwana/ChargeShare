import { BookingStatus } from '@/shared/src';
import { AppError } from './errors';
import db from './db';
import { Prisma } from '@prisma/client';

export class InvalidStateTransitionError extends AppError {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(
      `Invalid booking status transition from ${from} to ${to}`,
      400,
      'INVALID_TRANSITION'
    );
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Transition rules:
 * - REQUESTED -> ACCEPTED, DECLINED, CANCELLED, EXPIRED
 * - ACCEPTED  -> CHARGING, CANCELLED
 * - CHARGING  -> COMPLETED
 * - COMPLETED -> CONFIRMED, DISPUTED
 * - DISPUTED  -> CONFIRMED, CANCELLED (via admin resolution)
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  REQUESTED: ['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'],
  ACCEPTED: ['CHARGING', 'CANCELLED'],
  CHARGING: ['COMPLETED'],
  COMPLETED: ['CONFIRMED', 'DISPUTED'],
  CONFIRMED: [],
  DECLINED: [],
  CANCELLED: [],
  EXPIRED: [],
  DISPUTED: ['CONFIRMED', 'CANCELLED'],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function validateBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransitionBooking(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

/**
 * Validates and applies a booking transition in the database.
 */
export async function transitionBooking(
  bookingId: string,
  targetStatus: BookingStatus,
  extraData?: Prisma.BookingUpdateInput,
  tx?: Prisma.TransactionClient
): Promise<Prisma.BookingGetPayload<{}>> {
  const client = tx || db;

  const booking = await client.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'NOT_FOUND');
  }

  validateBookingTransition(booking.status, targetStatus);

  return client.booking.update({
    where: { id: bookingId },
    data: {
      status: targetStatus,
      ...extraData,
    },
  });
}

/**
 * Lazy expiry of requested bookings past their expiresAt timestamp.
 */
export async function lazyExpireBookings(chargerId?: string): Promise<number> {
  const now = new Date();
  const result = await db.booking.updateMany({
    where: {
      status: 'REQUESTED',
      expiresAt: { lt: now },
      ...(chargerId && { chargerId }),
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return result.count;
}
