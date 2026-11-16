import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { adminUsersFiltersSchema } from '@/shared/src';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const { searchParams } = new URL(request.url);
    const parsed = adminUsersFiltersSchema.parse(Object.fromEntries(searchParams.entries()));

    const where: Prisma.UserWhereInput = {};

    if (parsed.search) {
      where.OR = [
        { email: { contains: parsed.search, mode: 'insensitive' } },
        { name: { contains: parsed.search, mode: 'insensitive' } },
      ];
    }
    if (parsed.role) {
      where.role = parsed.role;
    }
    if (parsed.hostStatus) {
      where.hostStatus = parsed.hostStatus;
    }
    if (parsed.isActive !== undefined) {
      where.isActive = parsed.isActive;
    }

    const limit = parsed.limit;
    const items = await db.user.findMany({
      where,
      take: limit + 1,
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        role: true,
        hostStatus: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
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
