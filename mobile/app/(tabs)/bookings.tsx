import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { getBookings, BookingListItem, BookingStatus } from '../../src/api/bookings';
import { StatusBadge, EmptyState, ErrorState, Skeleton } from '../../src/components';
import { formatPaisaToRupees } from '../../src/components/MoneyText';
import { colors, radii, spacing } from '../../src/theme';

const TIMEZONE = 'Asia/Karachi';

const ACTIVE_STATUSES: BookingStatus[] = ['REQUESTED', 'ACCEPTED', 'CHARGING', 'COMPLETED'];

export default function BookingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'past'>('active');

  const {
    data,
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['bookings', 'driver'],
    queryFn: ({ pageParam }) =>
      getBookings({ role: 'driver', cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const allBookings = useMemo(() => {
    return data?.pages.flatMap((page) => page.bookings) || [];
  }, [data]);

  const filteredBookings = useMemo(() => {
    if (tab === 'active') {
      return allBookings.filter((b) => ACTIVE_STATUSES.includes(b.status));
    }
    return allBookings.filter((b) => !ACTIVE_STATUSES.includes(b.status));
  }, [allBookings, tab]);

  const handleOpenBooking = (bookingId: string) => {
    router.push({
      pathname: '/bookings/[id]',
      params: { id: bookingId },
    });
  };

  const renderBookingCard = ({ item }: { item: BookingListItem }) => {
    const datePart = formatInTimeZone(new Date(item.startsAt), TIMEZONE, 'EEE, d MMM yyyy');
    const timePart = formatInTimeZone(new Date(item.startsAt), TIMEZONE, 'HH:mm');
    const startStr = `${datePart} • ${timePart}`;
    const endStr = formatInTimeZone(new Date(item.endsAt), TIMEZONE, 'HH:mm');

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => handleOpenBooking(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Booking for ${item.charger.title}, status ${item.status}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleCol}>
            <Text style={styles.chargerTitle} numberOfLines={1}>
              {item.charger.title}
            </Text>
            <Text style={styles.areaLabel}>📍 {item.charger.areaLabel}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            📅 {startStr} - {endStr}
          </Text>
        </View>

        <View style={styles.detailsFooter}>
          <Text style={styles.hostText}>Host: {item.host.name.split(' ')[0]}</Text>
          <Text style={styles.rateText}>
            {formatPaisaToRupees(item.rateSnapshotPaisa || item.charger.pricePerKwhPaisa)}/kWh
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sub Tabs: Active vs Past */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'active' && styles.tabButtonActive]}
          onPress={() => setTab('active')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'active' }}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'past' && styles.tabButtonActive]}
          onPress={() => setTab('past')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'past' }}
        >
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bookings List */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <Skeleton width="100%" height={120} style={{ marginBottom: 14, borderRadius: 16 }} />
          <Skeleton width="100%" height={120} style={{ marginBottom: 14, borderRadius: 16 }} />
          <Skeleton width="100%" height={120} style={{ marginBottom: 14, borderRadius: 16 }} />
        </View>
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message || 'Failed to load bookings'}
          onRetry={refetch}
        />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'No Active Bookings' : 'No Past Bookings'}
          description={
            tab === 'active'
              ? 'You do not have any upcoming or in-progress charging bookings. Head to the Find tab to book a charger.'
              : 'Completed, cancelled, and expired booking receipts will appear here.'
          }
        />
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor={colors.emerald}
              colors={[colors.emerald]}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator size="small" color={colors.emerald} style={{ margin: 16 }} />
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabButtonActive: {
    borderBottomColor: colors.emeraldDark,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
  },
  tabTextActive: {
    color: colors.emeraldDark,
    fontWeight: '800',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  skeletonContainer: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  chargerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  areaLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedText,
  },
  timeRow: {
    marginVertical: spacing.xs,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  detailsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  hostText: {
    fontSize: 12,
    color: colors.mutedText,
    fontWeight: '500',
  },
  rateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
});
