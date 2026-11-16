import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireApprovedHost } from '@/lib/auth';
import { validateBookingTransition } from '@/lib/booking-state';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const host = await requireApprovedHost(request);
    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id },
      include: { charger: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.charger.hostId !== host.id && host.role !== 'ADMIN') {
      throw new ForbiddenError('Only the charger host can decline this booking');
    }

    validateBookingTransition(booking.status, 'DECLINED');

    const updated = await db.booking.update({
      where: { id: booking.id },
      data: { status: 'DECLINED' },
    });

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      message: 'Booking declined',
    });
  } catch (err) {
    return apiError(err);
  }
}
