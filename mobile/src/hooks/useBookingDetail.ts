import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBookingDetail,
  cancelBooking,
  confirmBooking,
  disputeBooking,
  createReview,
  BookingStatus,
} from '../api/bookings';

export function useBookingDetail(bookingId: string, isScreenFocused = true) {
  const queryClient = useQueryClient();
  const [appState, setAppState] = useState<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');

  // AppState listener for pausing polling when backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App returned to foreground: refresh query immediately
        queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, bookingId, queryClient]);

  // Query detail with conditional 15s polling
  const query = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => getBookingDetail(bookingId),
    enabled: Boolean(bookingId),
    refetchInterval: (queryData) => {
      const data = queryData.state.data;
      if (!isScreenFocused || appState !== 'active') return false;
      if (!data) return 15000;

      const activeStatuses: BookingStatus[] = ['REQUESTED', 'ACCEPTED', 'CHARGING', 'COMPLETED'];
      if (activeStatuses.includes(data.status)) {
        return 15000;
      }
      return false; // Stop polling on terminal states
    },
  });

  // Calculate countdown with server-time offset synchronization
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (!query.data?.serverTime) return;

    // Skew = ServerTime - LocalDeviceTime
    const serverTimeMs = new Date(query.data.serverTime).getTime();
    serverTimeOffsetRef.current = serverTimeMs - Date.now();
  }, [query.data?.serverTime]);

  useEffect(() => {
    const booking = query.data;
    if (!booking || booking.status !== 'REQUESTED' || !booking.expiresAt) {
      setCountdownSeconds(null);
      return;
    }

    const expiresAtMs = new Date(booking.expiresAt).getTime();

    const updateCountdown = () => {
      const currentServerTime = Date.now() + serverTimeOffsetRef.current;
      const remainingMs = Math.max(0, expiresAtMs - currentServerTime);
      const remainingSec = Math.floor(remainingMs / 1000);
      setCountdownSeconds(remainingSec);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [query.data?.status, query.data?.expiresAt]);

  // Mutations with query invalidation (approved change 9)
  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const disputeMutation = useMutation({
    mutationFn: (reason: string) => disputeBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (input: { rating: number; comment?: string }) =>
      createReview(bookingId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  return {
    booking: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    countdownSeconds,
    cancelMutation,
    confirmMutation,
    disputeMutation,
    reviewMutation,
  };
}
