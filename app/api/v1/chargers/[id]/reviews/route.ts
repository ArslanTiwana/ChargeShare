import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { paginationQuerySchema } from '@/shared/src';
import { NotFoundError } from '@/lib/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chargerId } = await params;
    const { searchParams } = new URL(request.url);

    const query = paginationQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const charger = await db.charger.findUnique({
      where: { id: chargerId },
    });

    if (!charger) {
      throw new NotFoundError('Charger not found');
    }

    const limit = query.limit;

    // Fetch reviews for bookings associated with this charger
    const reviews = await db.review.findMany({
      where: {
        booking: { chargerId },
        reviewerId: { not: charger.hostId }, // Reviews given by drivers
        ...(query.cursor && { id: { lt: query.cursor } }),
      },
      take: limit + 1,
      orderBy: { id: 'desc' },
      include: {
        reviewer: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const hasNextPage = reviews.length > limit;
    const items = hasNextPage ? reviews.slice(0, limit) : reviews;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    // Aggregate rating statistics
    const stats = await db.review.aggregate({
      where: {
        booking: { chargerId },
        reviewerId: { not: charger.hostId },
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    return apiSuccess({
      chargerId,
      averageRating: stats._avg.rating ? Number(stats._avg.rating.toFixed(1)) : null,
      totalReviews: stats._count.id,
      reviews: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: {
          id: r.reviewer.id,
          name: r.reviewer.name,
          avatarUrl: r.reviewer.avatarUrl,
        },
      })),
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
