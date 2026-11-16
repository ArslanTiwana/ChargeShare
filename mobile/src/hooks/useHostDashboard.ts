import { useEffect, useState, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWallet } from '../api/wallet';
import { getPublicConfig } from '../api/config';
import { getBookings, acceptBooking, declineBooking, BookingListItem } from '../api/bookings';
import { getMyChargers, setChargerOnline, setChargerOffline, HostChargerItem } from '../api/chargers';

export function useHostDashboard() {
  const queryClient = useQueryClient();
  const [isForeground, setIsForeground] = useState(true);

  // AppState foreground/background tracking
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setIsForeground(nextState === 'active');
    });
    return () => sub.remove();
  }, []);

  const pollInterval = isForeground ? 15000 : false;

  // 1. Config
  const configQuery = useQuery({
    queryKey: ['public-config'],
    queryFn: getPublicConfig,
    staleTime: 1000 * 60 * 10,
  });

  // 2. Wallet
  const walletQuery = useQuery({
    queryKey: ['host-wallet'],
    queryFn: () => getWallet(undefined, 5),
    refetchInterval: pollInterval,
  });

  // 3. Bookings
  const bookingsQuery = useQuery({
    queryKey: ['host-dashboard-bookings'],
    queryFn: () => getBookings({ role: 'host', limit: 20 }),
    refetchInterval: pollInterval,
  });

  // 4. Chargers
  const chargersQuery = useQuery({
    queryKey: ['host-chargers'],
    queryFn: () => getMyChargers(undefined, 20),
    refetchInterval: pollInterval,
  });

  // Split bookings into requested (incoming) and active/today
  const incomingRequests = useMemo(() => {
    const list = bookingsQuery.data?.bookings || [];
    return list.filter((b) => b.status === 'REQUESTED');
  }, [bookingsQuery.data?.bookings]);

  const activeBookings = useMemo(() => {
    const list = bookingsQuery.data?.bookings || [];
    return list.filter((b) => ['ACCEPTED', 'CHARGING'].includes(b.status));
  }, [bookingsQuery.data?.bookings]);

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: (bookingId: string) => acceptBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-dashboard-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      declineBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-dashboard-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
    },
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async ({ chargerId, isOnline }: { chargerId: string; isOnline: boolean }) => {
      if (isOnline) {
        return setChargerOffline(chargerId);
      } else {
        return setChargerOnline(chargerId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-chargers'] });
    },
  });

  const refetchAll = () => {
    walletQuery.refetch();
    bookingsQuery.refetch();
    chargersQuery.refetch();
  };

  return {
    wallet: walletQuery.data,
    config: configQuery.data,
    incomingRequests,
    activeBookings,
    chargers: chargersQuery.data?.chargers || [],
    isLoading: walletQuery.isLoading || bookingsQuery.isLoading || chargersQuery.isLoading,
    isRefetching: walletQuery.isRefetching || bookingsQuery.isRefetching || chargersQuery.isRefetching,
    isError: walletQuery.isError || bookingsQuery.isError || chargersQuery.isError,
    refetch: refetchAll,
    acceptBooking: acceptMutation.mutateAsync,
    declineBooking: declineMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    isDeclining: declineMutation.isPending,
    toggleOnline: toggleOnlineMutation.mutateAsync,
    isTogglingOnline: toggleOnlineMutation.isPending,
  };
}
