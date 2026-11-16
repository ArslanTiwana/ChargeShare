import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { disputeSessionSchema } from '@/shared/src';
import { validateBookingTransition } from '@/lib/booking-state';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: bookingId } = await params;
    const body = await request.json();
    const { reason } = disputeSessionSchema.parse(body);

    const result = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { dispute: true },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.driverId !== user.id && user.role !== 'ADMIN') {
        throw new ForbiddenError('Only the driver can dispute this session reading');
      }

      if (booking.dispute) {
        throw new AppError('A dispute has already been filed for this booking', 409, 'DISPUTE_EXISTS');
      }

      validateBookingTransition(booking.status, 'DISPUTED');

      // Create Dispute
      const dispute = await tx.dispute.create({
        data: {
          bookingId: booking.id,
          openedById: user.id,
          reason,
          status: 'OPEN',
        },
      });

      // Move booking to DISPUTED (No commission is charged)
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'DISPUTED' },
      });

      return {
        bookingId: booking.id,
        disputeId: dispute.id,
        status: 'DISPUTED',
        message: 'Dispute opened. Admin will review the readings and evidence.',
      };
    });

    return apiSuccess(result);
  } catch (err) {
    return apiError(err);
  }
}
