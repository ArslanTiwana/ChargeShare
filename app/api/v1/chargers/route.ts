import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireApprovedHost } from '@/lib/auth';
import { createChargerSchema } from '@/shared/src';
import { generatePublicCoordinates } from '@/lib/geo';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const host = await requireApprovedHost(request);
    const body = await request.json();
    const data = createChargerSchema.parse(body);

    const chargerId = `c${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`.substring(0, 25);
    const { publicLat, publicLng } = generatePublicCoordinates(data.lat, data.lng);

    await db.$executeRaw(Prisma.sql`
      INSERT INTO "Charger" (
        "id", "hostId", "title", "powerKw", "connectorType", "pricePerKwhPaisa",
        "areaLabel", "addressLine", "notes", "meterInstalled", "isOnline",
        "approvalStatus", "location", "publicLat", "publicLng", "createdAt", "updatedAt"
      ) VALUES (
        ${chargerId},
        ${host.id},
        ${data.title},
        ${data.powerKw},
        ${data.connectorType}::"ConnectorType",
        ${data.pricePerKwhPaisa},
        ${data.areaLabel},
        ${data.addressLine},
        ${data.notes || null},
        ${data.meterInstalled},
        false,
        'PENDING'::"ApprovalStatus",
        ST_SetSRID(ST_MakePoint(${data.lng}, ${data.lat}), 4326)::geography,
        ${publicLat},
        ${publicLng},
        NOW(),
        NOW()
      );
    `);

    const charger = await db.charger.findUnique({
      where: { id: chargerId },
    });

    return apiSuccess(
      {
        ...charger,
        powerKw: Number(charger?.powerKw),
        lat: data.lat,
        lng: data.lng,
      },
      201
    );
  } catch (err) {
    return apiError(err);
  }
}
