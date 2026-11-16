import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { cancelBookingSchema } from '@/shared/src';
import { validateBookingTransition } from '@/lib/booking-state';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { reason } = cancelBookingSchema.parse(body);

    const booking = await db.booking.findUnique({
      where: { id },
      include: { charger: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isDriver = booking.driverId === user.id;
    const isHost = booking.charger.hostId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isDriver && !isHost && !isAdmin) {
      throw new ForbiddenError('You can only cancel your own bookings');
    }

    validateBookingTransition(booking.status, 'CANCELLED');

    const prefix = isDriver ? 'Driver: ' : isHost ? 'Host: ' : 'Admin: ';
    const fullReason = `${prefix}${reason}`;

    const updated = await db.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancelReason: fullReason,
        cancelledById: user.id,
      },
    });

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      cancelReason: updated.cancelReason,
      message: 'Booking cancelled successfully',
    });
  } catch (err) {
    return apiError(err);
  }
}
