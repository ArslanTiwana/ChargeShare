import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { rejectReasonSchema } from '@/shared/src';
import { dispatchPushNotification } from '@/lib/notifications';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminSession(request);
    const { id } = await params;
    const body = await request.json();
    const validated = rejectReasonSchema.parse(body);

    const result = await db.$transaction(async (tx) => {
      const topup = await tx.walletTopup.findUnique({
        where: { id },
      });

      if (!topup) {
        throw new NotFoundError('Top-up request not found');
      }

      // Idempotent: if already rejected, return early
      if (topup.status === 'REJECTED') {
        return { topup, idempotent: true };
      }

      // Update to REJECTED
      const updatedTopup = await tx.walletTopup.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      // Audit log
      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'TOPUP_REJECTED',
          targetType: 'WalletTopup',
          targetId: id,
          metadata: { reason: validated.reason },
        },
      });

      return { topup: updatedTopup, idempotent: false };
    });

    if (!result.idempotent) {
      dispatchPushNotification({
        userId: result.topup.hostId,
        title: 'Top-up Rejected',
        body: 'Your wallet top-up request has been rejected.',
        data: {
          type: 'TOPUP_REJECTED',
        },
      });
    }

    return apiSuccess({
      id: result.topup.id,
      status: result.topup.status,
      idempotent: result.idempotent,
      message: 'Top-up request rejected',
    });
  } catch (err) {
    return apiError(err);
  }
}
