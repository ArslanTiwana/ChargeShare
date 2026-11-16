import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminSession(request);
    const { id } = await params;

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const updated = await tx.user.update({
        where: { id },
        data: { hostStatus: 'SUSPENDED' },
      });

      // Also set chargers offline
      await tx.charger.updateMany({
        where: { hostId: id },
        data: { isOnline: false },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'HOST_SUSPENDED',
          targetType: 'User',
          targetId: id,
          metadata: { previousStatus: user.hostStatus },
        },
      });

      return updated;
    });

    return apiSuccess({
      id: result.id,
      hostStatus: result.hostStatus,
      message: 'Host suspended and chargers placed offline',
    });
  } catch (err) {
    return apiError(err);
  }
}
