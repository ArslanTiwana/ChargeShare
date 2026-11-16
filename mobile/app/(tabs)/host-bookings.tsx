import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { getBookings, BookingListItem, BookingStatus } from '../../src/api/bookings';
import {
  HostStatusGate,
  RoleSwitcher,
  StatusBadge,
  EmptyState,
  ErrorState,
  Skeleton,
  formatPaisaToRupees,
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme';

const TIMEZONE = 'Asia/Karachi';

export default function HostBookingsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['host-bookings-list'],
    queryFn: () => getBookings({ role: 'host', limit: 50 }),
  });

  const allBookings = data?.bookings || [];

  const filteredBookings = useMemo(() => {
    return allBookings.filter((b) => {
      const isPast = ['COMPLETED', 'CONFIRMED', 'CANCELLED', 'DECLINED', 'EXPIRED'].includes(
        b.status
      );
      return activeTab === 'past' ? isPast : !isPast;
    });
  }, [allBookings, activeTab]);

  return (
    <HostStatusGate>
      <View style={styles.container}>
        {/* Active / Past Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'active' && styles.tabItemActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active Bookings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'past' && styles.tabItemActive]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
              Past History
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton width="100%" height={110} borderRadius={radii.lg} />
            <Skeleton width="100%" height={110} borderRadius={radii.lg} />
            <Skeleton width="100%" height={110} borderRadius={radii.lg} />
          </View>
        ) : isError ? (
          <ErrorState message="Could not load your host bookings." onRetry={refetch} />
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            title={activeTab === 'active' ? 'No Active Bookings' : 'No Past Bookings'}
            description={
              activeTab === 'active'
                ? 'Incoming booking requests and active sessions will appear here.'
                : 'Completed and past booking history will appear here.'
            }
          />
        ) : (
          <FlatList
            data={filteredBookings}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const startFormatted = formatInTimeZone(
                new Date(item.startsAt),
                TIMEZONE,
                'EEE, MMM d • h:mm a'
              );
              const endFormatted = formatInTimeZone(new Date(item.endsAt), TIMEZONE, 'h:mm a');

              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/host-booking/[id]', params: { id: item.id } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.chargerTitle}>{item.charger.title}</Text>
                    <StatusBadge status={item.status} />
                  </View>

                  <Text style={styles.slotText}>
                    {startFormatted} - {endFormatted}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>⚡ {item.charger.powerKw} kW</Text>
                    <Text style={styles.metaText}>
                      💰 {formatPaisaToRupees(item.rateSnapshotPaisa || item.charger.pricePerKwhPaisa)}/kWh
                    </Text>
                    {item.driver?.name && (
                      <Text style={styles.driverText}>👤 {item.driver.name}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </HostStatusGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  tabItemActive: {
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mutedText,
  },
  tabTextActive: {
    color: colors.ink,
  },
  skeletonContainer: {
    gap: 12,
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chargerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
    marginRight: 8,
  },
  slotText: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '600',
  },
  driverText: {
    fontSize: 12,
    color: colors.emeraldDark,
    fontWeight: '700',
  },
});
