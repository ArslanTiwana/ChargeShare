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
      const topup = await tx.walletTopup.findUnique({
        where: { id },
      });

      if (!topup) {
        throw new NotFoundError('Top-up request not found');
      }

      // Idempotent: if already approved, return early
      if (topup.status === 'APPROVED') {
        return { topup, idempotent: true };
      }

      // 1. Mark approved
      const updatedTopup = await tx.walletTopup.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      // 2. Create TOPUP WalletTransaction (positive paisa)
      // Enforced single transaction per topup by partial unique index
      await tx.walletTransaction.create({
        data: {
          hostId: topup.hostId,
          type: 'TOPUP',
          amountPaisa: topup.amountPaisa,
          topupId: topup.id,
          note: `Admin approved top-up reference ${topup.reference || topup.id}`,
        },
      });

      // 3. Record AdminAuditLog
      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'TOPUP_APPROVED',
          targetType: 'WalletTopup',
          targetId: id,
          metadata: { amountPaisa: topup.amountPaisa },
        },
      });

      return { topup: updatedTopup, idempotent: false };
    });

    if (!result.idempotent) {
      dispatchPushNotification({
        userId: result.topup.hostId,
        title: 'Top-up Approved',
        body: 'Your wallet top-up request has been approved.',
        data: {
          type: 'TOPUP_APPROVED',
        },
      });
    }

    return apiSuccess({
      id: result.topup.id,
      status: result.topup.status,
      idempotent: result.idempotent,
      message: 'Top-up approved and credited to host wallet',
    });
  } catch (err) {
    return apiError(err);
  }
}
