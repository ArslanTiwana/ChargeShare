import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { hostApplySchema } from '@/shared/src';
import { AppError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = hostApplySchema.parse(body);

    const nameToSet = data.name || user.name;
    const phoneToSet = data.phone || user.phone;

    if (!nameToSet || !phoneToSet) {
      throw new AppError('Host application requires name and phone to be provided', 400, 'MISSING_FIELDS');
    }

    if (user.hostStatus === 'APPROVED') {
      throw new AppError('You are already an approved host', 400, 'ALREADY_APPROVED');
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        name: nameToSet,
        phone: phoneToSet,
        hostStatus: 'PENDING',
      },
    });

    return apiSuccess({
      message: 'Host application submitted successfully and is pending admin review.',
      hostStatus: updatedUser.hostStatus,
    });
  } catch (err) {
    return apiError(err);
  }
}
