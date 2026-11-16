import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { UnauthorizedError } from '@/lib/errors';
import { dispatchPushNotification } from '@/lib/notifications';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedError('Unauthorized cron request');
    }

    const now = new Date();
    const staleBookings = await db.booking.findMany({
      where: {
        status: 'REQUESTED',
        expiresAt: { lt: now },
      },
      select: { id: true, driverId: true },
    });

    if (staleBookings.length > 0) {
      await db.booking.updateMany({
        where: {
          id: { in: staleBookings.map((b) => b.id) },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      for (const b of staleBookings) {
        dispatchPushNotification({
          userId: b.driverId,
          title: 'Booking Request Expired',
          body: 'Your booking request was not answered in time.',
          data: {
            type: 'BOOKING_EXPIRED',
            bookingId: b.id,
          },
        });
      }
    }

    return apiSuccess({
      message: 'Expired stale bookings job executed',
      expiredCount: staleBookings.length,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    return apiError(err);
  }
}
