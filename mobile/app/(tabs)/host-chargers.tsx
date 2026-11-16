import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyChargers, setChargerOnline, setChargerOffline, HostChargerItem } from '../../src/api/chargers';
import {
  HostStatusGate,
  RoleSwitcher,
  Button,
  StatusBadge,
  EmptyState,
  ErrorState,
  Skeleton,
  formatPaisaToRupees,
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme';

export default function HostChargersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['host-chargers-full'],
    queryFn: () => getMyChargers(undefined, 50),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isOnline }: { id: string; isOnline: boolean }) =>
      isOnline ? setChargerOffline(id) : setChargerOnline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-chargers-full'] });
      queryClient.invalidateQueries({ queryKey: ['host-chargers'] });
    },
    onError: (err: any) => {
      Alert.alert('Status Change Failed', err?.message || 'Could not update charger online status.');
    },
  });

  const chargers = data?.chargers || [];

  return (
    <HostStatusGate>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>My Listed Chargers</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/host-charger/new')}
            accessibilityRole="button"
            accessibilityLabel="Add new charger"
          >
            <Text style={styles.addBtnText}>+ Add Charger</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton width="100%" height={140} borderRadius={radii.xl} />
            <Skeleton width="100%" height={140} borderRadius={radii.xl} />
          </View>
        ) : isError ? (
          <ErrorState message="Could not load your chargers." onRetry={refetch} />
        ) : chargers.length === 0 ? (
          <EmptyState
            title="No Chargers Found"
            description="You have not added any residential chargers to your profile yet."
            actionTitle="Add Your First Charger"
            onAction={() => router.push('/host-charger/new')}
          />
        ) : (
          <FlatList
            data={chargers}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.chargerCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.chargerTitle}>{item.title}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      item.approvalStatus === 'APPROVED' && styles.statusApproved,
                      item.approvalStatus === 'PENDING' && styles.statusPending,
                      item.approvalStatus === 'REJECTED' && styles.statusRejected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        item.approvalStatus === 'APPROVED' && styles.textApproved,
                        item.approvalStatus === 'PENDING' && styles.textPending,
                        item.approvalStatus === 'REJECTED' && styles.textRejected,
                      ]}
                    >
                      {item.approvalStatus}
                    </Text>
                  </View>
                </View>

                {/* Rejection notice if rejected */}
                {item.approvalStatus === 'REJECTED' && item.rejectionReason && (
                  <View style={styles.rejectionNotice}>
                    <Text style={styles.rejectionNoticeTitle}>Admin Rejection Reason:</Text>
                    <Text style={styles.rejectionNoticeText}>{item.rejectionReason}</Text>
                  </View>
                )}

                <View style={styles.specGrid}>
                  <Text style={styles.specItem}>⚡ Power: {item.powerKw} kW</Text>
                  <Text style={styles.specItem}>🔌 Plug: {item.connectorType}</Text>
                  <Text style={styles.specItem}>
                    💰 Rate: {formatPaisaToRupees(item.pricePerKwhPaisa)}/kWh
                  </Text>
                  <Text style={styles.specItem}>📍 Area: {item.areaLabel}</Text>
                </View>

                <Text style={styles.addressLine}>Private Address: {item.addressLine}</Text>

                <View style={styles.footerRow}>
                  {item.approvalStatus === 'APPROVED' ? (
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>
                        {item.isOnline ? '🟢 ONLINE' : '⚪ OFFLINE'}
                      </Text>
                      <Switch
                        value={item.isOnline}
                        onValueChange={() => {
                          toggleMutation.mutate({ id: item.id, isOnline: item.isOnline });
                        }}
                        disabled={toggleMutation.isPending}
                        trackColor={{ false: colors.border, true: colors.emeraldDark }}
                        thumbColor={colors.white}
                      />
                    </View>
                  ) : (
                    <Text style={styles.pendingOfflineNote}>
                      {item.approvalStatus === 'PENDING'
                        ? 'Pending approval by admin'
                        : 'Approval required before going online'}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => {
                      router.push({
                        pathname: '/host-charger/[id]',
                        params: { id: item.id },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Edit charger"
                  >
                    <Text style={styles.editBtnText}>Edit Specs ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  addBtn: {
    backgroundColor: colors.emeraldDark,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  skeletonContainer: {
    gap: 16,
  },
  listContent: {
    paddingBottom: 40,
    gap: 14,
  },
  chargerCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  chargerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  statusApproved: {
    backgroundColor: '#ecfdf5',
  },
  statusPending: {
    backgroundColor: '#fffbeb',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  textApproved: {
    color: colors.emeraldDark,
  },
  textPending: {
    color: '#b45309',
  },
  textRejected: {
    color: '#b91c1c',
  },
  rejectionNotice: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  rejectionNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991b1b',
  },
  rejectionNoticeText: {
    fontSize: 12,
    color: '#7f1d1d',
    marginTop: 2,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: spacing.xs,
  },
  specItem: {
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  addressLine: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.mutedText,
  },
  pendingOfflineNote: {
    fontSize: 11,
    color: colors.subtleText,
    fontStyle: 'italic',
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emeraldDark,
  },
});
