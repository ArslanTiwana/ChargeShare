import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { pushTokenRegisterSchema, pushTokenDeleteSchema } from '@/shared/src';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = pushTokenRegisterSchema.parse(body);

    const pushToken = await db.pushToken.upsert({
      where: { token: data.token },
      update: {
        userId: user.id,
        platform: data.platform,
        lastSeenAt: new Date(),
      },
      create: {
        userId: user.id,
        token: data.token,
        platform: data.platform,
      },
    });

    return apiSuccess(pushToken);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = pushTokenDeleteSchema.parse(body);

    await db.pushToken.deleteMany({
      where: {
        token: data.token,
        userId: user.id,
      },
    });

    return apiSuccess({ deleted: true });
  } catch (err) {
    return apiError(err);
  }
}
