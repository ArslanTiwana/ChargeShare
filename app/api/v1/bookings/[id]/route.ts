import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { Prisma } from '@prisma/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    let booking = await db.booking.findUnique({
      where: { id },
      include: {
        charger: {
          include: {
            host: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        driver: {
          select: { id: true, name: true, phone: true },
        },
        session: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Lazy expiry check
    if (booking.status === 'REQUESTED' && booking.expiresAt && booking.expiresAt < new Date()) {
      booking = await db.booking.update({
        where: { id: booking.id },
        data: { status: 'EXPIRED' },
        include: {
          charger: {
            include: {
              host: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
          driver: {
            select: { id: true, name: true, phone: true },
          },
          session: true,
        },
      });
    }

    const isDriver = booking.driverId === user.id;
    const isHost = booking.charger.hostId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isDriver && !isHost && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this booking');
    }

    const isPrivilegedState = ['ACCEPTED', 'CHARGING', 'COMPLETED', 'CONFIRMED'].includes(booking.status);
    const canSeePrivateDetails = (isDriver || isHost || isAdmin) && isPrivilegedState;

    let chargerExactCoords: { lat: number; lng: number } | null = null;
    if (canSeePrivateDetails) {
      const locRows = await db.$queryRaw<Array<{ lat: number; lng: number }>>(Prisma.sql`
        SELECT
          ST_Y(location::geometry)::float AS lat,
          ST_X(location::geometry)::float AS lng
        FROM "Charger"
        WHERE id = ${booking.chargerId}
      `);
      if (locRows.length > 0) {
        chargerExactCoords = locRows[0];
      }
    }

    return apiSuccess({
      id: booking.id,
      driverId: booking.driverId,
      chargerId: booking.chargerId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
      rateSnapshotPaisa: booking.rateSnapshotPaisa,
      estimatedKwh: booking.estimatedKwh ? Number(booking.estimatedKwh) : null,
      expiresAt: booking.expiresAt,
      cancelReason: booking.cancelReason,
      serverTime: new Date().toISOString(),
      createdAt: booking.createdAt,
      charger: {
        id: booking.charger.id,
        title: booking.charger.title,
        areaLabel: booking.charger.areaLabel,
        powerKw: Number(booking.charger.powerKw),
        connectorType: booking.charger.connectorType,
        pricePerKwhPaisa: booking.charger.pricePerKwhPaisa,
        publicLat: booking.charger.publicLat != null ? Number(booking.charger.publicLat) : undefined,
        publicLng: booking.charger.publicLng != null ? Number(booking.charger.publicLng) : undefined,
        addressLine: canSeePrivateDetails ? booking.charger.addressLine : undefined,
        lat: canSeePrivateDetails ? chargerExactCoords?.lat : undefined,
        lng: canSeePrivateDetails ? chargerExactCoords?.lng : undefined,
      },
      host: {
        id: booking.charger.host.id,
        name: booking.charger.host.name,
        phone: canSeePrivateDetails ? booking.charger.host.phone : undefined,
      },
      driver: {
        id: booking.driver.id,
        name: booking.driver.name,
        phone: canSeePrivateDetails ? booking.driver.phone : undefined,
      },
      session: booking.session
        ? {
            id: booking.session.id,
            kwhDelivered: Number(booking.session.kwhDelivered),
            rateSnapshotPaisa: booking.session.rateSnapshotPaisa,
            totalPaisa: booking.session.totalPaisa,
            commissionPaisa: booking.session.commissionPaisa,
            meterStartPhotoKey: booking.session.meterStartPhotoKey,
            meterEndPhotoKey: booking.session.meterEndPhotoKey,
            hostEnteredAt: booking.session.hostEnteredAt,
            driverConfirmedAt: booking.session.driverConfirmedAt,
            autoConfirmed: booking.session.autoConfirmed,
          }
        : null,
    });
  } catch (err) {
    return apiError(err);
  }
}
