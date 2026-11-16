import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { paginationQuerySchema, approvalStatusSchema } from '@/shared/src';
import { getPresignedReadUrl } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);
    const { searchParams } = new URL(request.url);

    const query = paginationQuerySchema.extend({
      status: approvalStatusSchema.optional(),
    }).parse({
      status: searchParams.get('status') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const limit = query.limit;

    const topups = await db.walletTopup.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.cursor && { id: { lt: query.cursor } }),
      },
      take: limit + 1,
      orderBy: { id: 'desc' },
      include: {
        host: {
          select: { id: true, name: true, email: true, phone: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const hasNextPage = topups.length > limit;
    const items = hasNextPage ? topups.slice(0, limit) : topups;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    const itemsWithUrls = await Promise.all(
      items.map(async (t) => {
        let screenshotUrl: string | null = null;
        if (t.screenshotKey) {
          try {
            screenshotUrl = await getPresignedReadUrl(t.screenshotKey);
          } catch {
            screenshotUrl = null;
          }
        }

        // Fetch host current balance
        const hostBalanceSum = await db.walletTransaction.aggregate({
          where: { hostId: t.host.id },
          _sum: { amountPaisa: true },
        });

        return {
          id: t.id,
          host: {
            ...t.host,
            currentBalancePaisa: hostBalanceSum._sum.amountPaisa || 0,
          },
          amountPaisa: t.amountPaisa,
          amountRupees: (t.amountPaisa / 100).toFixed(2),
          screenshotKey: t.screenshotKey,
          screenshotUrl,
          reference: t.reference,
          status: t.status,
          reviewedBy: t.reviewedBy,
          reviewedAt: t.reviewedAt,
          createdAt: t.createdAt,
        };
      })
    );

    return apiSuccess({
      items: itemsWithUrls,
      topups: itemsWithUrls,
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
