import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireApprovedHost } from '@/lib/auth';
import { validateBookingTransition } from '@/lib/booking-state';
import { AppError, NotFoundError, ForbiddenError } from '@/lib/errors';

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
      throw new ForbiddenError('Only the host can mark a booking as charging');
    }

    validateBookingTransition(booking.status, 'CHARGING');

    // Server-enforced start charging window
    const startWindowConfig = await db.appConfig.findUnique({
      where: { key: 'startWindowMinutes' },
    });
    const startWindowMinutes = startWindowConfig ? parseInt(startWindowConfig.value, 10) : 30;

    const now = new Date();
    const earliestAllowed = new Date(booking.startsAt.getTime() - startWindowMinutes * 60 * 1000);
    const latestAllowed = new Date(booking.endsAt.getTime());

    if (now < earliestAllowed) {
      throw new AppError(
        `Charging cannot start earlier than ${startWindowMinutes} minutes before scheduled start time`,
        400,
        'OUTSIDE_START_WINDOW'
      );
    }

    if (now > latestAllowed) {
      throw new AppError(
        'Charging cannot start after scheduled booking end time',
        400,
        'OUTSIDE_START_WINDOW'
      );
    }

    const updated = await db.booking.update({
      where: { id: booking.id },
      data: { status: 'CHARGING' },
    });

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      message: 'Charging session started',
    });
  } catch (err) {
    return apiError(err);
  }
}
