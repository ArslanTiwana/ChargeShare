import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createTopupSchema, paginationQuerySchema } from '@/shared/src';
import { checkObjectExists } from '@/lib/storage';
import { ForbiddenError, AppError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    // Only users with hostStatus APPROVED or PENDING can submit topups
    if (user.hostStatus === 'NONE' && user.role !== 'ADMIN') {
      throw new ForbiddenError('Only hosts can submit wallet top-ups');
    }

    const body = await request.json();
    const data = createTopupSchema.parse(body);

    // 1. Verify screenshot key belongs to caller and exists in storage
    const expectedPrefix = `TOPUP_SCREENSHOT/${user.id}/`;
    if (!data.screenshotKey.startsWith(expectedPrefix)) {
      throw new ForbiddenError('Payment screenshot must be uploaded by and belong to the host');
    }

    const screenshotExists = await checkObjectExists(data.screenshotKey);
    if (!screenshotExists) {
      throw new AppError('Payment screenshot does not exist in storage', 400, 'SCREENSHOT_NOT_FOUND');
    }

    // 2. Read min and max top-up limits from AppConfig
    const minConfig = await db.appConfig.findUnique({ where: { key: 'minTopupPaisa' } });
    const maxConfig = await db.appConfig.findUnique({ where: { key: 'maxTopupPaisa' } });
    const minPaisa = minConfig ? parseInt(minConfig.value, 10) : 50000; // Rs 500
    const maxPaisa = maxConfig ? parseInt(maxConfig.value, 10) : 50000000; // Rs 500,000

    if (data.amountPaisa < minPaisa || data.amountPaisa > maxPaisa) {
      throw new AppError(
        `Top-up amount must be between Rs ${(minPaisa / 100).toFixed(0)} and Rs ${(maxPaisa / 100).toFixed(0)}`,
        400,
        'INVALID_AMOUNT'
      );
    }

    // 3. Enforce maximum of 3 PENDING top-ups per host
    const pendingCount = await db.walletTopup.count({
      where: {
        hostId: user.id,
        status: 'PENDING',
      },
    });

    if (pendingCount >= 3) {
      throw new AppError('You have reached the maximum limit of 3 pending top-up requests', 400, 'TOO_MANY_PENDING_TOPUPS');
    }

    // 4. Reject duplicate reference per host
    if (data.reference) {
      const existingRef = await db.walletTopup.findFirst({
        where: {
          hostId: user.id,
          reference: data.reference,
        },
      });

      if (existingRef) {
        throw new AppError('A top-up request with this transaction reference has already been submitted', 409, 'DUPLICATE_REFERENCE');
      }
    }

    const topup = await db.walletTopup.create({
      data: {
        hostId: user.id,
        amountPaisa: data.amountPaisa,
        screenshotKey: data.screenshotKey,
        reference: data.reference || null,
        status: 'PENDING',
      },
    });

    return apiSuccess(
      {
        id: topup.id,
        amountPaisa: topup.amountPaisa,
        amountRupees: (topup.amountPaisa / 100).toFixed(2),
        reference: topup.reference,
        status: topup.status,
        createdAt: topup.createdAt,
        message: 'Top-up request submitted. An admin will verify the payment screenshot.',
      },
      201
    );
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const query = paginationQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const limit = query.limit;

    const topups = await db.walletTopup.findMany({
      where: {
        hostId: user.id,
        ...(query.cursor && { id: { lt: query.cursor } }),
      },
      take: limit + 1,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        amountPaisa: true,
        screenshotKey: true,
        reference: true,
        status: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    const hasNextPage = topups.length > limit;
    const items = hasNextPage ? topups.slice(0, limit) : topups;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return apiSuccess({
      topups: items.map((t) => ({
        ...t,
        amountRupees: (t.amountPaisa / 100).toFixed(2),
      })),
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
