import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth, requireApprovedHost } from '@/lib/auth';
import { updateChargerSchema, connectorTypeSchema, approvalStatusSchema } from '@/shared/src';
import { generatePublicCoordinates } from '@/lib/geo';
import { AppError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/ratelimit';
import { Prisma } from '@prisma/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const rows = await db.$queryRaw<
      Array<{
        id: string;
        hostId: string;
        title: string;
        powerKw: number;
        connectorType: string;
        pricePerKwhPaisa: number;
        areaLabel: string;
        addressLine: string;
        notes: string | null;
        meterInstalled: boolean;
        isOnline: boolean;
        approvalStatus: string;
        publicLat: number;
        publicLng: number;
        hostName: string;
        hostRatingAverage: number | null;
        reviewCount: bigint;
      }>
    >(Prisma.sql`
      SELECT
        c.id,
        c."hostId",
        c.title,
        c."powerKw"::float AS "powerKw",
        c."connectorType"::text AS "connectorType",
        c."pricePerKwhPaisa",
        c."areaLabel",
        c."addressLine",
        c.notes,
        c."meterInstalled",
        c."isOnline",
        c."approvalStatus"::text AS "approvalStatus",
        COALESCE(c."publicLat", ST_Y(c.location::geometry))::float AS "publicLat",
        COALESCE(c."publicLng", ST_X(c.location::geometry))::float AS "publicLng",
        u.name AS "hostName",
        ROUND(AVG(r.rating)::numeric, 1)::float AS "hostRatingAverage",
        COUNT(r.id) AS "reviewCount"
      FROM "Charger" c
      JOIN "User" u ON u.id = c."hostId"
      LEFT JOIN "Review" r ON r."revieweeId" = c."hostId"
      WHERE c.id = ${id}
      GROUP BY c.id, u.id
      LIMIT 1
    `);

    if (rows.length === 0) {
      throw new NotFoundError('Charger not found');
    }

    const c = rows[0];

    // Only host who owns this charger or ADMIN gets addressLine
    const isOwnerOrAdmin = user.id === c.hostId || user.role === 'ADMIN';

    return apiSuccess({
      id: c.id,
      title: c.title,
      powerKw: Number(c.powerKw),
      connectorType: connectorTypeSchema.parse(c.connectorType),
      pricePerKwhPaisa: c.pricePerKwhPaisa,
      areaLabel: c.areaLabel,
      ...(isOwnerOrAdmin && { addressLine: c.addressLine }),
      notes: c.notes,
      meterInstalled: c.meterInstalled,
      isOnline: c.isOnline,
      approvalStatus: approvalStatusSchema.parse(c.approvalStatus),
      publicLat: Number(c.publicLat),
      publicLng: Number(c.publicLng),
      hostName: c.hostName,
      hostRatingAverage: c.hostRatingAverage != null ? Number(c.hostRatingAverage) : null,
      reviewCount: Number(c.reviewCount),
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const host = await requireApprovedHost(request);
    const { id } = await params;

    // Rate-limit charger edits per host
    await checkRateLimit(`charger_edit_${host.id}`, 20, 60);

    const charger = await db.charger.findUnique({
      where: { id },
    });

    if (!charger) {
      throw new NotFoundError('Charger not found');
    }

    if (charger.hostId !== host.id && host.role !== 'ADMIN') {
      throw new ForbiddenError('You can only update your own chargers');
    }

    // Block edits while a booking is requested, accepted, or charging
    const activeBooking = await db.booking.findFirst({
      where: {
        chargerId: id,
        status: { in: ['REQUESTED', 'ACCEPTED', 'CHARGING'] },
      },
    });

    if (activeBooking) {
      throw new AppError(
        'Cannot edit charger details while a booking is in progress or requested',
        400,
        'CHARGER_HAS_ACTIVE_BOOKINGS'
      );
    }

    const body = await request.json();
    const data = updateChargerSchema.parse(body);

    const locationChanged = data.lat !== undefined && data.lng !== undefined;
    const addressChanged = data.addressLine !== undefined && data.addressLine !== charger.addressLine;
    const needsReapproval = charger.approvalStatus === 'APPROVED' && (locationChanged || addressChanged);

    let publicLat = charger.publicLat;
    let publicLng = charger.publicLng;

    if (locationChanged) {
      const [distRow] = await db.$queryRaw<Array<{ distance_meters: number }>>(Prisma.sql`
        SELECT ST_Distance(
          location,
          ST_SetSRID(ST_MakePoint(${data.lng!}, ${data.lat!}), 4326)::geography
        ) as distance_meters
        FROM "Charger"
        WHERE id = ${id}
      `);

      const moveDistanceMeters = distRow ? Number(distRow.distance_meters) : 0;

      // Public offset is recomputed only after a move over 100 m (or if null)
      if (moveDistanceMeters > 100 || publicLat == null || publicLng == null) {
        const publicCoords = generatePublicCoordinates(data.lat!, data.lng!);
        publicLat = publicCoords.publicLat;
        publicLng = publicCoords.publicLng;
      }

      await db.$executeRaw(Prisma.sql`
        UPDATE "Charger"
        SET
          location = ST_SetSRID(ST_MakePoint(${data.lng!}, ${data.lat!}), 4326)::geography,
          "publicLat" = ${publicLat},
          "publicLng" = ${publicLng}
        WHERE id = ${id}
      `);
    }

    const updated = await db.charger.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.powerKw !== undefined && { powerKw: data.powerKw }),
        ...(data.connectorType !== undefined && { connectorType: data.connectorType }),
        ...(data.pricePerKwhPaisa !== undefined && { pricePerKwhPaisa: data.pricePerKwhPaisa }),
        ...(data.areaLabel !== undefined && { areaLabel: data.areaLabel }),
        ...(data.addressLine !== undefined && { addressLine: data.addressLine }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.meterInstalled !== undefined && { meterInstalled: data.meterInstalled }),
        ...(needsReapproval && {
          approvalStatus: 'PENDING',
          isOnline: false,
        }),
      },
    });

    return apiSuccess({
      ...updated,
      powerKw: Number(updated.powerKw),
      publicLat,
      publicLng,
      ...(data.lat !== undefined && { lat: data.lat }),
      ...(data.lng !== undefined && { lng: data.lng }),
    });
  } catch (err) {
    return apiError(err);
  }
}
