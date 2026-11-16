import { useQuery } from '@tanstack/react-query';
import { getChargerAvailability } from '../api/chargers';

export function useAvailability(chargerId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: ['charger-availability', chargerId, date],
    queryFn: () => getChargerAvailability(chargerId, date),
    enabled: enabled && Boolean(chargerId) && Boolean(date),
    staleTime: 1000 * 15, // 15 seconds
  });
}
