import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { availabilityQuerySchema } from '@/shared/src';
import { getKarachiDayRange } from '@/lib/date';
import { NotFoundError } from '@/lib/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id: chargerId } = await params;
    const { searchParams } = new URL(request.url);

    const query = availabilityQuerySchema.parse({
      date: searchParams.get('date'),
    });

    const charger = await db.charger.findUnique({
      where: { id: chargerId },
    });

    if (!charger) {
      throw new NotFoundError('Charger not found');
    }

    const { startOfDay, endOfDay } = getKarachiDayRange(query.date);

    // Requirement 1: Lazy-expire requested bookings past expiresAt and persist to DB
    const now = new Date();
    await db.booking.updateMany({
      where: {
        chargerId,
        status: 'REQUESTED',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // Bookings that occupy a slot on this day: ACCEPTED, CHARGING, or active REQUESTED
    const busyBookings = await db.booking.findMany({
      where: {
        chargerId,
        status: { in: ['ACCEPTED', 'CHARGING', 'REQUESTED'] },
        startsAt: { lt: endOfDay },
        endsAt: { gt: startOfDay },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
      orderBy: { startsAt: 'asc' },
    });

    // Return booked intervals only (never reveal driver identity)
    return apiSuccess({
      chargerId,
      date: query.date,
      timezone: 'Asia/Karachi',
      bookedSlots: busyBookings.map((b) => ({
        bookingId: b.id,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        status: b.status,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}
