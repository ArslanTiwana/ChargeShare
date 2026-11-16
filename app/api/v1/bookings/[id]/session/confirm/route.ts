import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateBookingTransition } from '@/lib/booking-state';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: bookingId } = await params;

    const result = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          charger: true,
          session: true,
        },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.driverId !== user.id && user.role !== 'ADMIN') {
        throw new ForbiddenError('Only the driver can confirm the charging session');
      }

      if (!booking.session) {
        throw new AppError('No meter session found for this booking', 400, 'NO_SESSION');
      }

      // Idempotency check: if already confirmed, do not charge again
      if (booking.status === 'CONFIRMED') {
        return {
          bookingId: booking.id,
          status: 'CONFIRMED',
          idempotent: true,
          message: 'Session has already been confirmed',
        };
      }

      validateBookingTransition(booking.status, 'CONFIRMED');

      // 1. Update session driverConfirmedAt
      await tx.session.update({
        where: { id: booking.session.id },
        data: { driverConfirmedAt: new Date() },
      });

      // 2. Move booking to CONFIRMED
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED' },
      });

      // 3. Create COMMISSION WalletTransaction (negative paisa)
      // Guaranteed single commission per booking by unique partial index
      await tx.walletTransaction.create({
        data: {
          hostId: booking.charger.hostId,
          type: 'COMMISSION',
          amountPaisa: -booking.session.commissionPaisa,
          bookingId: booking.id,
          note: `Platform commission for booking ${booking.id}`,
        },
      });

      return {
        bookingId: booking.id,
        status: 'CONFIRMED',
        commissionDeductedPaisa: booking.session.commissionPaisa,
        idempotent: false,
        message: 'Charging session confirmed. Commission deducted from host wallet.',
      };
    });

    return apiSuccess(result);
  } catch (err) {
    return apiError(err);
  }
}
