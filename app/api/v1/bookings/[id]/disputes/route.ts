import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createBookingDisputeSchema } from '@/shared/src';
import { validateBookingTransition } from '@/lib/booking-state';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';
import { dispatchPushNotification } from '@/lib/notifications';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: bookingId } = await params;
    const body = await request.json();
    const data = createBookingDisputeSchema.parse(body);

    const result = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { charger: true, dispute: true },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const isDriver = booking.driverId === user.id;
      const isHost = booking.charger.hostId === user.id;
      const isAdmin = user.role === 'ADMIN';

      if (!isDriver && !isHost && !isAdmin) {
        throw new ForbiddenError('Only the driver or host can open a dispute for this booking');
      }

      if (booking.dispute) {
        throw new AppError('A dispute has already been filed for this booking', 409, 'DISPUTE_EXISTS');
      }

      // Allowed after accepted (ACCEPTED, CHARGING, COMPLETED)
      const allowedStates = ['ACCEPTED', 'CHARGING', 'COMPLETED'];
      if (!allowedStates.includes(booking.status)) {
        throw new AppError(
          'Disputes can only be opened after a booking has been accepted and prior to confirmation',
          400,
          'INVALID_STATUS'
        );
      }

      // Move booking to DISPUTED
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'DISPUTED' },
      });

      // Create Dispute
      const dispute = await tx.dispute.create({
        data: {
          bookingId: booking.id,
          openedById: user.id,
          reason: data.reason,
          status: 'OPEN',
        },
      });

      const targetUserId = isDriver ? booking.charger.hostId : booking.driverId;

      return {
        disputeId: dispute.id,
        bookingId: booking.id,
        status: dispute.status,
        targetUserId,
        message: 'Dispute opened. Admin will review the case.',
      };
    });

    if (result.targetUserId) {
      dispatchPushNotification({
        userId: result.targetUserId,
        title: 'Dispute Opened',
        body: 'A dispute has been opened for your booking.',
        data: {
          type: 'DISPUTE_OPENED',
          bookingId: result.bookingId,
        },
      });
    }

    return apiSuccess({
      disputeId: result.disputeId,
      bookingId: result.bookingId,
      status: result.status,
      message: result.message,
    }, 201);
  } catch (err) {
    return apiError(err);
  }
}
