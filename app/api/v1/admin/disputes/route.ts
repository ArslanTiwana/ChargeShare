import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { adminDisputesFiltersSchema } from '@/shared/src';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const { searchParams } = new URL(request.url);
    const parsed = adminDisputesFiltersSchema.parse(Object.fromEntries(searchParams.entries()));

    const where: Prisma.DisputeWhereInput = {};
    if (parsed.status) {
      where.status = parsed.status;
    }

    const limit = parsed.limit;
    const items = await db.dispute.findMany({
      where,
      take: limit + 1,
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        openedBy: {
          select: { id: true, name: true, email: true },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
        booking: {
          include: {
            driver: {
              select: { id: true, name: true, email: true, phone: true },
            },
            charger: {
              select: {
                id: true,
                title: true,
                host: {
                  select: { id: true, name: true, email: true, phone: true },
                },
              },
            },
            session: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return apiSuccess({
      items,
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
