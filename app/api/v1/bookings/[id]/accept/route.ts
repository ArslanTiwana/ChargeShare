import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireApprovedHost } from '@/lib/auth';
import { getWalletBalance } from '@/lib/wallet';
import { validateBookingTransition } from '@/lib/booking-state';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';
import { Prisma } from '@prisma/client';
import { dispatchPushNotification } from '@/lib/notifications';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const host = await requireApprovedHost(request);
    const { id } = await params;

    const updatedBooking = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { charger: true },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.charger.hostId !== host.id && host.role !== 'ADMIN') {
        throw new ForbiddenError('Only the charger host can accept this booking');
      }

      // Check state machine transition
      validateBookingTransition(booking.status, 'ACCEPTED');

      const now = new Date();
      if (booking.expiresAt && booking.expiresAt < now) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'EXPIRED' },
        });
        throw new AppError('This booking request has expired', 400, 'REQUEST_EXPIRED');
      }

      // Per-charger advisory lock to prevent concurrent overlaps
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('charger_' || ${booking.chargerId}))`
      );

      // Re-check host wallet balance
      const hostBalance = await getWalletBalance(host.id);
      if (hostBalance <= 0) {
        throw new AppError('Cannot accept bookings with zero or negative wallet balance', 400, 'HOST_ZERO_BALANCE');
      }

      // Re-check overlap with accepted or charging bookings
      const overlap = await tx.booking.findFirst({
        where: {
          id: { not: booking.id },
          chargerId: booking.chargerId,
          status: { in: ['ACCEPTED', 'CHARGING'] },
          startsAt: { lt: booking.endsAt },
          endsAt: { gt: booking.startsAt },
        },
      });

      if (overlap) {
        throw new AppError('Cannot accept: overlapping confirmed booking already exists', 409, 'SLOT_OCCUPIED');
      }

      // Snapshot rate and accept
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'ACCEPTED',
          rateSnapshotPaisa: booking.charger.pricePerKwhPaisa,
        },
      });
    });

    dispatchPushNotification({
      userId: updatedBooking.driverId,
      title: 'Booking Accepted',
      body: 'Your booking request has been accepted.',
      data: {
        type: 'BOOKING_ACCEPTED',
        bookingId: updatedBooking.id,
      },
    });

    return apiSuccess({
      id: updatedBooking.id,
      status: updatedBooking.status,
      rateSnapshotPaisa: updatedBooking.rateSnapshotPaisa,
      message: 'Booking accepted successfully',
    });
  } catch (err) {
    return apiError(err);
  }
}
