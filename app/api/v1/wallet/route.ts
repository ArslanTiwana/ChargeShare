import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getWalletBalance } from '@/lib/wallet';
import { paginationQuerySchema } from '@/shared/src';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const query = paginationQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const limit = query.limit;

    // 1. Compute exact balance from append-only ledger
    const balancePaisa = await getWalletBalance(user.id);

    // 2. Fetch paginated ledger transactions
    const transactions = await db.walletTransaction.findMany({
      where: {
        hostId: user.id,
        ...(query.cursor && { id: { lt: query.cursor } }), // Descending ID cursor
      },
      take: limit + 1,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        type: true,
        amountPaisa: true,
        bookingId: true,
        topupId: true,
        note: true,
        createdAt: true,
      },
    });

    const hasNextPage = transactions.length > limit;
    const items = hasNextPage ? transactions.slice(0, limit) : transactions;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return apiSuccess({
      hostId: user.id,
      balancePaisa,
      balanceRupees: (balancePaisa / 100).toFixed(2),
      transactions: items,
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
