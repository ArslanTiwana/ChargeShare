import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { adminBookingFiltersSchema } from '@/shared/src';
import { getKarachiDayRange } from '@/lib/date';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const { searchParams } = new URL(request.url);
    const parsed = adminBookingFiltersSchema.parse(Object.fromEntries(searchParams.entries()));

    const where: Prisma.BookingWhereInput = {};

    if (parsed.status) {
      where.status = parsed.status;
    }
    if (parsed.chargerId) {
      where.chargerId = parsed.chargerId;
    }
    if (parsed.driverId) {
      where.driverId = parsed.driverId;
    }
    if (parsed.date) {
      const { startOfDay, endOfDay } = getKarachiDayRange(parsed.date);
      where.startsAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const limit = parsed.limit;
    const items = await db.booking.findMany({
      where,
      take: limit + 1,
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        charger: {
          select: {
            id: true,
            title: true,
            areaLabel: true,
            addressLine: true,
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        session: true,
        dispute: true,
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
