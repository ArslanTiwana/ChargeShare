import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { paginationQuerySchema, approvalStatusSchema } from '@/shared/src';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('approvalStatus') || searchParams.get('status') || undefined;
    const query = paginationQuerySchema.extend({
      status: approvalStatusSchema.optional(),
    }).parse({
      status: statusParam,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const limit = query.limit;

    const chargers = await db.charger.findMany({
      where: {
        ...(query.status && { approvalStatus: query.status }),
        ...(query.cursor && { id: { gt: query.cursor } }),
      },
      take: limit + 1,
      orderBy: { id: 'asc' },
      include: {
        host: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    const hasNextPage = chargers.length > limit;
    const items = hasNextPage ? chargers.slice(0, limit) : chargers;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    const formattedItems = items.map((c) => ({
      id: c.id,
      title: c.title,
      powerKw: Number(c.powerKw),
      connectorType: c.connectorType,
      pricePerKwhPaisa: c.pricePerKwhPaisa,
      areaLabel: c.areaLabel,
      addressLine: c.addressLine,
      notes: c.notes,
      meterInstalled: c.meterInstalled,
      isOnline: c.isOnline,
      approvalStatus: c.approvalStatus,
      host: c.host,
      createdAt: c.createdAt,
    }));

    return apiSuccess({
      items: formattedItems,
      chargers: formattedItems,
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
