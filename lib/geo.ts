import { Prisma } from '@prisma/client';
import db from './db';
import { ChargerPublic, connectorTypeSchema, approvalStatusSchema } from '@/shared/src';

export interface NearbyChargerResult extends ChargerPublic {}

/**
 * Calculates a pseudo-random offset between 150m and 300m in a random direction.
 * Does not require server secrets; uses uniform angular distribution.
 */
export function generatePublicCoordinates(exactLat: number, exactLng: number): { publicLat: number; publicLng: number } {
  // Distance between 150m and 300m
  const distanceMeters = 150 + Math.random() * 150;
  // Random bearing in radians
  const bearing = Math.random() * 2 * Math.PI;

  // 1 degree latitude ~ 111,320 meters
  const deltaLat = (distanceMeters * Math.cos(bearing)) / 111320;
  // 1 degree longitude ~ 111,320 * cos(lat) meters
  const latRad = (exactLat * Math.PI) / 180;
  const deltaLng = (distanceMeters * Math.sin(bearing)) / (111320 * Math.cos(latRad));

  return {
    publicLat: Number((exactLat + deltaLat).toFixed(6)),
    publicLng: Number((exactLng + deltaLng).toFixed(6)),
  };
}

/**
 * Searches for approved, online EV chargers within a given radius using PostGIS.
 * Strictly returns only public fields; exact lat/lng and addressLine are NEVER exposed.
 * Returned distance is computed from publicLat/publicLng to prevent triangulation.
 *
 * @param lat - Search latitude (WGS84)
 * @param lng - Search longitude (WGS84)
 * @param radiusKm - Radius in kilometers (default: 10)
 * @param limit - Maximum records to return (default: 20)
 */
export async function findNearbyChargers(
  lat: number,
  lng: number,
  radiusKm = 10,
  limit = 20
): Promise<NearbyChargerResult[]> {
  const radiusMeters = radiusKm * 1000;

  // Parameterized PostGIS query using Prisma's tagged template literal
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      title: string;
      powerKw: number;
      connectorType: string;
      pricePerKwhPaisa: number;
      areaLabel: string;
      notes: string | null;
      meterInstalled: boolean;
      isOnline: boolean;
      approvalStatus: string;
      publicLat: number;
      publicLng: number;
      distanceMeters: number;
      hostRatingAverage: number | null;
    }>
  >(Prisma.sql`
    SELECT
      c.id,
      c.title,
      c."powerKw"::float AS "powerKw",
      c."connectorType"::text AS "connectorType",
      c."pricePerKwhPaisa",
      c."areaLabel",
      c.notes,
      c."meterInstalled",
      c."isOnline",
      c."approvalStatus"::text AS "approvalStatus",
      c."publicLat"::float AS "publicLat",
      c."publicLng"::float AS "publicLng",
      ROUND(ST_Distance(
        ST_SetSRID(ST_MakePoint(c."publicLng", c."publicLat"), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ))::int AS "distanceMeters",
      ROUND(AVG(r.rating)::numeric, 1)::float AS "hostRatingAverage"
    FROM "Charger" c
    LEFT JOIN "Review" r ON r."revieweeId" = c."hostId"
    WHERE c."approvalStatus" = 'APPROVED'
      AND c."isOnline" = true
      AND c."publicLat" IS NOT NULL
      AND c."publicLng" IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(c."publicLng", c."publicLat"), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    GROUP BY c.id
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    powerKw: Number(row.powerKw),
    connectorType: connectorTypeSchema.parse(row.connectorType),
    pricePerKwhPaisa: row.pricePerKwhPaisa,
    areaLabel: row.areaLabel,
    notes: row.notes,
    meterInstalled: row.meterInstalled,
    isOnline: row.isOnline,
    approvalStatus: approvalStatusSchema.parse(row.approvalStatus),
    publicLat: Number(row.publicLat),
    publicLng: Number(row.publicLng),
    distanceMeters: Number(row.distanceMeters),
    hostRatingAverage: row.hostRatingAverage != null ? Number(row.hostRatingAverage) : null,
  }));
}
