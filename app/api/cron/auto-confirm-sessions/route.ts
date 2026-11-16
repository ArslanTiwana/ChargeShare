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

    // Read autoConfirmHours from AppConfig
    const config = await db.appConfig.findUnique({
      where: { key: 'autoConfirmHours' },
    });
    const autoConfirmHours = config ? parseInt(config.value, 10) : 24;
    const thresholdDate = new Date(Date.now() - autoConfirmHours * 3600 * 1000);

    const eligibleBookings = await db.booking.findMany({
      where: {
        status: 'COMPLETED',
        session: {
          hostEnteredAt: { lt: thresholdDate },
          driverConfirmedAt: null,
        },
      },
      include: {
        charger: true,
        session: true,
      },
    });

    let autoConfirmedCount = 0;

    for (const booking of eligibleBookings) {
      if (!booking.session) continue;

      await db.$transaction(async (tx) => {
        // Double check status inside transaction
        const current = await tx.booking.findUnique({
          where: { id: booking.id },
          include: { session: true },
        });

        if (current?.status !== 'COMPLETED' || !current.session) return;

        // 1. Update session
        await tx.session.update({
          where: { id: current.session.id },
          data: {
            driverConfirmedAt: new Date(),
            autoConfirmed: true,
          },
        });

        // 2. Move to CONFIRMED
        await tx.booking.update({
          where: { id: current.id },
          data: { status: 'CONFIRMED' },
        });

        // 3. Deduct commission
        await tx.walletTransaction.create({
          data: {
            hostId: booking.charger.hostId,
            type: 'COMMISSION',
            amountPaisa: -current.session.commissionPaisa,
            bookingId: current.id,
            note: `Auto-confirmed platform commission for booking ${current.id}`,
          },
        });

        autoConfirmedCount += 1;
      });

      dispatchPushNotification({
        userId: booking.charger.hostId,
        title: 'Session Auto-Confirmed',
        body: 'Charging session was auto-confirmed.',
        data: {
          type: 'SESSION_AUTO_CONFIRMED',
          bookingId: booking.id,
        },
      });
    }

    return apiSuccess({
      message: 'Auto-confirm cron job executed',
      autoConfirmedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return apiError(err);
  }
}
