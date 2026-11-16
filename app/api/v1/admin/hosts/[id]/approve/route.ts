import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { dispatchPushNotification } from '@/lib/notifications';

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
        data: { hostStatus: 'APPROVED' },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'HOST_APPROVED',
          targetType: 'User',
          targetId: id,
          metadata: { previousStatus: user.hostStatus },
        },
      });

      return updated;
    });

    dispatchPushNotification({
      userId: result.id,
      title: 'Host Application Approved',
      body: 'Your host application has been approved. You can now list chargers.',
      data: {
        type: 'HOST_APPROVED',
      },
    });

    return apiSuccess({
      id: result.id,
      hostStatus: result.hostStatus,
      message: 'Host approved successfully',
    });
  } catch (err) {
    return apiError(err);
  }
}
