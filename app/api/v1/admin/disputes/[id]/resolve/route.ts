import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { resolveDisputeSchema } from '@/shared/src';
import { dispatchPushNotification } from '@/lib/notifications';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminSession(request);
    const { id } = await params;
    const body = await request.json();
    const validated = resolveDisputeSchema.parse(body);

    const result = await db.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              charger: true,
              session: true,
            },
          },
        },
      });

      if (!dispute) {
        throw new NotFoundError('Dispute not found');
      }

      // Idempotency: if already resolved, return early
      if (dispute.status === 'RESOLVED') {
        return { dispute, idempotent: true };
      }

      // 1. Update dispute
      const updatedDispute = await tx.dispute.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolution: validated.resolution,
          resolvedById: admin.id,
        },
      });

      // 2. Update booking status to targetStatus ('CONFIRMED' or 'CANCELLED')
      await tx.booking.update({
        where: { id: dispute.bookingId },
        data: {
          status: validated.targetStatus,
        },
      });

      // 3. If targetStatus is CONFIRMED, create COMMISSION WalletTransaction if session exists and not already created
      if (validated.targetStatus === 'CONFIRMED' && dispute.booking.session) {
        const existingCommission = await tx.walletTransaction.findFirst({
          where: {
            bookingId: dispute.bookingId,
            type: 'COMMISSION',
          },
        });

        if (!existingCommission) {
          await tx.walletTransaction.create({
            data: {
              hostId: dispute.booking.charger.hostId,
              type: 'COMMISSION',
              amountPaisa: -dispute.booking.session.commissionPaisa,
              bookingId: dispute.booking.id,
              note: `Platform commission for booking ${dispute.booking.id} after dispute resolution`,
            },
          });
        }
      }

      // 4. If adjustmentPaisa is provided and non-zero, create ADJUSTMENT WalletTransaction
      if (validated.adjustmentPaisa !== undefined && validated.adjustmentPaisa !== 0) {
        await tx.walletTransaction.create({
          data: {
            hostId: dispute.booking.charger.hostId,
            type: 'ADJUSTMENT',
            amountPaisa: validated.adjustmentPaisa,
            bookingId: dispute.booking.id,
            note: validated.adjustmentNote || validated.resolution,
          },
        });
      }

      // 5. Admin audit log
      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'DISPUTE_RESOLVED',
          targetType: 'Dispute',
          targetId: dispute.id,
          metadata: {
            bookingId: dispute.bookingId,
            targetStatus: validated.targetStatus,
            resolution: validated.resolution,
            adjustmentPaisa: validated.adjustmentPaisa,
            adjustmentNote: validated.adjustmentNote,
          },
        },
      });

      return {
        dispute: updatedDispute,
        driverId: dispute.booking.driverId,
        hostId: dispute.booking.charger.hostId,
        bookingId: dispute.booking.id,
        idempotent: false,
      };
    });

    if (!result.idempotent) {
      const parties = [result.driverId, result.hostId].filter(Boolean) as string[];
      for (const userId of parties) {
        dispatchPushNotification({
          userId,
          title: 'Dispute Resolved',
          body: 'A dispute has been resolved by admin.',
          data: {
            type: 'DISPUTE_RESOLVED',
            bookingId: result.bookingId,
          },
        });
      }
    }

    return apiSuccess({
      id: result.dispute.id,
      status: result.dispute.status,
      idempotent: result.idempotent,
      message: 'Dispute resolved successfully',
    });
  } catch (err) {
    return apiError(err);
  }
}
