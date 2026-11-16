import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireApprovedHost } from '@/lib/auth';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const host = await requireApprovedHost(request);
    const { id } = await params;

    const charger = await db.charger.findUnique({
      where: { id },
    });

    if (!charger) {
      throw new NotFoundError('Charger not found');
    }

    if (charger.hostId !== host.id && host.role !== 'ADMIN') {
      throw new ForbiddenError('You can only manage your own chargers');
    }

    if (charger.approvalStatus !== 'APPROVED') {
      throw new AppError('Only approved chargers can be put online', 400, 'NOT_APPROVED');
    }

    const updated = await db.charger.update({
      where: { id },
      data: { isOnline: true },
    });

    return apiSuccess({
      id: updated.id,
      isOnline: updated.isOnline,
      message: 'Charger is now online and discoverable by drivers',
    });
  } catch (err) {
    return apiError(err);
  }
}
