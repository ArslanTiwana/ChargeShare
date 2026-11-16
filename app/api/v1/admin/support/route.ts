import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { SupportStatus } from '@prisma/client';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status')?.toUpperCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where: { status?: SupportStatus } = {};
    if (statusParam === 'OPEN' || statusParam === 'RESOLVED') {
      where.status = statusParam as SupportStatus;
    }

    const [messages, total] = await Promise.all([
      db.supportMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      }),
      db.supportMessage.count({ where }),
    ]);

    return apiSuccess({
      items: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
