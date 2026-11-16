import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { getPresignedReadUrl } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminSession(request);
    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        charger: {
          include: {
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
        session: {
          include: {
            edits: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        dispute: {
          include: {
            openedBy: {
              select: { id: true, name: true, email: true },
            },
            resolvedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Attach presigned photo URLs for session photos if present
    let meterStartPhotoUrl: string | null = null;
    let meterEndPhotoUrl: string | null = null;

    if (booking.session?.meterStartPhotoKey) {
      meterStartPhotoUrl = await getPresignedReadUrl(booking.session.meterStartPhotoKey);
    }
    if (booking.session?.meterEndPhotoKey) {
      meterEndPhotoUrl = await getPresignedReadUrl(booking.session.meterEndPhotoKey);
    }

    return apiSuccess({
      ...booking,
      session: booking.session
        ? {
            ...booking.session,
            meterStartPhotoUrl,
            meterEndPhotoUrl,
          }
        : null,
    });
  } catch (err) {
    return apiError(err);
  }
}
