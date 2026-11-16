import { ConnectorType } from '../api/chargers';

export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 50;
export const DEFAULT_RADIUS_KM = 15;
export const KM_PER_LATITUDE_DEGREE = 111.0;

export interface RegionInput {
  latitude?: number;
  longitude?: number;
  latitudeDelta: number;
  longitudeDelta?: number;
}

export interface NearbyQueryParams {
  lat: number;
  lng: number;
  radiusKm: number;
  fastOnly?: boolean;
  connectorType?: ConnectorType | null;
  limit?: number;
}

/**
 * Calculates search radius from a visible map region's latitudeDelta.
 * 1 degree of latitude is ~111 km. Radius is half the visible span,
 * clamped between MIN_RADIUS_KM (1 km) and MAX_RADIUS_KM (50 km).
 */
export function calculateRadiusFromRegion(
  region: RegionInput,
  minRadius: number = MIN_RADIUS_KM,
  maxRadius: number = MAX_RADIUS_KM
): number {
  if (!region || typeof region.latitudeDelta !== 'number' || isNaN(region.latitudeDelta) || region.latitudeDelta <= 0) {
    return DEFAULT_RADIUS_KM;
  }

  const rawRadiusKm = (region.latitudeDelta * KM_PER_LATITUDE_DEGREE) / 2;
  const roundedRadius = Math.round(rawRadiusKm * 10) / 10;

  if (roundedRadius < minRadius) return minRadius;
  if (roundedRadius > maxRadius) return maxRadius;
  return roundedRadius;
}

/**
 * Builds valid nearby search parameters from map coordinates, region, and optional filters.
 */
export function buildNearbyRequest(options: {
  lat: number;
  lng: number;
  region?: RegionInput;
  radiusKm?: number;
  fastOnly?: boolean;
  connectorType?: ConnectorType | null;
  limit?: number;
}): NearbyQueryParams {
  const radius =
    options.radiusKm !== undefined
      ? Math.min(Math.max(options.radiusKm, MIN_RADIUS_KM), MAX_RADIUS_KM)
      : options.region
      ? calculateRadiusFromRegion(options.region)
      : DEFAULT_RADIUS_KM;

  return {
    lat: Number(options.lat.toFixed(5)),
    lng: Number(options.lng.toFixed(5)),
    radiusKm: radius,
    fastOnly: options.fastOnly || false,
    connectorType: options.connectorType || null,
    limit: options.limit ? Math.min(options.limit, 50) : 50,
  };
}

/**
 * Standard debounce utility with cancel support.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  waitMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
