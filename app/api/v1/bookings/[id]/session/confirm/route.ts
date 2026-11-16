import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateBookingTransition } from '@/lib/booking-state';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';
import { getWalletBalance } from '@/lib/wallet';
import { dispatchPushNotification } from '@/lib/notifications';

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
        hostId: booking.charger.hostId,
        status: 'CONFIRMED',
        commissionDeductedPaisa: booking.session.commissionPaisa,
        idempotent: false,
        message: 'Charging session confirmed. Commission deducted from host wallet.',
      };
    });

    if (!result.idempotent && result.hostId) {
      dispatchPushNotification({
        userId: result.hostId,
        title: 'Session Confirmed',
        body: 'Driver has confirmed the charging session.',
        data: {
          type: 'SESSION_CONFIRMED',
          bookingId: result.bookingId,
        },
      });

      // Check wallet warning threshold
      try {
        const warningConfig = await db.appConfig.findUnique({
          where: { key: 'hostMinWalletWarningPaisa' },
        });
        const threshold = warningConfig ? parseInt(warningConfig.value, 10) : 50000;
        const currentBalance = await getWalletBalance(result.hostId);
        if (currentBalance < threshold) {
          dispatchPushNotification({
            userId: result.hostId,
            title: 'Low Wallet Balance',
            body: 'Your wallet balance is low. Please top up to keep receiving bookings.',
            data: {
              type: 'WALLET_LOW_BALANCE',
            },
          });
        }
      } catch (err) {
        console.error('Failed to check wallet balance warning:', err);
      }
    }

    return apiSuccess(result);
  } catch (err) {
    return apiError(err);
  }
}
