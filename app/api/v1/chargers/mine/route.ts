import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireApprovedHost } from '@/lib/auth';
import { paginationQuerySchema } from '@/shared/src';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const host = await requireApprovedHost(request);
    const { searchParams } = new URL(request.url);

    const query = paginationQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const limit = query.limit;

    // Fetch with cursor pagination + location coordinates extracted
    const rows = await db.$queryRaw<
      Array<{
        id: string;
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
        rejectionReason: string | null;
        lat: number;
        lng: number;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        c.id,
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
        c."rejectionReason",
        ST_Y(c.location::geometry) AS lat,
        ST_X(c.location::geometry) AS lng,
        c."createdAt",
        c."updatedAt"
      FROM "Charger" c
      WHERE c."hostId" = ${host.id}
      ${query.cursor ? Prisma.sql`AND c.id > ${query.cursor}` : Prisma.empty}
      ORDER BY c.id ASC
      LIMIT ${limit + 1}
    `);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    // Fetch rejection reasons for rejected chargers
    const rejectedChargerIds = items.filter((r) => r.approvalStatus === 'REJECTED').map((r) => r.id);
    const rejectionMap: Record<string, string> = {};
    if (rejectedChargerIds.length > 0) {
      const logs = await db.adminAuditLog.findMany({
        where: {
          targetType: 'Charger',
          targetId: { in: rejectedChargerIds },
          action: 'CHARGER_REJECTED',
        },
        orderBy: { createdAt: 'desc' },
      });
      for (const log of logs) {
        if (!rejectionMap[log.targetId]) {
          const meta = log.metadata as any;
          if (meta?.reason) {
            rejectionMap[log.targetId] = meta.reason;
          }
        }
      }
    }

    return apiSuccess({
      chargers: items.map((r) => ({
        id: r.id,
        title: r.title,
        powerKw: Number(r.powerKw),
        connectorType: r.connectorType,
        pricePerKwhPaisa: r.pricePerKwhPaisa,
        areaLabel: r.areaLabel,
        addressLine: r.addressLine,
        notes: r.notes,
        meterInstalled: r.meterInstalled,
        isOnline: r.isOnline,
        approvalStatus: r.approvalStatus,
        rejectionReason: r.rejectionReason || rejectionMap[r.id] || null,
        lat: Number(r.lat),
        lng: Number(r.lng),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
