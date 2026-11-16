import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { UnauthorizedError } from '@/lib/errors';
import { deleteObject } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedError('Unauthorized cron request');
    }

    const config = await db.appConfig.findUnique({
      where: { key: 'photoRetentionDays' },
    });
    const photoRetentionDays = config ? parseInt(config.value, 10) : 180;
    const cutoffDate = new Date(Date.now() - photoRetentionDays * 24 * 3600 * 1000);

    // Find sessions older than retention cutoff with existing photo keys
    const expiredSessions = await db.session.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        OR: [
          { meterStartPhotoKey: { not: null } },
          { meterEndPhotoKey: { not: null } },
        ],
      },
      select: {
        id: true,
        meterStartPhotoKey: true,
        meterEndPhotoKey: true,
      },
    });

    let cleanedCount = 0;

    for (const session of expiredSessions) {
      if (session.meterStartPhotoKey) {
        await deleteObject(session.meterStartPhotoKey);
      }
      if (session.meterEndPhotoKey) {
        await deleteObject(session.meterEndPhotoKey);
      }

      await db.session.update({
        where: { id: session.id },
        data: {
          meterStartPhotoKey: null,
          meterEndPhotoKey: null,
        },
      });

      cleanedCount++;
    }

    return apiSuccess({
      message: 'Expired photos cleanup job executed',
      retentionDays: photoRetentionDays,
      cleanedSessionsCount: cleanedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return apiError(err);
  }
}
