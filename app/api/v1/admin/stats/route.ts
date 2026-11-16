import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const [
      userCount,
      hostsPending,
      chargersPending,
      bookingsByStatus,
      openDisputes,
      pendingTopups,
      commissionSum,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { hostStatus: 'PENDING' } }),
      db.charger.count({ where: { approvalStatus: 'PENDING' } }),
      db.booking.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      db.dispute.count({ where: { status: 'OPEN' } }),
      db.walletTopup.count({ where: { status: 'PENDING' } }),
      db.walletTransaction.aggregate({
        where: { type: 'COMMISSION' },
        _sum: { amountPaisa: true },
      }),
    ]);

    // Commissions in the ledger are negative deductions from host wallets
    const totalCommissionCollectedPaisa = Math.abs(commissionSum._sum.amountPaisa || 0);

    const bookingStatusCounts: Record<string, number> = {};
    for (const b of bookingsByStatus) {
      bookingStatusCounts[b.status] = b._count.id;
    }

    return apiSuccess({
      users: userCount,
      hostsPending,
      chargersPending,
      openDisputes,
      pendingTopups,
      totalCommissionCollectedPaisa,
      totalCommissionCollectedRupees: (totalCommissionCollectedPaisa / 100).toFixed(2),
      bookingsByStatus: bookingStatusCounts,
    });
  } catch (err) {
    return apiError(err);
  }
}
