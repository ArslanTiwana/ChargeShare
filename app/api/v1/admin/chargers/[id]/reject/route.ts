import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { rejectReasonSchema } from '@/shared/src';
import { NotFoundError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminSession(request);
    const { id } = await params;
    const body = await request.json();
    const { reason } = rejectReasonSchema.parse(body);

    const result = await db.$transaction(async (tx) => {
      const charger = await tx.charger.findUnique({
        where: { id },
      });

      if (!charger) {
        throw new NotFoundError('Charger not found');
      }

      const updated = await tx.charger.update({
        where: { id },
        data: {
          approvalStatus: 'REJECTED',
          rejectionReason: reason,
          isOnline: false,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'CHARGER_REJECTED',
          targetType: 'Charger',
          targetId: id,
          metadata: { reason, previousStatus: charger.approvalStatus },
        },
      });

      return updated;
    });

    return apiSuccess({
      id: result.id,
      approvalStatus: result.approvalStatus,
      message: 'Charger rejected',
    });
  } catch (err) {
    return apiError(err);
  }
}
