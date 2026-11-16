import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { paginationQuerySchema, hostStatusSchema } from '@/shared/src';
import { z } from 'zod';

const hostFilterSchema = paginationQuerySchema.extend({
  status: hostStatusSchema.optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);
    const { searchParams } = new URL(request.url);

    const query = hostFilterSchema.parse({
      status: searchParams.get('status') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const limit = query.limit;

    const hosts = await db.user.findMany({
      where: {
        hostStatus: query.status ? query.status : { not: 'NONE' },
        ...(query.cursor && { id: { gt: query.cursor } }),
      },
      take: limit + 1,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        hostStatus: true,
        isActive: true,
        createdAt: true,
        chargers: {
          select: {
            id: true,
            title: true,
            areaLabel: true,
            isOnline: true,
            approvalStatus: true,
            pricePerKwhPaisa: true,
          },
        },
        walletTransactions: {
          select: {
            id: true,
            amountPaisa: true,
          },
        },
        _count: {
          select: { chargers: true },
        },
      },
    });

    const hasNextPage = hosts.length > limit;
    const items = hasNextPage ? hosts.slice(0, limit) : hosts;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return apiSuccess({
      items,
      hosts: items,
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
