import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireApprovedHost } from '@/lib/auth';
import { createSessionSchema } from '@/shared/src';
import { validateBookingTransition } from '@/lib/booking-state';
import { checkObjectExists } from '@/lib/storage';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';
import { Prisma } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const host = await requireApprovedHost(request);
    const { id: bookingId } = await params;
    const body = await request.json();
    const data = createSessionSchema.parse(body);

    // 1. Photo ownership and storage verification (photos are optional)
    const expectedPrefix = `METER_PHOTO/${host.id}/`;
    if (data.meterStartPhotoKey) {
      if (!data.meterStartPhotoKey.startsWith(expectedPrefix)) {
        throw new ForbiddenError('Meter photo keys must be uploaded by and belong to the host');
      }
      const startPhotoExists = await checkObjectExists(data.meterStartPhotoKey);
      if (!startPhotoExists) {
        throw new AppError('Meter start photo does not exist in storage', 400, 'PHOTO_NOT_FOUND');
      }
    }

    if (data.meterEndPhotoKey) {
      if (!data.meterEndPhotoKey.startsWith(expectedPrefix)) {
        throw new ForbiddenError('Meter photo keys must be uploaded by and belong to the host');
      }
      const endPhotoExists = await checkObjectExists(data.meterEndPhotoKey);
      if (!endPhotoExists) {
        throw new AppError('Meter photo does not exist in storage', 400, 'PHOTO_NOT_FOUND');
      }
    }

    const result = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { charger: true, session: true },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.charger.hostId !== host.id && host.role !== 'ADMIN') {
        throw new ForbiddenError('Only the charger host can submit meter readings');
      }

      // AppConfig: maxSessionKwh
      const maxKwhConfig = await tx.appConfig.findUnique({
        where: { key: 'maxSessionKwh' },
      });
      const maxSessionKwh = maxKwhConfig ? parseFloat(maxKwhConfig.value) : 150;

      if (data.kwhDelivered <= 0 || data.kwhDelivered > maxSessionKwh) {
        throw new AppError(`kWh delivered must be between 0 and ${maxSessionKwh} kWh`, 400, 'INVALID_KWH');
      }

      const rateSnapshotPaisa = booking.rateSnapshotPaisa || booking.charger.pricePerKwhPaisa;

      // AppConfig: commissionPercent
      const commissionConfig = await tx.appConfig.findUnique({
        where: { key: 'commissionPercent' },
      });
      const commissionPercent = commissionConfig ? parseFloat(commissionConfig.value) : 15;

      // Integer money math
      const totalPaisa = Math.round(data.kwhDelivered * rateSnapshotPaisa);
      if (totalPaisa <= 0) {
        throw new AppError('Total price rounds to zero. Please enter a valid kWh reading.', 400, 'ZERO_TOTAL');
      }

      const commissionPaisa = Math.round((totalPaisa * commissionPercent) / 100);

      // Check if updating an existing session before driver confirms
      if (booking.session) {
        if (booking.status !== 'COMPLETED') {
          throw new AppError('Meter readings can only be revised while booking is completed and unconfirmed', 400, 'CANNOT_EDIT');
        }

        // Log audit edit
        await tx.sessionEdit.create({
          data: {
            sessionId: booking.session.id,
            previousKwh: booking.session.kwhDelivered,
            newKwh: new Prisma.Decimal(data.kwhDelivered),
            reason: data.reason || 'Host revised meter reading',
            editedById: host.id,
          },
        });

        // Update session
        const updatedSession = await tx.session.update({
          where: { id: booking.session.id },
          data: {
            kwhDelivered: new Prisma.Decimal(data.kwhDelivered),
            rateSnapshotPaisa,
            totalPaisa,
            commissionPaisa,
            meterStartPhotoKey: data.meterStartPhotoKey ?? null,
            meterEndPhotoKey: data.meterEndPhotoKey ?? null,
            hostEnteredAt: new Date(),
          },
        });

        return { session: updatedSession, bookingStatus: booking.status, revised: true };
      }

      // First time submitting reading: booking must be CHARGING
      if (booking.status !== 'CHARGING') {
        throw new AppError('Session reading can only be entered when booking is charging', 400, 'NOT_CHARGING');
      }

      validateBookingTransition(booking.status, 'COMPLETED');

      // Create Session
      const session = await tx.session.create({
        data: {
          bookingId: booking.id,
          kwhDelivered: new Prisma.Decimal(data.kwhDelivered),
          rateSnapshotPaisa,
          totalPaisa,
          commissionPaisa,
          meterStartPhotoKey: data.meterStartPhotoKey ?? null,
          meterEndPhotoKey: data.meterEndPhotoKey ?? null,
          hostEnteredAt: new Date(),
        },
      });

      // Move booking to COMPLETED
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'COMPLETED',
          rateSnapshotPaisa,
        },
      });

      return { session, bookingStatus: 'COMPLETED', revised: false };
    });

    return apiSuccess({
      sessionId: result.session.id,
      bookingId,
      bookingStatus: result.bookingStatus,
      kwhDelivered: Number(result.session.kwhDelivered),
      rateSnapshotPaisa: result.session.rateSnapshotPaisa,
      totalPaisa: result.session.totalPaisa,
      commissionPaisa: result.session.commissionPaisa,
      revised: result.revised,
      message: result.revised
        ? 'Meter reading revised successfully'
        : 'Meter reading recorded. Awaiting driver confirmation.',
    });
  } catch (err) {
    return apiError(err);
  }
}
