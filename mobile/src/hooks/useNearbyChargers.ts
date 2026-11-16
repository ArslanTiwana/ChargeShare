import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNearbyChargers, NearbyCharger, ConnectorType } from '../api/chargers';

export interface UseNearbyChargersOptions {
  lat: number;
  lng: number;
  radiusKm?: number;
  fastOnly?: boolean; // >= 7 kW
  connectorType?: ConnectorType | null;
  enabled?: boolean;
}

const MAX_MARKERS = 50;
const MAX_RADIUS_KM = 50;

export function useNearbyChargers({
  lat,
  lng,
  radiusKm = 15,
  fastOnly = false,
  connectorType = null,
  enabled = true,
}: UseNearbyChargersOptions) {
  // Cap search radius
  const cappedRadius = Math.min(radiusKm, MAX_RADIUS_KM);

  const query = useQuery({
    queryKey: ['nearby-chargers', lat.toFixed(3), lng.toFixed(3), cappedRadius],
    queryFn: () => getNearbyChargers({ lat, lng, radiusKm: cappedRadius, limit: 50 }),
    enabled: enabled && !isNaN(lat) && !isNaN(lng),
    staleTime: 1000 * 30, // 30 seconds
  });

  // Client-side filtering & capping at 50 markers
  const filteredChargers = useMemo(() => {
    const rawList = query.data?.chargers || [];
    return rawList
      .filter((c: NearbyCharger) => {
        if (fastOnly && c.powerKw < 7) return false;
        if (connectorType && c.connectorType !== connectorType) return false;
        return true;
      })
      .slice(0, MAX_MARKERS);
  }, [query.data?.chargers, fastOnly, connectorType]);

  return {
    chargers: filteredChargers,
    totalFound: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
