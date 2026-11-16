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

      if (user.isActive) {
        return { user, idempotent: true };
      }

      const updated = await tx.user.update({
        where: { id },
        data: { isActive: true },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'USER_ACTIVATED',
          targetType: 'User',
          targetId: id,
        },
      });

      return { user: updated, idempotent: false };
    });

    return apiSuccess({
      id: result.user.id,
      isActive: result.user.isActive,
      idempotent: result.idempotent,
      message: 'User account activated',
    });
  } catch (err) {
    return apiError(err);
  }
}
