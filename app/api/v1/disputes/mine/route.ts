import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
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

    const disputes = await db.dispute.findMany({
      where: {
        openedById: user.id,
        ...(query.cursor && { id: { lt: query.cursor } }),
      },
      take: limit + 1,
      orderBy: { id: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
            charger: {
              select: { id: true, title: true, areaLabel: true },
            },
          },
        },
      },
    });

    const hasNextPage = disputes.length > limit;
    const items = hasNextPage ? disputes.slice(0, limit) : disputes;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return apiSuccess({
      disputes: items,
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
