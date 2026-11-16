import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedError('Unauthorized cron request');
    }

    const now = new Date();
    const result = await db.booking.updateMany({
      where: {
        status: 'REQUESTED',
        expiresAt: { lt: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return apiSuccess({
      message: 'Expired stale bookings job executed',
      expiredCount: result.count,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    return apiError(err);
  }
}
