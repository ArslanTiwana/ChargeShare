import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { resolveSupportMessageSchema } from '@/shared/src';
import { NotFoundError } from '@/lib/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminSession(request);
    const { id } = await params;
    const body = await request.json();
    const data = resolveSupportMessageSchema.parse(body);

    const message = await db.supportMessage.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundError('Support message not found');
    }

    const updated = await db.supportMessage.update({
      where: { id },
      data: {
        status: data.status,
      },
    });

    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'SUPPORT_MESSAGE_UPDATED',
        targetType: 'SupportMessage',
        targetId: id,
        metadata: {
          previousStatus: message.status,
          newStatus: data.status,
        },
      },
    });

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      message: `Support message marked as ${data.status.toLowerCase()}`,
    });
  } catch (err) {
    return apiError(err);
  }
}
