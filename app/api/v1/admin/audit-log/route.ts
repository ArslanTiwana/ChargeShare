import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { adminAuditLogFiltersSchema } from '@/shared/src';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const { searchParams } = new URL(request.url);
    const parsed = adminAuditLogFiltersSchema.parse(Object.fromEntries(searchParams.entries()));

    const where: Prisma.AdminAuditLogWhereInput = {};

    if (parsed.action) {
      where.action = parsed.action;
    }
    if (parsed.adminId) {
      where.adminId = parsed.adminId;
    }

    const limit = parsed.limit;
    const items = await db.adminAuditLog.findMany({
      where,
      take: limit + 1,
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
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
