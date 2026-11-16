import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { readUrlQuerySchema } from '@/shared/src';
import { getPresignedReadUrl } from '@/lib/storage';
import { ForbiddenError } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const { key } = readUrlQuerySchema.parse({
      key: searchParams.get('key'),
    });

    let isAuthorized = false;

    // 1. Admin is always authorized
    if (user.role === 'ADMIN') {
      isAuthorized = true;
    }

    // 2. Direct owner check (key format: purpose/userId/randomId.ext)
    const keyParts = key.split('/');
    if (keyParts.length >= 2 && keyParts[1] === user.id) {
      isAuthorized = true;
    }

    // 3. If it's a meter photo on a booking session, the other party is also authorized
    if (!isAuthorized) {
      const session = await db.session.findFirst({
        where: {
          OR: [
            { meterStartPhotoKey: key },
            { meterEndPhotoKey: key },
          ],
        },
        include: {
          booking: {
            include: { charger: true },
          },
        },
      });

      if (session) {
        const isDriver = session.booking.driverId === user.id;
        const isHost = session.booking.charger.hostId === user.id;
        if (isDriver || isHost) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenError('You do not have authorization to access this file');
    }

    const readUrl = await getPresignedReadUrl(key, 900);

    return apiSuccess({
      key,
      readUrl,
      expiresInSeconds: 900,
    });
  } catch (err) {
    return apiError(err);
  }
}
